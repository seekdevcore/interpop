# ADR-016: CQRS leve — `SearchIndex` como read-projection

- **Status**: Accepted
- **Date**: 2026-06-03
- **Tags**: software-architecture, cqrs, read-projection, search, postgres, gin
- **Stakeholders**: software-architect (autor), database-architect, code-implementer
- **Layer**: Software
- **Depends on**: ADR-015
- **Decisão alinhada com**: roadmap.sh/software-design-architecture — CQRS lite

## Context

Definida em ADR-015 a existência de `apps.search`, falta decidir **onde mora o `tsvector` indexado**:

- **Opção A**: coluna `search_vector tsvector` direto em `articles.Article` + índice GIN parcial (`WHERE status='published'`).
- **Opção B**: tabela paralela `search.SearchIndex` (read-projection) com `article_id FK` + colunas denormalizadas (`title_text`, `excerpt_text`, `body_text`, `author_id`, `category_id`, `published_at`, `search_vector tsvector`, `indexed_at`) sincronizada por trigger SQL + signal.

Forças:

- `Article` já tem 18 colunas. Adicionar `search_vector` + cache de FTS + `search_metadata jsonb` empurra para 22+ colunas, mais migrations por motivos ortogonais (mudar weight A/B/C = migration no Article = risco editorial).
- Coupling efferent (Ce): `tsvector` em Article aumenta Ce do app articles para extension `unaccent` + funções `pt_unaccent` (ADR-019). Toda migration de Article precisa rodar com extensions OK.
- Ownership: quem cuida do índice? Se está em Article, é compartilhado entre time editorial e time de busca — recipe for ambiguidade.
- Performance: read-projection denormalizada permite indexes parciais agressivos (`WHERE category_id IS NOT NULL`, `WHERE status='published'`) sem afetar Article.
- Reindex: `manage.py reindex_search --parallel=4` opera só sobre `SearchIndex` (não bloqueia editorial).

## Decision Drivers

- Separar Command (CRUD editorial) de Query (busca ranqueada) — CQRS lite.
- Permitir mudar weights/dicionários/sinônimos sem migration no Article.
- Habilitar backup lean (`pg_dump --exclude-table-data=search_index` — ADR-032).
- Index size: GIN do tsvector ~120MB para 50k, ~3-5GB para 500k. Manter isolado evita pressão sobre tablespace de Article.
- Particionamento futuro (ADR-031): só faz sentido em `SearchIndex`, nunca em Article (Article tem FK saindo para 5+ tabelas).

## Considered Options

1. **Coluna in-place em `Article.search_vector`** — atualizada via trigger SQL.
2. **`SearchIndex` como tabela paralela (read-projection)** — FK para Article, sincronizada por trigger + signal.
3. **MaterializedView Postgres** — `CREATE MATERIALIZED VIEW search_index AS SELECT ...; REFRESH CONCURRENTLY`.

## Decision Outcome

**Chosen option**: **Opção 2 — `SearchIndex` como read-projection em `apps.search/models.py`**, porque:

- Ownership unambígua (`apps.search` cuida do índice).
- Permite indexes parciais + covering + composite sem tocar Article (ADR-030-DB).
- Trigger SQL (ADR-018) garante sincronia atômica em transação write de Article.
- Backup lean é viável (`SearchIndex` é derivável de Article — ADR-032).
- Newsletter consome `SearchService.query()` sem importar Article — boundary mantida.

### Modelo Django (esboço)

```python
# apps/search/models.py
class SearchIndex(models.Model):
    article = models.OneToOneField('articles.Article', on_delete=models.CASCADE,
                                   primary_key=True, db_column='article_id',
                                   related_name='+')
    # Colunas denormalizadas (evitam JOIN em queries comuns)
    author_id = models.UUIDField()
    category_id = models.BigIntegerField(null=True)
    published_at = models.DateTimeField()
    # search_vector é gerenciado por trigger SQL (ADR-018); Django nunca escreve.
    search_vector = SearchVectorField()
    title_text = models.TextField()
    excerpt_text = models.TextField()
    body_text = models.TextField()
    indexed_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'search_index'
        managed = True  # Django gerencia tabela; trigger é unmanaged migration RunSQL
```

### Sincronia

- **Fonte de verdade da consistência**: trigger SQL `trg_articles_sync_search` (ADR-018).
- **Signal Python**: apenas cache invalidation no Redis (não escreve em `SearchIndex`).
- **Reindex manual**: `manage.py reindex_search --parallel=4` para backfill ou restore.

### Positive Consequences

- `Article` não cresce; migrations editoriais separadas das migrations de busca.
- Backup 20% menor (ADR-032) — search_index excluído via `--exclude-table-data`.
- Indexes parciais agressivos em `SearchIndex` sem afetar editorial.
- Habilita particionamento futuro (ADR-031) só onde faz sentido.
- Trade-off de "dupla escrita" eliminado por trigger SQL em transação atômica.

### Negative Consequences (trade-offs)

- Custo de sincronia: trigger + signal precisam estar sempre coerentes (ADR-018 endereça).
- Espaço extra: ~600MB para 500k artigos (texto duplicado em `title_text`, `excerpt_text`, `body_text` denormalizado). Aceito porque DR backup compensa via ADR-032.
- Restore de produção: precisa rodar `reindex_search` pós-restore (~10min para 500k com `--parallel=4`). RTO +10min trocado por 20% menos disco — aceito em KVM 1.

## Pros and Cons of the Options

### Opção 1 — Coluna in-place em `Article`

- 👍 Sem dupla escrita; sem `SearchIndex`; menos código.
- 👎 Article passa de 18 → 22+ colunas. God-model.
- 👎 Migration de weight A/B/C = migration em Article. Risco editorial.
- 👎 Backup carrega tsvector inflado (~3-5GB extra para 500k).
- 👎 Ownership ambígua.

### Opção 2 — `SearchIndex` read-projection ⭐

- 👍 Ownership clara; CQRS lite material.
- 👍 Indexes/particionamento/backup com liberdade total.
- 👎 Sincronia (endereçada por trigger SQL).
- 👎 Duplica texto (aceitável).

### Opção 3 — Materialized View

- 👍 Zero dupla escrita; refresh idempotente.
- 👎 `REFRESH MATERIALIZED VIEW CONCURRENTLY` exige `UNIQUE INDEX` no mview; complica.
- 👎 Latência de atualização: artigo publicado só aparece em busca após refresh (∞ minutos de janela).
- 👎 Editorial não tolera "publiquei mas não aparece em busca" — viola UX.

## Implementation Notes

- **Task IDs**: T30.1.4 (modelo SearchIndex), T30.1.4b (extension + config FTS), T30.1.5b (trigger SQL), T30.1.5c (signal Python — cache only)
- **Migration**: `0001_initial` (schema), `0002_indexes` (GIN concurrent), `0003_search_triggers`, `0004_search_vacuum_tuning`
- **DESIGN.md**: §2.1, §2.2
- **Specialist outputs**: `_specialist-outputs/01-database-architect.md` §1 Bug 4, §3 fase 1-5
- **Relação com ADR-018**: trigger SQL é a fonte da consistência. Sem ADR-018, ADR-016 é frágil.

## References

- DESIGN.md §2.1, §2.2
- `DESIGN-v2-hybrid.md` §2.1
- ADR-015 (bounded context base)
- ADR-018 (trigger SQL = fonte de verdade da consistência)
- ADR-030-DB (indexes parciais + covering)
- ADR-032 (backup lean exclui SearchIndex)
- Greg Young — _CQRS Documents_ (read-projection pattern)
- roadmap.sh/software-design-architecture
