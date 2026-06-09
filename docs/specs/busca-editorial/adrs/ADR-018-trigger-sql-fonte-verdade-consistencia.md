# ADR-018: Trigger SQL = fonte de verdade da consistência; signal só cache invalidation

- **Status**: Accepted
- **Date**: 2026-06-03
- **Tags**: database, postgres, trigger, signal, consistency, search-index, sync
- **Stakeholders**: database-architect (autor), code-implementer, software-architect, testing-engineer
- **Layer**: Database
- **Depends on**: ADR-015, ADR-016
- **Supersedes**: rascunho v2 que propunha signal-only

## Context

ADR-016 estabelece `SearchIndex` como read-projection. Falta definir **como manter `SearchIndex` em sincronia com `Article`**. Na v2 da spec, a proposta era usar exclusivamente Django signals (`post_save`, `post_delete`) — `database-architect` rejeitou com 4 cenários reais de falha:

### Bug 3 documentado pelo specialist — "fantasma do publicado"

Cenário: artigo publicado → indexado. Editor muda status para `draft` (despublicação) → signal `post_save` roda mas SearchIndex **continua povoado** porque o código não tinha branch de "remover índice". Artigo despublicado aparece em busca pública. Vetor de bug latente sério.

### 4 cenários que signal Python NÃO cobre

1. **`bulk_update` / `QuerySet.update()`**: Django **não dispara signal** em update massivo. 100 artigos despublicados via admin action → 100 fantasmas.
2. **Raw SQL** (`UPDATE articles SET status = 'draft'`): zero signal.
3. **Fixture `loaddata`** em CI/dev: cria Article, signal pode estar desabilitado em setup, SearchIndex fica fora.
4. **Restore parcial pós-incidente** (`pg_restore --table=articles`): SearchIndex restaurado de backup antigo, Article atual — drift.

Sob esses cenários, `SearchIndex` divergir de `Article` é silencioso (sem erro), só aparece quando alguém busca e nota resultado errado. Tempo entre causa e detecção pode ser dias/semanas.

## Decision Drivers

- **Consistência forte** entre Article e SearchIndex em TODA operação write (CRUD direto, bulk update, raw SQL, restore parcial).
- **Atomicidade transacional**: write em Article + write em SearchIndex devem estar na mesma transação (rollback de um = rollback do outro).
- **Testabilidade local**: signal Python ainda útil para invalidação de cache Redis (precisa de runtime Django).
- **Defesa em profundidade**: trigger + signal não são redundantes — endereçam responsabilidades distintas.

## Considered Options

1. **Signal Python only** (`post_save`/`post_delete`) — fonte única; rejeitado por cenários 1-4.
2. **Trigger SQL only** — fonte única; perde testabilidade do signal e perde gancho para invalidação Redis.
3. **Trigger SQL = consistência + Signal Python = cache invalidation** — ambos coexistem com responsabilidades disjuntas.
4. **Postgres LISTEN/NOTIFY** — trigger emite notify, worker Python consome para invalidar cache.

## Decision Outcome

**Chosen option**: **Opção 3 — Trigger SQL é fonte de verdade da consistência; signal Python é exclusivamente cache invalidation Redis**, porque:

- Trigger SQL roda dentro da transação write de `Article` → atomicidade garantida em todos os 4 cenários.
- Signal Python tem responsabilidade única e bem definida: `cache.delete_pattern('search:*')` (ou key específica). Não escreve em SearchIndex.
- Defense in depth: trigger é durável, signal é eventualmente útil para warm-up + cache.
- LISTEN/NOTIFY (opção 4) adiciona worker async — over-engineering para MVP em KVM 1.

### Implementação concreta — trigger SQL

Migration `apps/search/migrations/0003_search_triggers.py` (`atomic=False`):

```sql
-- Função de sincronia (UPSERT idempotente)
CREATE OR REPLACE FUNCTION trg_articles_sync_search()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'published' AND NEW.published_at IS NOT NULL THEN
    INSERT INTO search_index (article_id, search_vector,
                              title_text, excerpt_text, body_text,
                              author_id, category_id, published_at, indexed_at)
    VALUES (NEW.id,
            setweight(articles_search_config(NEW.title),   'A') ||
            setweight(articles_search_config(NEW.excerpt), 'B') ||
            setweight(articles_search_config(NEW.body),    'C'),
            NEW.title, NEW.excerpt, NEW.body,
            NEW.author_id, NEW.category_id, NEW.published_at, NOW())
    ON CONFLICT (article_id) DO UPDATE SET
      search_vector = EXCLUDED.search_vector,
      title_text    = EXCLUDED.title_text,
      excerpt_text  = EXCLUDED.excerpt_text,
      body_text     = EXCLUDED.body_text,
      author_id     = EXCLUDED.author_id,
      category_id   = EXCLUDED.category_id,
      published_at  = EXCLUDED.published_at,
      indexed_at    = NOW();
  ELSE
    -- Despublicação ou rascunho: remove projeção.
    DELETE FROM search_index WHERE article_id = NEW.id;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- Trigger AFTER INSERT/UPDATE OF (campos relevantes apenas — reduz overhead)
CREATE TRIGGER articles_sync_search
AFTER INSERT OR UPDATE OF status, published_at, title, excerpt, body,
                          author_id, category_id ON articles
FOR EACH ROW EXECUTE FUNCTION trg_articles_sync_search();

-- Trigger de remoção (DELETE de Article)
CREATE TRIGGER articles_remove_search
AFTER DELETE ON articles
FOR EACH ROW EXECUTE FUNCTION trg_articles_remove_search();
```

### Implementação concreta — signal Python (cache only)

```python
# apps/search/signals.py
from django.core.cache import cache
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from apps.articles.models import Article

@receiver([post_save, post_delete], sender=Article)
def invalidate_search_cache(sender, instance, **kwargs):
    """Trigger SQL já sincroniza SearchIndex. Este signal só invalida cache Redis.
    NÃO escreve em SearchIndex (ADR-018)."""
    cache.delete_pattern('search:v1:*')
```

### Tests obrigatórios

| Cenário                                                                       | Asserção                                                                    |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `Article.objects.create(status='published', ...)`                             | SearchIndex tem 1 linha com tsvector populado                               |
| `Article.objects.filter(...).update(status='draft')` (**bulk update**)        | SearchIndex tem 0 linhas (trigger cobre o bulk)                             |
| `connection.cursor().execute("UPDATE articles SET status='draft' WHERE ...")` | SearchIndex tem 0 linhas                                                    |
| `Article.objects.filter(...).delete()`                                        | SearchIndex.objects.count() == 0                                            |
| Mudança de `Article.title` em PUBLISHED                                       | `search_vector` reflete novo título (tsvector contém lexema do novo título) |

### Positive Consequences

- **Cobre todos os 4 cenários**: CRUD direto, bulk update, raw SQL, restore parcial — atomicidade transacional.
- Signal Python tem responsabilidade única (cache) — código mais simples.
- Defesa em profundidade real (não redundância).
- `factory_boy` em testes pode usar `SET session_replication_role = 'replica'` para suprimir trigger em cenários específicos.

### Negative Consequences (trade-offs)

- Trigger é SQL puro (não Django migration "auto-generated") — exige `RunSQL` em migration manual. Documentação clara em comments.
- Reindex completo (`manage.py reindex_search`) precisa **desabilitar trigger** ou usar bulk via SQL — cuidado para não duplicar work.
- Debugging: erro de trigger é em pg log (não em traceback Django). Mitigação: log estruturado da pg.

### Open Concerns

- **Open Question #3 do DESIGN §5**: `factory_boy` criando Article → trigger dispara → SearchIndex povoado mesmo em testes que não querem busca. Aceitar como feature; testes específicos usam `SET session_replication_role = 'replica'`. Documentação em `apps/search/tests/conftest.py`.

## Pros and Cons of the Options

### Opção 1 — Signal-only

- 👍 Pure Python; debuggável.
- 👎 Cobre apenas CRUD ORM clássico — falha em bulk/raw/restore.
- 👎 4 cenários reais geram fantasmas silenciosos.

### Opção 2 — Trigger-only

- 👍 Cobre tudo.
- 👎 Perde gancho idiomático Django para invalidação Redis.
- 👎 Warm-up de cache pós-deploy precisa de outro caminho.

### Opção 3 — Trigger + Signal (responsabilidades disjuntas) ⭐

- 👍 Cada camada tem dono.
- 👍 Cobre 4 cenários + invalidação Redis no mesmo design.
- 👎 Custo cognitivo +1 (developer entende que signal não escreve).

### Opção 4 — LISTEN/NOTIFY

- 👍 Async limpo; pode acionar reindex em background.
- 👎 Exige worker dedicado em KVM 1 (overhead).
- 👎 Over-engineering para o MVP.

## Implementation Notes

- **Task IDs**: T30.1.5b (migration 0003_search_triggers — trigger SQL), T30.1.5c (signal Python — cache only)
- **Migration**: `apps/search/migrations/0003_search_triggers.py` com `RunSQL` (`atomic=False`)
- **DESIGN.md**: §2.2 "Decisão refinada — Trigger SQL + Signal"
- **Specialist output**: `_specialist-outputs/01-database-architect.md` §1 Bug 3 e Bug 4
- **Test**: `apps/search/tests/test_trigger_sync.py` (5 cenários do tabela acima)
- **Documentação dev**: README de `apps/search/` explica o split de responsabilidades.
- **Migration order**: `0003_search_triggers` roda depois de `0002_indexes` para que o índice GIN exista antes do primeiro INSERT massivo.

## References

- DESIGN.md §2.2 (sync trigger + signal)
- `_specialist-outputs/01-database-architect.md` §1 Bug 3, Bug 4
- ADR-015 (bounded context base)
- ADR-016 (SearchIndex read-projection)
- ADR-019 (CONFIGURATION pt_unaccent — usado dentro do trigger)
- Postgres docs — Triggers, `BEFORE/AFTER ... FOR EACH ROW`
- Django docs — Signals (limitações documentadas para bulk operations)
