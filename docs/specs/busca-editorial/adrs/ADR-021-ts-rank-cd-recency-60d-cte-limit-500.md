# ADR-021: `ts_rank_cd` + recency boost half-life 60d + CTE candidate-narrowing LIMIT 500 + `query_terms_expanded`

- **Status**: Accepted (revisado v3)
- **Date**: 2026-06-03
- **Tags**: algorithms, ranking, postgres-fts, ts_rank_cd, recency-boost, performance
- **Stakeholders**: algorithms-data-structures-architect (autor), database-architect, backend-architect, code-implementer
- **Layer**: Algorithms & Data Structures
- **Decisão alinhada com**: roadmap.sh/system-design (caching strategies, ranking)
- **Supersedes**: nenhuma (decisão consolidada da v3; v2 propunha half-life 21d agressivo)

## Context

A busca editorial precisa ranquear resultados por relevância + recência sob NFR p95 ≤ 300ms em 50k artigos (escalando a 500k em 5 anos). Forças:

- **Sweet spot pt-BR**: `ts_rank_cd` (cover-density, considera proximidade) sobre `ts_rank` (TF puro) e BM25 (`rum` extension). BM25 seria SOTA mas `rum` é extension não-core na Hostinger KVM 1.
- **Editorial ≠ news cycle**: a v2 propunha `exp(-days/30)` = half-life ~21d. Specialist `algorithms-data-structures-architect` contestou: editorial Interpop publica análise (não breaking news). NYT search half-life é 6-12 meses; Substack discovery 3-6 meses. 21d sepulta análise relevante por meses.
- **Constants check real**: GIN é lossy para `@@`; em Zipf-head (queries top-100 sem filtro) sem mitigação, p95 estoura 400-700ms em 500k artigos. CTE candidate-narrowing `LIMIT 500` é defesa primária; outras mitigações em ADR-021b.
- **Highlight pt-BR exige stems do server**: `mark.js` puro não casa "cantor" com "cantores"; client-side stemmer (snowball pt-BR) adiciona +8KB. Servidor já tem `ts_lexize('portuguese_stem', ...)` — retornar `query_terms_expanded: string[]` é zero-KB cliente.

## Decision Drivers

- p95 ≤ 300ms server (200ms DB efetivo após split de budget §3.3 do DESIGN)
- Proximidade de tokens importa para queries multi-token ("k-pop Brasil")
- Recência boost monotônico, parametrizável via settings (A/B test futuro)
- Determinismo (mesma `(q, filters, cursor, NOW)` → mesma ordem)
- Estabilidade do cursor sob inserts concorrentes
- Stemming pt-BR no highlight sem inflar bundle

## Considered Options

1. **`ts_rank` + GIN** — TF puro, mais barato, mas perde em multi-token.
2. **BM25 via `rum`** — SOTA Okapi, rank no index (mais rápido), mas extension não-core + dívida operacional.
3. **`ts_rank_cd` + GIN + recency boost (`exp(-days/X)`) + CTE LIMIT 500** ⭐ — sweet spot pt-BR + defesa Zipf-head.
4. **Elasticsearch** — viola constraint "Postgres-only" (Hostinger KVM 1, sem RAM para JVM).

## Decision Outcome

**Chosen**: **Opção 3** com half-life **60 dias** (não 21) e CTE candidate-narrowing.

### Fórmula final

```sql
ROUND(
  (ts_rank_cd(search_vector, query, 32)
    * exp(-EXTRACT(EPOCH FROM (NOW() - published_at))
          / (86400.0 * :half_life_days)))::numeric, 6
)::float AS score
```

- `ts_rank_cd(sv, q, 32)`: cover-density com **normalization bit 32** (`rank/(rank+1)`) → score [0,1] monotônico, estável para fusão multiplicativa.
- `exp(-days / 90)`: denominador 90 → half-life ≈ 62 dias. Curva: 30d→71%, 60d→50%, 180d→19%.
- `:half_life_days = settings.SEARCH_RECENCY_HALF_LIFE_DAYS` (default 60). Parametrizável para A/B test.
- `ROUND(score::numeric, 6)`: estabilidade float em cursor tuple comparison (sem isso, drift na 15ª casa decimal pula linhas).

### CTE candidate-narrowing (defesa Zipf-head primária)

```sql
WITH q AS (SELECT plainto_tsquery('portuguese', :q_norm) AS query),
candidates AS (
    SELECT si.article_id, si.search_vector, si.published_at, ...,
           ts_rank_cd(si.search_vector, q.query, 32) AS rank_raw
    FROM search_index si, q
    WHERE si.search_vector @@ q.query
      AND q.query IS DISTINCT FROM ''::tsquery   -- guard empty (Invariante 7)
      AND ... (filtros opcionais)
    ORDER BY rank_raw DESC
    LIMIT 500   -- corta heap fetches 15k → 500
)
SELECT ... FROM scored WHERE (score, published_at, article_id) < (...) ORDER BY score DESC ... LIMIT :limit
```

### `query_terms_expanded` na response

Backend executa `SELECT ts_lexize('portuguese_stem', unnest(string_to_array(:q_norm, ' ')))` e adiciona `query_terms_expanded: string[]` ao payload. Frontend (`mark.js`) usa essa lista (não `q` cru) para destacar "cantor" quando query é "cantores".

### Tie-breaker determinístico

`ORDER BY score DESC, published_at DESC, article_id ASC` — UUID v4 = pseudo-aleatório → tie justo.

### Positive Consequences

- p95 ≤ 250ms em 50k (cache miss); ≤ 100ms em cache hit.
- Determinismo total (testável property-based).
- Recência editorial respeitada (análise de 60d ainda compete por relevância).
- Highlight pt-BR correto (stems casam plurais/conjugações).
- Cursor estável sob inserts concorrentes (ROUND 6).
- Parâmetro `SEARCH_RECENCY_HALF_LIFE_DAYS` permite A/B test sem migration.

### Negative Consequences

- p95 em 500k sem mitigações adicionais ainda flerta com 350ms — exige ADR-021b (`gin_fuzzy_search_limit`, `statement_timeout`, work_mem).
- `ts_rank_cd` lê `search_vector` da heap pós-filtro → recheck I/O em Zipf-head sem CTE seria fatal.
- A/B test do half-life precisa pipeline analítico futuro (não inclui MVP).

## Pros and Cons of the Options

### Opção 1 — `ts_rank` puro

- 👍 Mais barato (~10% mais rápido).
- 👎 Perde em multi-token; usuário sente "ordem aleatória" em queries 2-3 palavras.

### Opção 2 — BM25 via `rum`

- 👍 Rank no índice; p95 20-60ms em 50k.
- 👎 Extension não-core (instalar manualmente; risco de breakage em upgrade Postgres).
- 👎 Index 2× maior (240MB vs 120MB).
- 👎 Dívida operacional desproporcional ao ganho no MVP.

### Opção 3 — `ts_rank_cd` + recency 60d + CTE ⭐

- 👍 Sweet spot performance/qualidade/operacional.
- 👍 Parametrizável (settings).
- 👍 Determinístico, testável.
- 👎 Exige ADR-021b (mitigações de pior caso GIN) para 500k.

### Opção 4 — Elasticsearch

- 👍 SOTA semantic + scale.
- 👎 Viola constraint Postgres-only + RAM KVM 1 inviável (JVM 1-2GB).

## Implementation Notes

- **Task IDs**: T30.1.7 (SearchService.query), T30.1.X2 (normalize_search_text simétrica), T30.1.X3 (estimate_total floor), T30.1.X5 (query_terms_expanded), TX-15 (statement_timeout + gin_fuzzy_search_limit + work_mem)
- **Settings**: `SEARCH_RECENCY_HALF_LIFE_DAYS = 60` em `config/settings/base.py`
- **Migration**: `0002_search_indexes` (GIN + parciais), `0003_search_triggers` (já cobre normalize signal)
- **Test types**: unit (recency calc), integration (cursor estável), property-based (determinismo), k6 (p95 Zipfiano)
- **Referência DESIGN.md**: §2.3 (todo)
- **Referência specialist**: `_specialist-outputs/02-algorithms-architect.md` linhas 21-105, 145-205

## References

- DESIGN.md §2.3 e §4 (tabela ADRs)
- `_specialist-outputs/02-algorithms-architect.md`
- ADR-018 (trigger SQL — fonte de verdade)
- ADR-019 (FTS config pt_unaccent)
- ADR-021b (mitigações pior caso GIN — bloco indissociável)
- ADR-022 (highlight com query_terms_expanded)
- Postgres docs — `ts_rank_cd`, `tsquery normalization bits`
- Substack engineering blog — recency in editorial discovery (2023)
