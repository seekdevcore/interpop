# Output literal — `database-architect`

**Data**: 2026-06-02
**Agent ID**: a96b9f81d3afbb3ca
**Tokens output**: ~84k
**Skills invocadas (via tool Skill)**: `postgres-best-practices`, `database-design`, `database-migration`, `database-architect`

---

## 0. Veredito geral

DESIGN.md §2.2 está **direcionalmente correto** — Postgres FTS + tabela paralela + GIN + signal é a escolha boring-beats-clever certa. Mas tem **5 bugs concretos** (1 trava migration, 1 quebra o `IMMUTABLE`, 1 silencia FTS de rascunho→publicado, 1 estima cardinalidade errada, 1 cria buraco de DR) e **8 gaps** que o code-implementer vai bater de frente.

Confirma decisões 1, 3, 5, 6, 7, 8 (com ressalvas). **Contesta** decisões 2 (config FTS) e 4 (sincronia signal-only). **Refina** o restante.

## 1. Bugs no DDL atual

### Bug 1 — `author_id BIGINT` está errado: `User.id` é UUID

`backend/apps/users/models.py:19` define `id = UUIDField(primary_key=True)`. A DDL em DESIGN.md §2.2 linha 94 (`author_id BIGINT NOT NULL REFERENCES auth_user(id)`) **vai falhar na migration** com type mismatch e cita uma tabela que nem existe (`auth_user` vs `users`).

```diff
-author_id BIGINT NOT NULL REFERENCES auth_user(id),
-category_id BIGINT REFERENCES categories(id),
+author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
+category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
```

### Bug 2 — `articles_search_config` quebra `IMMUTABLE`

`unaccent(text)` não é IMMUTABLE por default — é `STABLE`. Postgres recusa criar índice expressão sobre função não-imutável.

Fix (padrão Postgres pt-BR comunidade):

```sql
CREATE OR REPLACE FUNCTION public.immutable_unaccent(regdictionary, text)
RETURNS text AS $$ SELECT unaccent($1, $2) $$
LANGUAGE SQL IMMUTABLE PARALLEL SAFE;

CREATE TEXT SEARCH CONFIGURATION public.pt_unaccent (COPY = pg_catalog.portuguese);
ALTER TEXT SEARCH CONFIGURATION public.pt_unaccent
  ALTER MAPPING FOR hword, hword_part, word
  WITH unaccent, portuguese_stem;

CREATE OR REPLACE FUNCTION public.articles_search_config(text)
RETURNS tsvector AS $$
  SELECT to_tsvector('public.pt_unaccent'::regconfig, $1)
$$ LANGUAGE SQL IMMUTABLE PARALLEL SAFE;
```

Vantagem extra: unaccent dentro do pipeline FTS (token a token, antes do stemming). "ação" e "acao" geram lexema `aca`; "não" mantém stopword.

### Bug 3 — Signal `post_save` apenas com `status=published` cria fantasma

Cenário: artigo publicado → indexado. Editor muda status para `draft` → signal não roda upsert → linha continua em search_index → aparece em busca.

```python
@receiver(post_save, sender=Article)
def sync_search_index(sender, instance, **kwargs):
    if instance.status == Article.Status.PUBLISHED and instance.published_at:
        SearchIndex.objects.upsert_for(instance)
    else:
        SearchIndex.objects.filter(article_id=instance.pk).delete()

@receiver(post_delete, sender=Article)
def remove_search_index(sender, instance, **kwargs):
    SearchIndex.objects.filter(article_id=instance.pk).delete()
```

`bulk_update`/`QuerySet.update()` **não disparam signals** → reindex periódico necessário OU trigger Postgres backstop.

### Bug 4 — Signal-only é frágil; precisa de safety net

**Solução**: trigger Postgres + signal (não OU).

- Signal: testabilidade local (pytest mocka SearchIndex).
- Trigger: consistência sob bulk update, raw SQL, fixture loaddata, restore parcial.

```sql
CREATE OR REPLACE FUNCTION trg_articles_sync_search() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'published' AND NEW.published_at IS NOT NULL THEN
    INSERT INTO search_index (article_id, search_vector, title_text, excerpt_text,
                              body_text, author_id, category_id, published_at, indexed_at)
    VALUES (NEW.id,
            setweight(articles_search_config(NEW.title),   'A') ||
            setweight(articles_search_config(NEW.excerpt), 'B') ||
            setweight(articles_search_config(NEW.body),    'C'),
            NEW.title, NEW.excerpt, NEW.body,
            NEW.author_id, NEW.category_id, NEW.published_at, NOW())
    ON CONFLICT (article_id) DO UPDATE SET ...;
  ELSE
    DELETE FROM search_index WHERE article_id = NEW.id;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
```

**Decisão refinada**: trigger SQL = fonte da verdade da consistência; signal Python = invalidação de cache Redis only.

### Bug 5 — Cardinalidade do composite `(category_id, published_at)` baixa demais

5 categorias × 500k artigos = seletividade 20% no primeiro termo. Postgres prefere bitmap + GIN se `@@` seletivo. Composite vira índice morto.

Mais útil: **partial index**:

```sql
CREATE INDEX CONCURRENTLY idx_search_category_published
  ON search_index (category_id, published_at DESC)
  WHERE category_id IS NOT NULL;
```

**Open question 1**: endpoint aceita `q=""`? Se não (CA01 exige ≥2), composites de filtro-sem-q são **inúteis** — eliminar e ficar com **1 GIN apenas**.

## 2. Gaps que o main loop perdeu

### Gap A — Edge cases FTS pt-BR (k-pop ↔ kpop ↔ k pop)

`portuguese` config não normaliza hífen/espaço. DESIGN propõe `re.sub(r'[\s-]', '', q)` mas **não aplica ao texto indexado** → "kpop" na query não acha "k-pop" no body. **Bug latente**.

Fix: normalizar nos dois lados ou em nenhum:

```python
HYPHEN_COMPOUND_RE = re.compile(r'\b(\w+)-(\w+)\b')
def normalize_for_index(text):
    return HYPHEN_COMPOUND_RE.sub(lambda m: f'{m.group(0)} {m.group(1)}{m.group(2)}', text)
```

### Gap B — Plano de DR e PITR

DESIGN.md silencia. search_index é **derivável**:

- `pg_dump --exclude-table-data=search_index` → backup 20% menor
- Restore: load articles → `manage.py reindex_search` → ~10min para 500k
- Trade-off: 10min RTO extra × 20% menos disco. Para KVM 1 aceito.

### Gap C — Batch size 500 do reindex: justificada?

500 × 10KB = 5MB payload. CPU `to_tsvector` ~1.5ms/doc × 500k = 12.5min single-threaded. **Adicionar `--parallel=4`** (multiprocessing.Pool) → 3.5min.

### Gap D — `total_estimate` via EXPLAIN: corner case 0 resultados

Plan Rows = 1 default sem estatística → frontend mostra "1 resultado" mas página vem vazia.

Fix:

```python
def estimate_total(results, per_page, plan_rows, page_count):
    if len(results) < per_page:
        return per_page * (page_count - 1) + len(results)
    return max(plan_rows, per_page * page_count + 1)
```

### Gap E — Vacuum/autovacuum tuning

GIN tem fastupdate ativado → pending list cresce → `@@` degrada silenciosamente.

```sql
ALTER INDEX idx_search_vector_gin SET (fastupdate = on, gin_pending_list_limit = '2MB');
ALTER TABLE search_index SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_cost_delay = '10ms'
);
```

### Gap F — Cobertura INCLUDE

```sql
CREATE INDEX idx_search_author_pub_covering
  ON search_index (author_id, published_at DESC) INCLUDE (article_id);
```

### Gap G — Particionamento (defer mas planejar)

- Chave: `published_at` por ano (RANGE)
- Trigger: `search_index > 100GB` OR `p95 > 250ms` por 2 semanas
- Não by-tenant (single-tenant)
- Não by-category (5 categorias = skew)

### Gap H — Multi-tenancy declarada (single-tenant)

Sem RLS, sem `tenant_id`, sem schema-per-publisher. Re-avaliar se virar plataforma white-label.

## 3. Migration plan refinado (5 fases)

```
Fase 1 — Schema (instantâneo): CREATE EXTENSION, CONFIG, FUNCTION, CREATE TABLE
Fase 2 — Índices (não-bloqueante): CONCURRENTLY, atomic=False na migration
Fase 3 — Triggers (lock leve): CREATE FUNCTION + TRIGGER
Fase 4 — Backfill (deploy gating): reindex_search --parallel=4
Fase 5 — Cutover: feature flag SEARCH_FEATURE_ENABLED
```

## 4. Confirma/Refina/Contesta

| Decisão                           | Veredito    | Notas                                 |
| --------------------------------- | ----------- | ------------------------------------- |
| 1. SearchIndex tabela paralela    | ✅ CONFIRMA |                                       |
| 2. Config FTS portuguese+unaccent | 🟡 REFINO   | Config dedicada `pt_unaccent` (Bug 2) |
| 3. Weights A/B/C                  | ✅ CONFIRMA |                                       |
| 4. Sincronia signal post_save     | ❌ CONTESTO | **trigger SQL + signal só cache**     |
| 5. SQLite dev fallback            | ✅ CONFIRMA | + marker `requires_postgres`          |
| 6. Tag postergar                  | ✅ CONFIRMA |                                       |
| 7. ADRs 018/019/020               | 🟡 REFINO   | 019 reescrita; 018 adiciona trigger   |

## 5. ADRs novos/atualizados

| ID          | Status | Mudança                                                           |
| ----------- | ------ | ----------------------------------------------------------------- |
| ADR-018     | UPDATE | Trigger Postgres = fonte de verdade; signal só cache invalidation |
| ADR-019     | UPDATE | CONFIGURATION pt_unaccent com mapping (preserva IMMUTABLE)        |
| ADR-030 NEW | CREATE | Composite indexes parciais (WHERE NOT NULL) com justificativa     |
| ADR-031 NEW | CREATE | Particionamento adiado (gatilho 100GB OR p95>250ms)               |
| ADR-032 NEW | CREATE | Backup lean: exclude search_index + reindex pós-restore           |
| ADR-033 NEW | CREATE | Multi-tenancy: single-tenant declarado                            |
| ADR-034 NEW | CREATE | Vacuum tuning fastupdate + scale_factor 0.05                      |

## 6. Tasks novas

| ID       | Descrição                                                          | Prioridade   |
| -------- | ------------------------------------------------------------------ | ------------ |
| T30.1.4b | CONFIGURATION pt_unaccent + immutable_unaccent (substitui T30.1.4) | 🔴 Immediate |
| T30.1.5b | Migration 0003_search_triggers com trigger SQL                     | 🔴 Immediate |
| T30.1.5c | Signal Python só invalidação de cache Redis                        | 🟠 High      |
| T30.1.6b | reindex_search com `--parallel=N` (default 1)                      | 🟡 Normal    |
| T30.1.X1 | Migration 0004_search_vacuum_tuning                                | 🟠 High      |
| T30.1.X2 | Utilitário normalize_compounds(text) simétrico                     | 🟠 High      |
| T30.1.X3 | estimate_total() com floor por len(results)                        | 🟡 Normal    |
| T30.1.X4 | Feature flag SEARCH_FEATURE_ENABLED no SearchView                  | 🟠 High      |
| TX-13    | Runbook DR: pg_dump --exclude-table-data + reindex auto            | 🟡 Normal    |
| TX-14    | Documentar gatilho particionamento em docs/ops/scaling-triggers.md | ⚪ Low       |

## 7. Open questions

1. Endpoint suporta `q=""`? Se não, eliminar composites = menos 2 índices.
2. `CREATE EXTENSION unaccent` exige superuser na Hostinger?
3. Trigger SQL conflita com testabilidade? Aceitar como feature; factories podem usar `SET session_replication_role = 'replica'`.
4. Recency boost afeta cardinality estimate? Re-avaliar em 500k com pg_stat_statements.
5. search_log guarda results_count=0 para identificar queries que merecem tag?
6. KVM 1 tem quanto de RAM para shared_buffers (índice GIN ~3-5GB)?
