# EP-10 — Busca editorial

> **Tipo**: Epic
> **Status**: 🚧 Sprint 4 (F-30 ✅ Done · F-31/F-32 ⏳ Sprint 5)
> **Prioridade global**: 🟠 Alta
> **Owner**: Gabriel Marques
> **Criado em**: Sprint 4 (2026-06-02) · **Encerramento previsto**: Sprint 5

---

## Visão de produto

Interpop é leitura longa. Quanto mais artigos publicamos, mais leitores se perdem tentando encontrar o que já leram OU descobrir um tema específico. Busca editorial resolve isso: leitor digita um termo, encontra artigos relevantes ordenados por **relevância** e **recência**, com possibilidade de filtrar por autor, editoria e intervalo de datas, e de compartilhar a busca via URL.

KPI alvo pós-launch:

- ≥ 40% dos leitores autenticados usam busca ao menos uma vez em 7 dias
- +15% em sessões com >2 páginas vistas
- p95 de tempo de resposta server ≤ 300ms em 50k artigos

---

## Requisitos realizados (rastreabilidade ↑)

Este Epic executa os seguintes requisitos:

| ID                                                        | Requisito                                                    | Tipo           |
| --------------------------------------------------------- | ------------------------------------------------------------ | -------------- |
| [RF-007](../../requirements/RF/RF-007-busca-editorial.md) | Sistema permite busca por texto livre nos artigos publicados | Funcional      |
| [RNF-perf](../../requirements/RNF/RNF-perf.md)            | p95 ≤ 300ms server, LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1       | Performance    |
| [RNF-security](../../requirements/RNF/RNF-security.md)    | Throttle 30/60/500 min, HMAC cursor, XSS-safe highlight      | Segurança      |
| [RNF-a11y](../../requirements/RNF/RNF-a11y.md)            | WCAG 2.2 AA em todos os 5 estados da busca                   | Acessibilidade |
| [RNF-lgpd](../../requirements/RNF/RNF-lgpd.md)            | search_log retention 7d com pseudonimização                  | LGPD           |

---

## Features sob este Epic (rastreabilidade ↓)

| ID   | Nome                                | Sprint | Status                             | Arquivo                                        |
| ---- | ----------------------------------- | ------ | ---------------------------------- | ---------------------------------------------- |
| F-30 | Busca por texto livre               | 4      | ✅ Done (PR #37, commit `2bdf73b`) | [F-30](../features/F-30-busca-texto-livre.md)  |
| F-31 | Filtros (autor, editoria, datas)    | 5      | ⏳ Pending                         | [F-31](../features/F-31-filtros-busca.md)      |
| F-32 | URL deep-linking + compartilhamento | 5      | ⏳ Pending                         | [F-32](../features/F-32-deep-linking-busca.md) |

---

## Métricas de sucesso do Epic

| Métrica                 | Alvo                                  | Como medir                                 | Status                       |
| ----------------------- | ------------------------------------- | ------------------------------------------ | ---------------------------- |
| Cobertura de descoberta | ≥ 40% MAU autenticado usa busca em 7d | Analytics (próximo Sprint)                 | ⏳ baseline pendente         |
| Performance             | p95 ≤ 300ms server em 50k artigos     | k6 load test Zipfiano (T30.1.X22 Sprint 5) | ⏳                           |
| Retenção                | +15% sessões > 2 páginas              | Comparação 30d pré/pós-launch              | ⏳                           |
| Acessibilidade          | 0 violações axe-core nos 5 estados    | CI gate `a11y.test.tsx` 12 cenários        | ✅                           |
| Bundle                  | Buscar lazy ≤ +20 KB gz               | Lighthouse CI gate (TX-16 Sprint 5)        | 🟡 manual hoje (14.54 KB gz) |

---

## ADRs relacionadas (decisões locked-in)

35 ADRs materializadas em [`docs/specs/busca-editorial/adrs/`](../../specs/busca-editorial/adrs/) — destaques por camada:

- **Arquitetura**: ADR-015 (bounded context `apps.search`), ADR-016 (CQRS leve), ADR-017 (Service Layer)
- **DB**: ADR-018 (trigger SQL = SSOT), ADR-019 (CONFIGURATION pt_unaccent), ADR-021/021b (ts_rank_cd + recency 60d + CTE 500), ADR-039 (ENABLE ALWAYS)
- **Backend**: ADR-023 (URL `/api/v1/search/articles/`), ADR-024 (DRF throttle), ADR-025 (total_estimate EXPLAIN)
- **Frontend**: ADR-026 (CSR), ADR-027 (TanStack + useDebouncedValue), ADR-028 (`<input type="search">`), ADR-030-FE (resilient sub-tree)
- **UI**: ADR-029 (paleta herdada), ADR-030-UI (chips radius-md + thumb-left)
- **Segurança**: ADR-035-039 (pseudonim. forte, throttle global, cache key, semgrep, trigger bypass test)
- **Testing**: ADR-040-045 (Hypothesis, schemathesis, Playwright visual, Stryker, k6, axe)

---

## Sprints envolvidas

| Sprint   | Escopo                                             | Status                 | Arquivo                                                                      |
| -------- | -------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------- |
| Sprint 4 | F-30 (US30.1 + base de F-31/F-32)                  | ✅ entregue 2026-06-09 | [sprint-4-busca-editorial](../sprints/sprint-4-busca-editorial.md)           |
| Sprint 5 | F-31 + F-32 + 11 tasks pendentes do REVIEW-PHASE-3 | ⏳ planejado           | [sprint-5-filtros-deep-linking](../sprints/sprint-5-filtros-deep-linking.md) |

---

## Histórico de mudanças

| Data       | Evento                                                                      |
| ---------- | --------------------------------------------------------------------------- |
| 2026-06-02 | Epic criado em spec multi-agente (6 specialists + 2 validators + DESIGN v3) |
| 2026-06-03 | 35 ADRs materializadas + BACKLOG v5                                         |
| 2026-06-04 | F-30 implementada e revisada (Phases 1/2/3)                                 |
| 2026-06-06 | F2-B-01/02/03 fechados; PR #37 ready                                        |
| 2026-06-09 | PR #37 squash-merged em main como `2bdf73b`; F-30 ✅ Done                   |

---

_Última atualização: 2026-06-09. Próxima ação: arrancar Sprint 5 com F-31/F-32._
