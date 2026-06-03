# ADR-030-DB: Composite indexes parciais (`WHERE NOT NULL`) + covering INCLUDE

- **Status**: Accepted (novo v3)
- **Date**: 2026-06-03
- **Tags**: database, postgres, indexes, partial-index, covering-index, write-amplification
- **Stakeholders**: database-architect (autor), algorithms-data-structures-architect, code-implementer
- **Layer**: DB

## Context

`search_index` precisa de índices para filtros `(author_id, ...)`, `(category_id, ...)`, `(published_at)`. Com 500k registros e ~10k autores + 50 editorias, índices full causam:

- Write amplification: cada UPDATE em status → todos os índices atualizam mesmo que `author_id` não mude.
- Tamanho: composite `(category_id, published_at)` full em 500k pesa ~25MB com nulls inúteis.
- Bloat: índices em colunas opcionais bloqueiam autovacuum sem ganho.

Postgres oferece **partial indexes** (`WHERE col IS NOT NULL`) e **covering indexes** (`INCLUDE (col)`) que mitigam ambos.

## Decision Drivers

- Reduzir write amplification em UPSERT do search_index
- Cobrir query do SearchService com index-only scan quando possível
- Minimizar tamanho on-disk e RAM (KVM 1 tem 4GB)

## Considered Options

1. **Composite full** `(author_id, published_at DESC)` — paga bloat e write amp.
2. **Composite parcial + covering INCLUDE** ⭐
3. **Sem composite, só GIN** — fica lento em filtro por autor sem texto.

## Decision Outcome

**Chosen: Opção 2**.

### Indexes finais (migration `0002_search_indexes`)

```sql
-- 1. GIN para FTS
CREATE INDEX CONCURRENTLY idx_search_vector_gin
  ON search_index USING GIN (search_vector);

-- 2. Composite parcial por editoria
CREATE INDEX CONCURRENTLY idx_search_category_published
  ON search_index (category_id, published_at DESC)
  WHERE category_id IS NOT NULL;

-- 3. Composite parcial por autor com covering
CREATE INDEX CONCURRENTLY idx_search_author_pub_covering
  ON search_index (author_id, published_at DESC)
  INCLUDE (article_id);

-- 4. Index-only scan friendly para ordering por data
CREATE INDEX CONCURRENTLY idx_search_published_only
  ON search_index (published_at DESC);
```

### Por que parcial em `category_id`?

`Article.category` é opcional (alguns artigos não têm editoria). Index parcial:

- Tamanho ~40% menor (estimativa 500k com 30% null).
- Write amp zero quando insert/update tem `category_id IS NULL`.
- Trade-off: query com `category IS NULL` filter não usa o index — aceitável (rare path).

### Por que covering em `author_id`?

`INCLUDE (article_id)` permite index-only scan na CTE candidate-narrowing (ADR-021) quando filter é só por autor — Postgres devolve `article_id` direto do índice sem heap fetch.

### `CREATE INDEX CONCURRENTLY` exige `atomic = False`

Migration precisa de `atomic = False` ao topo:

```python
class Migration(migrations.Migration):
    atomic = False
    operations = [...]
```

Caso contrário Django wrap em transaction → CONCURRENTLY proibido.

### Open question (DESIGN §5 #2)

Se endpoint não aceita `q=""` (CA01 exige ≥2 chars), composites podem ser eliminados (filtros sem `q` nunca acontecem). Confirmar com usuário antes de criar — se rejeitar `q=""`, dropar índices 2 e 3.

### Positive Consequences

- Write amplification reduzida (~40% para parcial category).
- Tamanho de índices reduzido (KVM 1 RAM agradece).
- Index-only scan em queries filtro-por-autor sem texto.

### Negative Consequences

- Migration mais complexa (`atomic = False`).
- Query `category IS NULL` fica lenta — aceitável.
- Manutenção mental: dev precisa saber que parcial existe (documentar no schema doc).

## Pros and Cons of the Options

### Opção 1 — composite full

- 👍 Simples.
- 👎 Write amp + tamanho.

### Opção 2 — parcial + covering ⭐

- 👍 Otimizado para padrão real de query.
- 👎 Complexidade na migration.

## Implementation Notes

- **Task IDs**: T30.1.3 (composite indexes), T30.1.X1 (vacuum tuning relacionado — ADR-034)
- **Migration**: `0002_search_indexes` com `atomic = False`
- **Test**: integration via `EXPLAIN ANALYZE` — query filtro autor usa `idx_search_author_pub_covering` (index-only scan)
- **Referência DESIGN.md**: §2.2 (DB)
- **Referência specialist**: `_specialist-outputs/01-database-architect.md`

## References

- DESIGN.md §2.2
- `_specialist-outputs/01-database-architect.md`
- ADR-018 (trigger SQL)
- ADR-019 (CONFIGURATION pt_unaccent)
- ADR-021 (CTE candidate-narrowing usa estes índices)
- ADR-034 (vacuum tuning)
- Postgres docs — Partial Indexes, INCLUDE clause (index-only scans)
