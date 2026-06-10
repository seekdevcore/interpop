# Sprint 4 — Busca editorial

> **Período**: 2026-06-02 → 2026-06-09 (~7 dias de trabalho)
> **Tema**: Implementar busca editorial full-text como fundação de descoberta
> **Status**: ✅ Encerrado (PR #37 squash-merged em main como `2bdf73b` em 2026-06-09)

---

## Objetivos

1. Entregar US30.1 (busca por texto livre) end-to-end com qualidade de produção
2. Estabelecer fundação para Sprint 5 (filtros + deep-linking) sem retrabalho
3. Manter cobertura de testes ≥ 80% backend, ≥ 80% frontend `pages/Buscar/`
4. Zero regressão em features existentes
5. Honrar todos os ADRs aprovados na spec multi-agente

---

## Escopo (Epics e Features)

| Tipo    | ID                                             | Nome                  | Status                                  |
| ------- | ---------------------------------------------- | --------------------- | --------------------------------------- |
| Epic    | [EP-10](../epics/EP-10-busca-editorial.md)     | Busca editorial       | 🚧 (F-30 done; resto Sprint 5)          |
| Feature | [F-30](../features/F-30-busca-texto-livre.md)  | Busca por texto livre | ✅ Done                                 |
| Feature | [F-31](../features/F-31-filtros-busca.md)      | Filtros               | ⏳ Sprint 5 (shell vazia entregue)      |
| Feature | [F-32](../features/F-32-deep-linking-busca.md) | Deep-linking          | ⏳ Sprint 5 (URL SSOT parcial entregue) |

---

## User Stories executadas

| ID     | Título                                   | Story Points | Status  |
| ------ | ---------------------------------------- | ------------ | ------- |
| US30.1 | Leitor faz busca rápida pelo termo livre | 8            | ✅ Done |

---

## Tasks 🔴 Imediato concluídas (com commit hash)

| ID        | Descrição                                        | Commit               |
| --------- | ------------------------------------------------ | -------------------- |
| T30.1.4b  | Migration 0001 — CONFIGURATION pt_unaccent       | `103e5ea`            |
| T30.1.5b  | Migration 0003 — triggers SQL                    | `df98846`            |
| T30.1.5d  | Migration 0005 — ENABLE ALWAYS triggers          | `ffb88f6`            |
| T30.1.X6  | useDebouncedValue 15 LoC                         | `ce18826`            |
| T30.1.X7  | Bug 6 fix `?? undefined`                         | `2259605`            |
| T30.1.X8  | `<input type="search">` (rejeita combobox)       | `816e3fb`            |
| T30.1.X12 | MSW handlers + worker DEV-only                   | `ffa5150`, `2bdf681` |
| T30.1.X13 | a11y.test.tsx vitest-axe + fix Skeleton landmark | `cbb9001`            |
| TX-18     | Baseline Lighthouse coletada                     | `284997a`            |
| T30.4.B1  | F2-B-01 — @transaction.atomic                    | `14649d7`            |
| T30.4.B2  | F2-B-02 — Cache-Control private autenticado      | `2362305`            |
| T30.4.B3  | F2-B-03 — HMAC hard-fail em prod                 | `96cdad5`            |

_(Tabela completa em [F-30](../features/F-30-busca-texto-livre.md#tasks-implementação))._

---

## Métricas finais

| Métrica                    | Resultado                                   |
| -------------------------- | ------------------------------------------- |
| Tests backend              | **325 passed** + 27 skipped (Postgres-only) |
| Tests frontend             | **78 passed** em 10 files                   |
| Total                      | **403 passing, 0 regression**               |
| Cov `apps.search`          | ≥ 85% local                                 |
| Cov `pages/Buscar` (Lines) | **84.15%**                                  |
| Bundle Buscar lazy         | 14.54 KB gz (gate ≤ +20 KB ✅)              |
| ADRs materializadas        | 35 (em `specs/busca-editorial/adrs/`)       |
| CI checks no PR #37        | **15/15 pass**                              |
| Code reviews aplicados     | 3 (Phases 1/2/3) — todos ≥ 🟠 corrigidos    |

---

## Reviews

| Review                                                          | Veredito final                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------ |
| [REVIEW-PHASE-1](../../specs/busca-editorial/REVIEW-PHASE-1.md) | APROVADO COM RESSALVAS → fixes aplicados em commits Sprint 4 |
| [REVIEW-PHASE-2](../../specs/busca-editorial/REVIEW-PHASE-2.md) | APROVADO COM RESSALVAS → F2-B-01/02/03 fechados              |
| [REVIEW-PHASE-3](../../specs/busca-editorial/REVIEW-PHASE-3.md) | APROVADO COM RESSALVAS → 2 BLOQUEIOs + 4 HIGHs fechados      |

---

## Lições aprendidas (continuar / evitar / experimentar)

### Continuar

- Spec multi-agente antes de implementar — 10 bugs reais detectados antes de uma linha de código
- 3 code reviews por fase + fix inline (não acumular dívida)
- BDD em Gherkin pt-BR como contrato de aceitação (não só "smoke manual")

### Evitar

- Confiar em commit message como contrato (BLOQUEIO-2 do REVIEW-PHASE-3: commit dizia `[a11y axe-core]` mas zero imports)
- Push sem rotação de secret crítica em prod (F2-B-03 quase foi para prod com `SEARCH_CURSOR_HMAC_SECRET == SECRET_KEY`)
- 60 commits acumulados antes do PR — exigiu squash que apagou granularidade

### Experimentar (Sprint 5)

- PRs menores por Feature (não por Epic completo)
- Branchar direto de `main` por Feature (não acumular em `develop`)
- Visual regression via Playwright `toHaveScreenshot` para 5 estados

---

## Cross-references

- [Epic EP-10](../epics/EP-10-busca-editorial.md)
- [Spec técnica DESIGN.md v3](../../specs/busca-editorial/DESIGN.md)
- PR mergeado: [seekdevcore/interpop#37](https://github.com/seekdevcore/interpop/pull/37)
- Próximo Sprint: [Sprint 5](sprint-5-filtros-deep-linking.md)
