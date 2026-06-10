# Sprint 5 — Filtros + Deep-linking + dívidas técnicas da busca

> **Período**: TBD (planejado pós-Sprint 4 — Junho 2026)
> **Tema**: Completar EP-10 com filtros funcionais + URL SSOT + endurecimento operacional
> **Status**: ⏳ Pending kickoff

---

## Objetivos

1. Entregar F-31 (filtros autor/editoria/datas) e F-32 (deep-linking + compartilhamento)
2. Fechar as 11 Tasks restantes do REVIEW-PHASE-3 marcadas como 🟡 Normal
3. Estabelecer Lighthouse CI gate automatizado (TX-16) — sai do "manual"
4. Materializar runbook de DR + scaling triggers
5. Endurecer pseudonimização LGPD do search_log (ADR-035)

---

## Escopo (Features)

| Tipo    | ID                                             | Nome                             | Status entrada |
| ------- | ---------------------------------------------- | -------------------------------- | -------------- |
| Feature | [F-31](../features/F-31-filtros-busca.md)      | Filtros (autor, editoria, datas) | ⏳ Pending     |
| Feature | [F-32](../features/F-32-deep-linking-busca.md) | URL deep-linking + share         | ⏳ Pending     |

---

## Tasks restantes do REVIEW-PHASE-3 (alocadas aqui)

| ID        | Descrição                                                                                      | Prioridade |
| --------- | ---------------------------------------------------------------------------------------------- | ---------- |
| T30.1.X18 | Tests para `useSearchParamsState` (NaN guard, replace vs push)                                 | 🟡         |
| T30.1.X19 | Test AbortSignal cancelando `fetchSearch`                                                      | 🟡         |
| T30.1.X20 | Visual regression Playwright `toHaveScreenshot` 5 estados                                      | 🟡         |
| T30.1.X21 | E2E Playwright (input → results → load-more → article)                                         | 🟡         |
| T30.1.X22 | Property-based (fast-check) `useDebouncedValue` + `canonicalKey`                               | 🟡         |
| T30.1.X23 | Avaliar custom 30-LoC highlighter vs mark.js 8 KB gz                                           | ⚪         |
| T30.1.X24 | i18n extract strings pt-BR para `src/i18n/`                                                    | ⚪         |
| TX-13     | Runbook DR — `pg_dump --exclude-table-data` + reindex pós-restore                              | 🟡         |
| TX-14     | Doc scaling triggers — `>100GB OR p95>250ms`                                                   | ⚪         |
| TX-15     | Role Postgres `interpop_search_reader` (statement_timeout + work_mem + gin_fuzzy_search_limit) | 🟠         |
| TX-16     | Lighthouse CI gate em `/buscar?q=kpop` bloqueia PR                                             | 🟠         |
| TX-17     | jest-axe + axe-playwright nos 5 estados E2E                                                    | 🟠         |
| TX-20     | NVDA + VoiceOver manual checklist                                                              | 🟡         |
| TX-22     | Investigar e mitigar CLS pré-existente (0.15+)                                                 | 🟠         |

---

## Tasks novas previstas para F-31

T31.1-T31.7 — ver [F-31](../features/F-31-filtros-busca.md#tasks-previstas).

## Tasks novas previstas para F-32

T32.1-T32.4 — ver [F-32](../features/F-32-deep-linking-busca.md#tasks-previstas).

---

## Tasks de segurança alocadas (do SECURITY-REVIEW.md)

| ID       | Descrição                                                                                                                                                                                       | Prioridade |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| T30.4.X1 | Pseudonimização forte search_log (HMAC pepper + bucket 5min + IP/16) ([ADR-035](../../specs/busca-editorial/adrs/ADR-035-pseudonimizacao-forte-search-log.md))                                  | 🟠         |
| T30.4.X5 | Semgrep custom rules em CI (proibir `extra(where=)` + `dangerouslySetInnerHTML`) ([ADR-038](../../specs/busca-editorial/adrs/ADR-038-semgrep-custom-rules-ci-proibir-innerhtml-extra-where.md)) | 🟡         |
| T30.4.X7 | Test integration de não-bypass de trigger SQL ([ADR-039](../../specs/busca-editorial/adrs/ADR-039-test-integration-trigger-bypass-session-replication-role.md))                                 | 🟡         |

---

## Definition of Done do Sprint

- [ ] F-31 ✅ Done — todos os CAs 16-21 verificados
- [ ] F-32 ✅ Done — todos os CAs 22-27 verificados
- [ ] Lighthouse CI ativo em `.github/workflows/lhci.yml` bloqueando PRs
- [ ] Visual regression Playwright snapshot baseline criado
- [ ] Pseudonimização LGPD forte ativa em search_log
- [ ] Runbook DR escrito + smoke teste (`pg_dump --exclude-table-data` + reindex)
- [ ] Cobertura `pages/Buscar` ≥ 85%, `apps.search` ≥ 90%
- [ ] EP-10 inteiro pode ser movido para `done/` (F-30/F-31/F-32 todos done)

---

## Cross-references

- Sprint anterior: [Sprint 4](sprint-4-busca-editorial.md)
- Próximo Sprint: [Sprint 6 — Supabase evaluation](sprint-6-supabase-evaluation.md)
- Epic ativo: [EP-10](../epics/EP-10-busca-editorial.md)
