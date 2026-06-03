# ADRs — Busca Editorial Full-text

> Conjunto completo de **35 ADRs** materializados a partir do DESIGN.md v3 (§4 — tabela de ADRs), dos outputs literais dos 6 specialists (`software-architect`, `database-architect`, `algorithms-data-structures-architect`, `backend-architect`, `frontend-architect`, `ui-ux-architect`) e dos 2 validadores (`cyber-security-architect`, `testing-engineer`).
>
> ADRs **015-029** são as decisões principais por camada (DESIGN v2 + refinos v3); ADRs **030-034** são as decisões emergentes do refino v3 (novos achados dos specialists); ADRs **035-039** materializam as decisões de segurança da SECURITY-REVIEW.md; ADRs **040-045** materializam as decisões de teste da TEST-STRATEGY.md.
>
> Tag de variante (`-DB`, `-FE`, `-UI`) usada quando o mesmo número resolve decisões paralelas em camadas distintas.

---

## Índice por camada

### Software architecture (`software-architect`)

| ADR                                                           | Decisão                                             | Status   |
| ------------------------------------------------------------- | --------------------------------------------------- | -------- |
| [ADR-015](./ADR-015-busca-bounded-context-apps-search.md)     | Busca como bounded context separado (`apps.search`) | Accepted |
| [ADR-016](./ADR-016-cqrs-leve-searchindex-read-projection.md) | CQRS leve — SearchIndex como read-projection        | Accepted |
| [ADR-017](./ADR-017-service-layer-puro-sem-repository.md)     | Service Layer puro sem Repository abstrato          | Accepted |

### Database (`database-architect`)

| ADR                                                               | Decisão                                                            | Status     |
| ----------------------------------------------------------------- | ------------------------------------------------------------------ | ---------- |
| [ADR-018](./ADR-018-trigger-sql-fonte-verdade-consistencia.md)    | Trigger SQL = fonte de verdade; signal só cache invalidation       | Accepted ✱ |
| [ADR-019](./ADR-019-fts-pt-unaccent-configuration.md)             | FTS pt-BR via `CONFIGURATION pt_unaccent` (preserva `IMMUTABLE`)   | Accepted ✱ |
| [ADR-020](./ADR-020-sqlite-dev-fallback-icontains.md)             | SQLite dev = fallback `__icontains` documentado                    | Accepted   |
| [ADR-030-DB](./ADR-030-DB-composite-indexes-parciais-covering.md) | Composite indexes parciais (`WHERE NOT NULL`) + covering `INCLUDE` | Accepted ⊕ |
| [ADR-031-DB](./ADR-031-DB-particionamento-adiado.md)              | Particionamento adiado; gatilho `>100GB` OR `p95>250ms`            | Accepted ⊕ |
| [ADR-032](./ADR-032-backup-lean-exclude-search-index.md)          | Backup lean: `--exclude-table-data` + reindex pós-restore          | Accepted ⊕ |
| [ADR-033](./ADR-033-multi-tenancy-single-tenant.md)               | Multi-tenancy: single-tenant declarado                             | Accepted ⊕ |
| [ADR-034](./ADR-034-vacuum-tuning-gin-fastupdate.md)              | Vacuum tuning GIN — `fastupdate` + scale_factor 0.05               | Accepted ⊕ |

### Algorithms & Data Structures (`algorithms-data-structures-architect`)

| ADR                                                                | Decisão                                                                        | Status     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ---------- |
| [ADR-021](./ADR-021-ts-rank-cd-recency-60d-cte-limit-500.md)       | `ts_rank_cd` + recency 60d + CTE `LIMIT 500` + `query_terms_expanded`          | Accepted ✱ |
| [ADR-021b](./ADR-021b-mitigacoes-gin-pior-caso.md)                 | Mitigações pior caso GIN (`gin_fuzzy_search_limit`, `statement_timeout`, caps) | Accepted ⊕ |
| [ADR-022](./ADR-022-highlight-client-side-query-terms-expanded.md) | Highlight client-side com `query_terms_expanded` do server (não só `q`)        | Accepted ✱ |

### Backend (`backend-architect`)

| ADR                                                           | Decisão                                                           | Status   |
| ------------------------------------------------------------- | ----------------------------------------------------------------- | -------- |
| [ADR-023](./ADR-023-endpoint-api-v1-search-articles.md)       | Endpoint `GET /api/v1/search/articles/` (não `/articles/search/`) | Accepted |
| [ADR-024](./ADR-024-drf-throttling-sobre-django-ratelimit.md) | DRF throttling sobre `django-ratelimit`                           | Accepted |
| [ADR-025](./ADR-025-total-estimate-via-explain-com-floor.md)  | `total_estimate` via `EXPLAIN`, com floor por `len(results)`      | Accepted |

### Frontend (`frontend-architect`)

| ADR                                                                   | Decisão                                                                    | Status     |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------- |
| [ADR-026](./ADR-026-csr-no-mvp-medir-lcp-baseline.md)                 | CSR no MVP; medir LCP baseline antes; SSR re-avaliado em v2                | Accepted   |
| [ADR-027](./ADR-027-tanstack-query-usedebounced-deferred-url-ssot.md) | TanStack Query + `useDebouncedValue` 250ms + `useDeferredValue` + URL SSOT | Accepted ✱ |
| [ADR-030-FE](./ADR-030-FE-resilient-subtree-error-boundary.md)        | Resilient sub-tree `ErrorBoundary` local em `<SearchResults>`              | Accepted ⊕ |
| [ADR-031-FE](./ADR-031-FE-lighthouse-ci-gate-buscar.md)               | Lighthouse CI gate em `/buscar?q=kpop` bloqueia PR                         | Accepted ⊕ |

### UI/UX (`ui-ux-architect`)

| ADR                                                                   | Decisão                                                                                  | Status     |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------- |
| [ADR-028](./ADR-028-input-type-search-rejeita-combobox.md)            | `<input type="search">` semântico — `role="combobox"` rejeitado (APG)                    | Accepted ✱ |
| [ADR-029](./ADR-029-paleta-editorial-interpop-herdada.md)             | Busca herda paleta editorial (navy `#19144c` + Newsreader + Inter); rejeita fork ardósia | Accepted ✱ |
| [ADR-030-UI](./ADR-030-UI-filter-chips-radius-md-cards-thumb-left.md) | Filter chips `radius-md` (não pill); cards thumb-left 120×80                             | Accepted ⊕ |

### Security (`cyber-security-architect` — SECURITY-REVIEW.md)

| ADR                                                                              | Decisão                                                                                     | Status     |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------- |
| [ADR-035](./ADR-035-pseudonimizacao-forte-search-log.md)                         | Pseudonimização forte do `search_log` (bucket 5min + HMAC-pepper rotativo + IP/16 ou drop)  | Accepted ⊕ |
| [ADR-036](./ADR-036-throttle-global-search-endpoint.md)                          | Throttle global do endpoint de busca (`SearchGlobalThrottle 500/min`) somado ao per-IP/user | Accepted ⊕ |
| [ADR-037](./ADR-037-cache-key-sha256-auth-tier-vary-header.md)                   | Cache key `SHA256(canonical+auth_tier)` + invariante de não-mistura auth/anônimo + `Vary`   | Accepted ⊕ |
| [ADR-038](./ADR-038-semgrep-custom-rules-ci-proibir-innerhtml-extra-where.md)    | Semgrep custom rules em CI — proibir `dangerouslySetInnerHTML` + `extra(where=)`            | Accepted ⊕ |
| [ADR-039](./ADR-039-test-integration-trigger-bypass-session-replication-role.md) | Test integration de não-bypass de trigger SQL + `ENABLE ALWAYS` + cron de auditoria         | Accepted ⊕ |

### Testing (`testing-engineer` — TEST-STRATEGY.md)

| ADR                                                                                | Decisão                                                                                | Status     |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------- |
| [ADR-040](./ADR-040-property-based-testing-hypothesis-invariantes-dominio.md)      | Property-based testing via Hypothesis para 5 invariantes-propriedade do algorithms     | Accepted ⊕ |
| [ADR-041](./ADR-041-contract-testing-schemathesis-openapi-ts-codegen.md)           | Contract testing via schemathesis sobre OpenAPI `drf-spectacular` — bloqueia merge     | Accepted ⊕ |
| [ADR-042](./ADR-042-visual-regression-playwright-screenshots-5-estados-2-temas.md) | Visual regression Playwright `toHaveScreenshot` para 5 estados × 2 temas × 2 viewports | Accepted ⊕ |
| [ADR-043](./ADR-043-mutation-testing-stryker-searchservice-usesearch.md)           | Mutation testing (mutmut BE + Stryker FE) nightly em `SearchService` + `useSearch`     | Accepted ⊕ |
| [ADR-044](./ADR-044-k6-load-test-seed-zipfiano-reproducible.md)                    | k6 load test com seed Zipfiano reprodutível + Postgres efêmero + p95 ≤300ms gate       | Accepted ⊕ |
| [ADR-045](./ADR-045-a11y-e2e-axe-playwright-manual-nvda-voiceover.md)              | A11y E2E via `@axe-core/playwright` + checklist manual NVDA/VoiceOver gravado          | Accepted ⊕ |

---

## Legenda

- **✱** = decisão **revisada/ampliada** no refino v3 (specialist contestou v2)
- **⊕** = decisão **nova** descoberta no refino v3 ou pelos validadores
- **Accepted** = consolidada, `code-implementer` pode usar
- **Proposed** = aguarda confirmação em open question (DESIGN.md §5)

---

## Renumeração testing 035-040 → 040-045

`testing-engineer` propôs originalmente IDs 035-040; `cyber-security-architect` já havia ocupado 035-039. Testing renumerado para 040-045 para resolver colisão. Mapeamento:

| Original (TEST-STRATEGY.md §8)  | Final                                                                       | Camada       |
| ------------------------------- | --------------------------------------------------------------------------- | ------------ |
| ADR-035 (Property-based)        | ADR-040                                                                     | Testing      |
| ADR-036 (Contract testing)      | ADR-041                                                                     | Testing      |
| ADR-037 (Mutation testing)      | ADR-043                                                                     | Testing      |
| ADR-038 (Visual regression)     | ADR-042                                                                     | Testing      |
| ADR-039 (Trigger test protocol) | absorvido por ADR-039 (Security — bypass test) e por TX-20 da TEST-STRATEGY | —            |
| ADR-040 (A11y 3 camadas)        | ADR-045                                                                     | Testing      |
| — (novo)                        | ADR-044 (k6 Zipfiano)                                                       | Testing/Perf |

---

## Cross-reference de leitura

- **Quem implementa**: comece por [DESIGN.md §6](../DESIGN.md) (ordem de implementação) e [BACKLOG.md](../BACKLOG.md) (Tasks 🔴 Immediate primeiro).
- **Quem revisa**: leia [SECURITY-REVIEW.md](../SECURITY-REVIEW.md) e [TEST-STRATEGY.md](../TEST-STRATEGY.md) antes de aprovar PR.
- **Quem audita**: cada ADR cita Task ID no BACKLOG e seção §X.Y do DESIGN — rastreabilidade completa.

---

_Materializado em 2026-06-03 — 6 ADRs via `documentation-engineer` (015-020), 18 ADRs via main-loop (021-034) após bater limite de sessão do agent, **11 ADRs via `documentation-engineer` segunda passada (035-045)** materializando SECURITY-REVIEW.md (035-039) + TEST-STRATEGY.md renumerado (040-045)._
