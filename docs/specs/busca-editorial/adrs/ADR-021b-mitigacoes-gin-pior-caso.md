# ADR-021b: Mitigações de pior caso GIN (`gin_fuzzy_search_limit`, `statement_timeout`, cap 8 tokens, cap 50 páginas)

- **Status**: Accepted (novo v3)
- **Date**: 2026-06-03
- **Tags**: algorithms, postgres-fts, gin, dos-defense, query-budget, role-config
- **Stakeholders**: algorithms-data-structures-architect (autor), database-architect, cyber-security-architect, code-implementer
- **Layer**: Algorithms & Data Structures
- **Related**: ADR-021 (bloco indissociável)

## Context

ADR-021 estabelece `ts_rank_cd` + recency 60d + CTE LIMIT 500 como ranking. Mesmo com CTE, há **4 cenários de pior caso** que estouram p95 OU permitem DoS leve:

1. **Zipf-head query sem filtro** (`q="cultura"` em 500k → 40% match → 200k linhas candidatas mesmo antes do LIMIT) — bitmap heap scan vira lossy se `work_mem` < 64MB.
2. **Query inflando tsvector** (20 tokens repetidos AND-query) — bitmap intersection caro.
3. **Paginação profunda** (página 5000) — cursor HMAC válido permite varredura linear do índice.
4. **Query patológica concentrada** (mesma `q` Zipf-head + filtros que matam cache key + 500 reqs/s distribuídos em 30 IPs) — single Postgres query consome shared_buffers + saturate worker pool antes do throttle DRF disparar.

Specialist `algorithms-data-structures-architect` definiu 5 mitigações (M1-M5 no §2.3); M1 (CTE LIMIT 500) já está em ADR-021. As outras 4 vivem aqui.

## Decision Drivers

- p95 ≤ 300ms em 500k mesmo em Zipf-head
- Defesa em profundidade contra DoS leve (segurança ≠ inferência só pelo throttle)
- Configuração explícita versionada (não "ad-hoc no Postgres")
- Resposta clara ao usuário (4xx tipado vs timeout 502)

## Considered Options

1. **Confiar só no throttle DRF + Cloudflare** — rejeitado (defesa em camada única; baixo nível Postgres é o gargalo verdadeiro).
2. **Caps duros na aplicação (8 tokens, 50 páginas) + caps suaves no Postgres role** ⭐
3. **Statement timeout global** — rejeitado (admin precisa de queries longas).

## Decision Outcome

**Chosen: Opção 2** — caps em duas camadas (aplicação + Postgres role).

### M2: Índice parcial `WHERE status = 'published'`

Já implícito (search_index só recebe published) mas reforça intent. ADR-030-DB endereça composite parciais.

### M3: `work_mem ≥ 64MB` no role `interpop_search_reader`

```sql
ALTER ROLE interpop_search_reader SET work_mem = '64MB';
```

Justificativa: bitmap heap scan vira **lossy** quando ultrapassa `work_mem`. Lossy = perde precisão de tuple location → recheck custa caro. 64MB no role (não global) evita afetar workers que não fazem busca.

### M4: `statement_timeout = '500ms'` no role de leitura

```sql
ALTER ROLE interpop_search_reader SET statement_timeout = '500ms';
```

Cap duro: query patológica é matada pelo Postgres em 500ms (antes do timeout HTTP padrão 30s ou Cloudflare 100s). Resposta 4xx tipada `query_timeout`. **Não aplicar globalmente** — admin/migrations precisam de queries longas.

### M5: Cache Redis ≥ 70% hit no top-100 Zipf

Já endereçado em ADR-024 (DRF throttling) + §2.4 DESIGN. Reforço: invalidação proativa em insert de artigo + staleness 5min para top-100. SearchService.query() check Redis ANTES de hit DB.

### Caps aplicação (`SearchService.query()`)

| Cap                          | Valor      | Resposta se excede             | Justificativa                                                   |
| ---------------------------- | ---------- | ------------------------------ | --------------------------------------------------------------- |
| Tokens significativos em `q` | 8          | `400 query_too_complex`        | Após strip stopwords; protege contra tsvector intersection caro |
| Tamanho de `q` cru           | 200 chars  | `400 query_too_long`           | Hard upper bound antes do tokenize                              |
| Profundidade de paginação    | 50 páginas | `400 refine_query`             | Cursor carrega `depth`; >50 incentiva refinamento               |
| Empty tsquery early-exit     | —          | `200 results:[]` (zero hit DB) | `q="o de da"` (só stopwords) curto-circuita; protege DB         |
| `gin_fuzzy_search_limit`     | 5000       | implícito — plan rows          | Planner aborta scan se candidatos > 5000                        |

### Positive Consequences

- p95 ≤ 300ms em 500k mesmo Zipf-head + lossless bitmap.
- DoS leve mitigado em camada Postgres (não só na aplicação).
- Erros tipados (4xx + código), não 502/504 silencioso.
- Caps são versionados (settings + migration), não "config do prod por SSH".

### Negative Consequences

- Configuração role exige migração one-shot via raw SQL (não Django ORM nativo).
- Usuário válido com query muito complexa recebe 400 (UX: mensagem deve sugerir refinar/usar filtros).
- `statement_timeout` no role exige discipline — todo worker da app que toca busca usa esse role; queries não-busca precisam role separado se forem longas.
- `gin_fuzzy_search_limit=5000` pode causar resultados subótimos em queries borderline (5000 candidates exatos) — aceitável trade-off.

## Implementation Notes

- **Task IDs**: TX-15 (postgres role tuning), T30.1.X4 (feature flag — guard adicional), T30.1.7 (caps em SearchService.query)
- **Migration**: criar role + GRANT + ALTER ROLE em migration ou script ops separado (decisão em open question #1 do DESIGN §5)
- **Settings**:
  ```python
  SEARCH_MAX_TOKENS = 8
  SEARCH_MAX_Q_LENGTH = 200
  SEARCH_MAX_PAGINATION_DEPTH = 50
  ```
- **Doc ops**: `docs/ops/postgres-tuning.md` com config role explícita
- **Test**: integration (cap tokens → 400), integration (depth 51 → 400), integration (`q="o de da"` → 0 queries Postgres via CaptureQueriesContext)
- **Referência DESIGN.md**: §2.3 (M1-M5), §3.4 (security)
- **Referência specialist**: `_specialist-outputs/02-algorithms-architect.md` linhas 40-50, 130-145, 195-205

## References

- DESIGN.md §2.3, §3.4
- `_specialist-outputs/02-algorithms-architect.md`
- ADR-021 (ts_rank_cd + recency — bloco indissociável)
- ADR-024 (DRF throttling — camada superior de defesa)
- Postgres docs — `gin_fuzzy_search_limit`, `statement_timeout`, `work_mem`
- OWASP — DoS via expensive queries (mitigation patterns)
