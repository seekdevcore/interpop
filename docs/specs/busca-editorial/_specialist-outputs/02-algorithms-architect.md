# Output literal — `algorithms-data-structures-architect`

**Data**: 2026-06-02
**Agent ID**: acad272eb179cd7c4
**Tokens output**: ~86k
**Skills invocadas**: `data-structure-protocol`, `sql-optimization-patterns`, `postgresql-optimization`, `superpowers:brainstorming`, `engenharia-de-requisitos`

---

## Posição

Refino crítico: confirma 5 decisões, **contesta 2**, aprofunda 4.

## 1. Problem brief (apertado)

- tsvector indexado, ~50k → 500k em 5 anos
- Zipfian: top 100 queries → 60-70% tráfego; long tail = 1-2/mês
- p95 ≤ 300ms server, budget DB ≤ 200ms
- Adversarial: 1 char, 200 chars, só stopwords, operadores tsquery, emoji

## 2. Candidatos REAIS com números

| Candidate                 | Build ms    | @@+rank p95 (50k)           | Score quality   | Index size | Constants risk                |
| ------------------------- | ----------- | --------------------------- | --------------- | ---------- | ----------------------------- |
| **`ts_rank_cd` + GIN** ⭐ | ~50ms       | **80-140ms**                | proximity-aware | ~120MB     | recheck heap I/O em Zipf head |
| `ts_rank` + GIN           | ~50ms       | 60-110ms                    | TF puro         | ~120MB     | mesmo                         |
| BM25 via `rum`            | ~250ms (5×) | **20-60ms** (rank no index) | SOTA Okapi      | ~240MB     | extension não-core (KVM 1)    |

Rejeitados: `pg_trgm` (fuzzy, não FTS); Elasticsearch (viola Postgres-only); sem rank (perde feature).

### Constants check real (Postgres 16, conta de padeiro)

**Por que ts_rank_cd não é grátis**:

1. **GIN é lossy para `@@`** → bitmap heap scan + recheck. Para Zipf-head: 30-40% das linhas → 15-20k heap fetches → 200-1000ms só recheck. **Estoura 300ms p95**.
2. `ts_rank_cd` lê `search_vector` da heap → +50-150ms para 15k candidatos.
3. `exp(...)` re-avaliado por linha → ~5ms desprezível.

**Realista**: p95 150-250ms em 50k; **400-700ms em 500k sem otimização**. 300ms p95 em risco em 5 anos.

### Mitigações exigidas (que §2.3 NÃO tem)

| Mit                                               | Ganho                                 | Custo         |
| ------------------------------------------------- | ------------------------------------- | ------------- |
| **M1**: `LIMIT N` em CTE candidates               | corta 15k → 500 heap fetches          | reescrita SQL |
| **M2**: índice parcial `WHERE status='published'` | corta 30-40% candidatos               | +CREATE INDEX |
| **M3**: `work_mem ≥ 64MB`                         | bitmap não vira lossy                 | config server |
| **M4**: `statement_timeout = '500ms'`             | mata patológica antes do timeout HTTP | config        |
| **M5**: Redis hit ≥70% no head Zipfian            | tira head do DB                       | já no §2.4    |

## 3. Decisões

### ✅ CONFIRMA: `ts_rank_cd(sv, q, 32)` sobre ts_rank e BM25

Sweet spot: proximidade ajuda multi-token, `rum` é dívida operacional, `ts_rank` perde demais em multi-token.

Normalization bit 32 (`rank/(rank+1)`) = score [0,1] monotônico, estável para fusão multiplicativa com recency.

### ⚠️ CONTESTA: half-life 21 dias (decisão "fórmula completa")

`exp(-days/30)` = half-life ~20.8 dias. **Agressivo demais** para editorial:

| Plataforma                | Half-life                          |
| ------------------------- | ---------------------------------- |
| Hacker News               | ~3.4h                              |
| Reddit hot                | ~12h                               |
| **NYT (search)**          | **~6-12 meses**                    |
| **Substack discovery**    | **3-6 meses**                      |
| Google News               | ~3 dias                            |
| **Recomendação Interpop** | **60 dias** (`/90` no denominador) |

Por quê 60: Interpop publica análise (não news). "K-pop no Grammy 2024" é relevante por meses. 60d dá: 30d→71%, 60d→50%, 180d→19%. Balanço melhor.

**Fórmula sugerida**:

```sql
exp(-EXTRACT(EPOCH FROM (NOW() - published_at)) / (86400.0 * 90)) AS recency_boost
-- half-life ≈ 62 dias
```

**Decision flag**: parâmetro de tuning. `SEARCH_RECENCY_HALF_LIFE_DAYS = 60` em settings para A/B test.

### ✅ CONFIRMA tie-breaker `(published_at DESC, id ASC)`

UUID v4 = ordem pseudo-aleatória → tie justo.

### ✅ CONFIRMA cursor keyset com tuple comparison

**Mas sub-especificada**. Tuple compare com float64 + calculado por linha → risco de ties por float drift.

Mitigação: **`ROUND(score::numeric, 6)`** antes de comparar. Caso contrário cursor pula linhas na 15ª casa decimal.

### ✅ CONFIRMA HMAC sign

- invariante: rotação invalida cursores ativos → usuário recebe 400. Aceitável.

### ✅ CONFIRMA page size 20/50.

### ⚠️ CONTESTA SUAVE: highlighting client-side puro

mark.js puro **não trata stemming pt-BR**: "cantores" não destaca "cantor".

| Opção                                        | Trade-off                                          |
| -------------------------------------------- | -------------------------------------------------- |
| mark.js puro                                 | ✅ 6KB · ❌ não casa stem                          |
| mark.js + snowball-stemmers cliente          | ✅ casa · ❌ +8KB (RSLP)                           |
| **Server retorna `query_terms_expanded`** ⭐ | ✅ exato, 0KB extra · ❌ +5ms server (`ts_lexize`) |

**Recomendação**: opção 3 — server retorna `query_terms_expanded: string[]` ao lado dos resultados. ADR-022 atualizar.

## 4. Edge cases

| Caso                      | Esperado                                      | Status §2.3                              |
| ------------------------- | --------------------------------------------- | ---------------------------------------- |
| `q=""`, `q=" "`, `q="a"`  | 400                                           | ✅                                       |
| `q="!"` (só pontuação)    | empty tsquery → 200 results:[] **sem hit DB** | ⚠️ ADD GUARD                             |
| `q="o de da"` (stopwords) | mesmo                                         | ⚠️                                       |
| 200 chars exatos          | OK                                            | ✅                                       |
| 201+ chars                | 400                                           | ✅                                       |
| `q="' OR 1=1 --"`         | plainto_tsquery escapa                        | ✅                                       |
| `q="kpop:*&music"`        | plainto IGNORA operadores (≠ to_tsquery)      | ✅ explicitar como invariante            |
| Emoji                     | sem stem, ~0 matches, 200 empty               | ✅                                       |
| `q="Beyoncé"`             | unaccent normaliza                            | ✅                                       |
| `q="k-pop"` vs `q="kpop"` | **NÃO casa** sem normalização extra           | ⚠️ aplicar simétrico no indexing + query |

**Invariante crítica**: `normalize_search_text(s)` é função **única**, compartilhada entre signal post_save (upsert search_vector) E SearchService.query(). Drift quebra silenciosamente toda busca composta.

## 5. Adversarial input

### A1: query Zipf-head sem filtro

`q="cultura"` em 500k → 40% match → 200k linhas → estoura 300ms.

- **Defesa**: cache Redis hit ≥60% top-100. Invalidação proativa em insert top-100, staleness 5min.
- **Defesa adicional**: `gin_fuzzy_search_limit = 5000` → planner aborta scan se candidatos > 5000.

### A2: query inflando tsvector

20 tokens repetidos → AND-query → bitmap intersection caro.

- **Defesa**: truncar `q` para ≤8 tokens significativos após strip stopwords. >8 → 400 `query_too_complex`.

### A3: paginação profunda

Cursor HMAC bloqueia adversário externo. Usuário válido vai página 5000 → degrada.

- **Defesa**: cursor carrega `depth`; >50 → 400 `refine_query`.

## 6. Zipfian — ranking estável?

ts_rank_cd estável para head (proximidade + TF normalizado). Long-tail colapsa para "quem tem token no título" — setweight A no título já dá esse efeito. Aceitável MVP. BM25 (`rum`) se analytics queixar.

## 7. SQL pseudocode completo

```sql
WITH q AS (
    SELECT plainto_tsquery('portuguese', :q_norm) AS query
),
candidates AS (
    SELECT si.article_id, si.search_vector, si.published_at,
           si.author_id, si.category_id,
           ts_rank_cd(si.search_vector, q.query, 32) AS rank_raw
    FROM search_index si, q
    WHERE
        si.search_vector @@ q.query
        AND q.query IS DISTINCT FROM ''::tsquery   -- guard empty
        AND (:author_id::bigint  IS NULL OR si.author_id  = :author_id)
        AND (:cat_id::bigint     IS NULL OR si.category_id = :cat_id)
        AND (:de::timestamptz    IS NULL OR si.published_at >= :de)
        AND (:ate::timestamptz   IS NULL OR si.published_at <= :ate)
    ORDER BY rank_raw DESC
    LIMIT 500   -- M1: corta heap fetches
),
scored AS (
    SELECT article_id, published_at,
           ROUND(
             (rank_raw * exp(-EXTRACT(EPOCH FROM (NOW() - published_at))
                              / (86400.0 * :half_life_days)))::numeric, 6
           )::float AS score
    FROM candidates
)
SELECT article_id, score, published_at
FROM scored
WHERE
    :cursor_score::float IS NULL
    OR (score, published_at, article_id)
       < (:cursor_score, :cursor_pub::timestamptz, :cursor_id::uuid)
ORDER BY score DESC, published_at DESC, article_id ASC
LIMIT :limit;
```

Side-fetch dos artigos (anti N+1):

```python
articles = (Article.objects.filter(id__in=ids)
            .select_related('author', 'category')
            .in_bulk(field_name='id'))
return [articles[r.article_id] for r in rows[:page_size]]
```

## 8. Invariantes (12) para code-implementer

1. **Determinismo**: mesma `(q, filters, cursor, DB, NOW)` → mesma ordem.
2. **Normalização simétrica**: `normalize_search_text(s)` única; teste obrigatório.
3. **`plainto_tsquery`** (não `to_tsquery`) sempre.
4. **Status filter sempre**: `status='published' AND published_at IS NOT NULL AND published_at <= NOW()`.
5. **Cursor HMAC**: assinatura inválida → 400 (não 500, não 200).
6. **Cursor score `ROUND(6)`** simétrico em SELECT e encode.
7. **Empty tsquery early-exit**: zero hit DB se plainto vazio.
8. **Tokens-per-query cap = 8**.
9. **Pagination depth cap = 50**.
10. **`half_life_days` em settings, não literal**.
11. **`query_terms_expanded` na response** (stems pt-BR via `ts_lexize`).
12. **`statement_timeout = '500ms'`** no role de leitura.

## 9. Testes (13)

| Invariante | Caso                                                    | Tipo                         |
| ---------- | ------------------------------------------------------- | ---------------------------- |
| 2          | Indexar "K-Pop" + buscar "kpop" → casa                  | property-based + integration |
| 1          | Mesma query 100× → ordem idêntica                       | property-based               |
| 3          | `q="kpop:*&!"` → 0 erros                                | unit + integration           |
| 4          | Draft não aparece                                       | integration                  |
| 5          | Cursor flipado → 400                                    | unit                         |
| 6          | 100 inserts entre página 1 e 2 → cursor estável         | integration                  |
| 7          | Stopwords → 0 queries Postgres (CaptureQueriesContext)  | integration                  |
| 9          | Página 51 → 400                                         | integration                  |
| A1         | 50k seed 40% match, cache miss → p95 < 300ms            | **k6**                       |
| A2         | 20 tokens → 400                                         | unit                         |
| recency    | 2 artigos idênticos 0d vs 60d → score 2×                | unit                         |
| half_life  | settings=30 → ranking mais agressivo                    | integration                  |
| Zipf       | Seed Zipfiano → top 100 p95 < 200ms cache, < 350ms miss | **k6**                       |

## 10. ADRs

- **ADR-021 REV**: half-life 60d (não 21d) + CTE candidate-narrowing LIMIT 500 + `query_terms_expanded`
- **ADR-021b NEW**: Mitigações de pior caso GIN (gin_fuzzy_search_limit, statement_timeout, work_mem, depth cap)
- **ADR-022 REV**: highlight client-side com `query_terms_expanded` do server (não só `q`)

## 11. Handoff

- → `database-architect`: validar M1-M5 (config cluster Postgres)
- → `backend-architect`: response shape com `query_terms_expanded: string[]`; serializer truncate 8 tokens
- → `code-implementer`: 12 invariantes
- → `testing-engineer`: 13 testes + k6 Zipfiano
- → `frontend-architect`: mark.js recebe `query_terms_expanded` (não só `q`)
