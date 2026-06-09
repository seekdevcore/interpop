# RNF-perf — Performance

> **Tipo**: Requisito Não-Funcional (transversal)
> **Prioridade**: 🟠 Alta (gate de release)
> **Status**: 🚧 Parcialmente verificado (baselines coletados; gates automatizados Sprint 5)

---

## Enunciado

Sistema entrega experiência percebida como rápida em qualquer dispositivo de leitor moderno (smartphone Android médio em 4G, desktop residencial em wifi).

### Métricas obrigatórias

| Métrica                                                | Alvo                        | Quando medir                                                                                           |
| ------------------------------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------ |
| **p95 de resposta server** (qualquer endpoint público) | ≤ 300ms em 50k artigos      | k6 load test sintético                                                                                 |
| **LCP (Largest Contentful Paint) p75**                 | ≤ 2.5s                      | Lighthouse Mobile + RUM (Sentry)                                                                       |
| **INP (Interaction to Next Paint)**                    | ≤ 200ms                     | Lighthouse + RUM                                                                                       |
| **CLS (Cumulative Layout Shift)**                      | ≤ 0.1                       | Lighthouse Mobile e Desktop                                                                            |
| **TTFB (Time To First Byte)**                          | ≤ 600ms                     | RUM, gate em prod                                                                                      |
| **Bundle JS inicial**                                  | ≤ 500 KB gzipped (toda app) | Lighthouse + `npm run build`                                                                           |
| **Delta de bundle por PR**                             | ≤ +20 KB gz vs main         | Lighthouse CI ([ADR-031-FE](../../specs/busca-editorial/adrs/ADR-031-FE-lighthouse-ci-gate-buscar.md)) |

### Estado atual (baseline TX-18, 2026-06-04)

| Setup              | Perf | LCP  | CLS   | Status NFR          |
| ------------------ | ---- | ---- | ----- | ------------------- |
| **prod / desktop** | 93   | 0.7s | 0.153 | ⚠️ CLS viola        |
| **prod / mobile**  | 81   | 3.1s | 0.176 | ❌ LCP + CLS violam |

**Flags pré-existentes** (não causadas pela busca):

- **CLS 0.15+** acima do limite 0.1 — provável webfonts sem `font-display: optional`/`size-adjust`, imagens hero sem dimensões explícitas
- **LCP mobile 3.1s** — provável imagem de cover do destaque sem `<link rel="preload">` + `fetchpriority="high"`

📌 **Task de mitigação**: TX-22 "Investigar e mitigar CLS pré-existente" — pendente Sprint 5.

---

## Realizado por (rastreabilidade ↓)

| Epic / Feature                                                                                                                   | Como atende                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [EP-10 Busca editorial](../../backlog/epics/EP-10-busca-editorial.md) → [F-30](../../backlog/features/F-30-busca-texto-livre.md) | CA02 (p95 ≤ 300ms server), CA07 (input fluido com useDeferredValue), CA11 (bundle ≤ +20 KB gz lazy) |
| Todos os Epics futuros                                                                                                           | DEVEM passar pelo gate Lighthouse CI antes de merge (TX-16 Sprint 5)                                |

---

## Como verificar (gates de CI propostos)

| Gate                                                                      | Status                                                  |
| ------------------------------------------------------------------------- | ------------------------------------------------------- |
| `npm run build` falha se bundle inicial > 500 KB gz                       | ⏳ Sprint 5                                             |
| Lighthouse CI em `/buscar?q=kpop` falha se delta > 20 KB gz ou LCP > 3.3s | ⏳ TX-16 Sprint 5                                       |
| k6 Zipfiano em CI nightly falha se p95 > 300ms                            | ⏳ TX-15 Sprint 5 (requer Postgres real em ambiente CI) |
| RUM Sentry alerta se p75 LCP em prod > 2.5s por 24h                       | ⏳ Sprint 6                                             |

---

## Restrições

- Hardware-base de teste: smartphone Android médio (Moto G ou Samsung A33), 4G normal — não premium.
- p95 medido em escala alvo (50k artigos); 500k artigos é meta de Sprint 7+ com partitioning (ver [ADR-031-DB](../../specs/busca-editorial/adrs/ADR-031-DB-particionamento-adiado.md)).

---

## Cross-references

- Baselines reais: [`docs/performance/`](../../performance/README.md) — 4 JSONs Lighthouse
- ADR de gate frontend: [ADR-031-FE](../../specs/busca-editorial/adrs/ADR-031-FE-lighthouse-ci-gate-buscar.md)
- ADRs de performance backend: [ADR-021 ranking](../../specs/busca-editorial/adrs/ADR-021-ts-rank-cd-recency-60d-cte-limit-500.md), [ADR-021b mitigações GIN](../../specs/busca-editorial/adrs/ADR-021b-mitigacoes-gin-pior-caso.md), [ADR-025 EXPLAIN](../../specs/busca-editorial/adrs/ADR-025-total-estimate-via-explain-com-floor.md), [ADR-034 vacuum](../../specs/busca-editorial/adrs/ADR-034-vacuum-tuning-gin-fastupdate.md)
