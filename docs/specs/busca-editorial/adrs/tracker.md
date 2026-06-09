# Tracker — ADR ↔ Task ↔ Test

> Cross-reference vivo. Atualizar à medida que `code-implementer` avança e PRs fecham.
> Status: `⏳ pending` · `🚧 in-progress` · `✅ done` · `❌ blocked`

---

## ADRs materializadas

| ADR        | Camada   | Task(s) BACKLOG                                                                                    | Test ID                                                                                                                                                                                | Sprint | Status impl |
| ---------- | -------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------- |
| ADR-015    | Software | T30.1.1, T30.1.2                                                                                   | t_arch_apps_search                                                                                                                                                                     | 4      | ⏳ pending  |
| ADR-016    | Software | T30.1.4                                                                                            | t_searchindex_isolated                                                                                                                                                                 | 4      | ⏳ pending  |
| ADR-017    | Software | T30.1.7                                                                                            | t_service_layer_pure                                                                                                                                                                   | 4      | ⏳ pending  |
| ADR-018    | DB       | T30.1.5b, T30.1.5c                                                                                 | t_trigger_sync, t_signal_cache_only                                                                                                                                                    | 4      | ⏳ pending  |
| ADR-019    | DB       | T30.1.4b                                                                                           | t_pt_unaccent_config                                                                                                                                                                   | 4      | ⏳ pending  |
| ADR-020    | DB       | TX-13 (runbook)                                                                                    | t_sqlite_dev_fallback                                                                                                                                                                  | 4      | ⏳ pending  |
| ADR-021    | Algo     | T30.1.7, T30.1.X2, T30.1.X3, T30.1.X5                                                              | t_recency_60d, t_cte_limit_500, t_normalize_symmetry                                                                                                                                   | 4      | ⏳ pending  |
| ADR-021b   | Algo     | TX-15, T30.1.X4                                                                                    | t_caps_8_tokens, t_depth_50, t_empty_tsquery_early_exit                                                                                                                                | 4      | ⏳ pending  |
| ADR-022    | Algo     | T30.1.X5 (server), T30.1.X10 (FE)                                                                  | t_query_terms_expanded, t_highlight_stems                                                                                                                                              | 4      | ⏳ pending  |
| ADR-023    | BE       | T30.1.8                                                                                            | t_endpoint_url, t_openapi_contract                                                                                                                                                     | 4      | ⏳ pending  |
| ADR-024    | BE       | T30.4.1, T30.4.2, T30.4.3, T30.4.4                                                                 | t_throttle_anon_30min, t_throttle_user_60min                                                                                                                                           | 4      | ⏳ pending  |
| ADR-025    | BE       | T30.1.X3                                                                                           | t_estimate_total_floor                                                                                                                                                                 | 4      | ⏳ pending  |
| ADR-026    | FE       | TX-18 (🔴 baseline)                                                                                | t_baseline_lighthouse                                                                                                                                                                  | 4      | ⏳ pending  |
| ADR-027    | FE       | T30.1.X6, T30.1.X7, T30.1.15, T30.1.16                                                             | t_debounced_value, t_get_next_page_param_null                                                                                                                                          | 4      | ⏳ pending  |
| ADR-028    | UI       | T30.1.X8                                                                                           | t_apg_no_combobox_violation                                                                                                                                                            | 4      | ⏳ pending  |
| ADR-029    | UI       | T30.1.X11                                                                                          | t_wcag_contrast_aaa, t_no_palette_fork                                                                                                                                                 | 4      | ⏳ pending  |
| ADR-030-DB | DB       | T30.1.3                                                                                            | t_partial_indexes, t_index_only_scan                                                                                                                                                   | 4      | ⏳ pending  |
| ADR-030-FE | FE       | T30.1.X9                                                                                           | t_resilient_subtree_error_boundary                                                                                                                                                     | 4      | ⏳ pending  |
| ADR-030-UI | UI       | T30.1.17, T30.2.1-T30.2.3                                                                          | t_chip_radius_md, t_card_thumb_left_density                                                                                                                                            | 4      | ⏳ pending  |
| ADR-031-DB | DB       | TX-14 (runbook)                                                                                    | n/a (roadmap doc)                                                                                                                                                                      | n/a    | ⏳ pending  |
| ADR-031-FE | FE       | TX-16                                                                                              | t_lhci_lcp_2500, t_lhci_inp_200, t_bundle_delta_20kb                                                                                                                                   | 4      | ⏳ pending  |
| ADR-032    | DB       | TX-13, T30.1.6b                                                                                    | t_backup_restore_reindex                                                                                                                                                               | 5      | ⏳ pending  |
| ADR-033    | DB       | n/a (doc only)                                                                                     | n/a                                                                                                                                                                                    | n/a    | ⏳ pending  |
| ADR-034    | DB       | T30.1.X1                                                                                           | t_vacuum_tuning_dead_tup                                                                                                                                                               | 4      | ⏳ pending  |
| ADR-035    | Security | T30.4.X1 (LGPD pseudonim. forte), TX-19 (search_log exclude backup), T30.4.X8 (purga cron alerta)  | t_hmac_pepper_rotation, t_timestamp_bucketed_5min, t_ip_prefix_class_b, t_purge_after_7d                                                                                               | 4      | ⏳ pending  |
| ADR-036    | Security | T30.4.X3 (throttle global), TX-20 (CF WAF doc), TX-21 (PG connection_limit)                        | t_global_throttle_500min, t_global_returns_503_retry_after                                                                                                                             | 4      | ⏳ pending  |
| ADR-037    | Security | T30.4.X4 (cache key + Vary)                                                                        | t_cache_key_includes_tier, t_anon_user_distinct_keys, t_no_per_user_fields, t_vary_header_present                                                                                      | 4      | ⏳ pending  |
| ADR-038    | Security | T30.4.X5 (semgrep custom)                                                                          | t_semgrep_detects_extra_where_bait, t_semgrep_detects_innerhtml_bait                                                                                                                   | 4      | ⏳ pending  |
| ADR-039    | Security | T30.4.X7 (test trigger bypass + ENABLE ALWAYS + cron audit)                                        | t_enable_always_resists_replica_role, t_drift_audit_query_zero                                                                                                                         | 4      | ⏳ pending  |
| ADR-040    | Testing  | T30.1.TY1 (setup Hypothesis), T30.1.TY8 (5 properties)                                             | t_normalize_idempotent, t_normalize_case_hyphen_symmetry, t_cursor_round_trip_round_6, t_query_deterministic_5_runs, t_cap_tokens_le_8                                                 | 4      | ⏳ pending  |
| ADR-041    | Testing  | T30.1.TY9 (schemathesis CI gate)                                                                   | t_schemathesis_response_schema_conformance, t_schemathesis_headers_conformance                                                                                                         | 4      | ⏳ pending  |
| ADR-042    | Testing  | T30.1.TY13 (Playwright visual regression 10 snapshots)                                             | visual*search_empty*{light,dark}, visual*search_results*{light,dark}, visual*search_error*{light,dark}, visual*search_no_results*{light,dark}, visual*search_rate_limited*{light,dark} | 4      | ⏳ pending  |
| ADR-043    | Testing  | T30.1.TY12 (mutmut BE + Stryker FE nightly)                                                        | n/a (CI workflow + auto-issue)                                                                                                                                                         | 5      | ⏳ pending  |
| ADR-044    | Testing  | T30.1.TY6 (seed-zipfian.py + k6 nightly)                                                           | t_k6_p95_le_300ms_under_zipfian_load                                                                                                                                                   | 4      | ⏳ pending  |
| ADR-045    | Testing  | TX-17 ampliada (jest-axe 8 estados), T30.1.TY5 (manual NVDA + VoiceOver), T30.1.TY7-axe-playwright | t_axe_violations_zero_light, t_axe_violations_zero_dark, t_axe_mobile_dialog, a11y_manual_checklist_2026-XX-XX                                                                         | 4      | ⏳ pending  |

---

## Gates por sprint

### Sprint 4 (esta entrega — MVP)

PR não merge sem:

- [ ] Todas as Tasks 🔴 Immediate concluídas
- [ ] ADRs materializadas referenciadas em commit messages
- [ ] Cov backend ≥85% local (TEST-STRATEGY §6)
- [ ] Cov frontend ≥80% local (TEST-STRATEGY §6)
- [ ] Lighthouse CI passa (ADR-031-FE)
- [ ] SECURITY-REVIEW Tasks H-01 a H-04 endereçadas
- [ ] `uv run pytest --cov-fail-under=40` global passa (gate atual do projeto)
- [ ] `npm run typecheck` passa (OpenAPI ↔ TS regenerado)

### Sprint 5

- [ ] ADR-032 implementado (backup lean em prod)
- [x] ADRs 035-045 materializadas (concluído 2026-06-03 via `documentation-engineer` segunda passada)
- [ ] ADR-043 implementado (mutation testing nightly)
- [ ] ADR-042 expandido para 24 snapshots (mobile + desktop)
- [ ] F-31 (filtros) + F-32 (deep-linking) cobertos

### Sprint 6

- [ ] Particionamento de search_index? **NÃO** (ADR-031-DB; gatilho não atingido)
- [ ] Refactor newsletter consumindo `SearchService.query()` (open question #8)
- [ ] GA da busca após 7d de monitoring estável

---

## Histórico de mudanças

| Data       | Mudança                                                                                                                                                                                 | Autor                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 2026-06-03 | Materialização inicial — 24 ADRs (15-34)                                                                                                                                                | documentation-engineer (6 ADRs) + main-loop (18 ADRs) |
| 2026-06-03 | ADRs 035-045 propostas pelos validadores; renumeração testing 035-040 → 040-045                                                                                                         | main-loop                                             |
| 2026-06-03 | Materialização dos 11 ADRs propostos (035-045) — security (035-039) + testing (040-045)                                                                                                 | documentation-engineer (segunda passada)              |
| 2026-06-03 | Fase 1 (DB schema) executada — 5 commits + 4 migrations + 34 tests                                                                                                                      | code-implementer                                      |
| 2026-06-04 | Fase 2 (Backend leitura) executada — 10 commits + 77 tests + 12 invariantes algorithms cobertos + REVIEW-PHASE-2 (APROVADO COM RESSALVAS)                                               | code-implementer + gsd-code-reviewer                  |
| 2026-06-04 | TX-18 baseline Lighthouse coletado (4 JSONs prod+dev × desktop+mobile)                                                                                                                  | main-loop                                             |
| 2026-06-06 | Fase 3 (Frontend MVP) executada — 9 commits + 64 tests + REVIEW-PHASE-3 (APROVADO COM RESSALVAS)                                                                                        | code-implementer + gsd-code-reviewer                  |
| 2026-06-06 | 6 fixes inline pós-REVIEW-PHASE-3 (2 BLOQUEIOs + 4 HIGHs) + 2 bugs descobertos no caminho (Skeleton landmark + MSW cross-origin) — 6 commits, 78 tests, BLOQUEIOs do PR US30.1 fechados | main-loop                                             |

---

## Status de implementação por ADR (atualizado 2026-06-06)

| ADR                                | Status impl         | Evidência                                                          |
| ---------------------------------- | ------------------- | ------------------------------------------------------------------ |
| 015-017 (Software)                 | ✅ done             | apps.search bootstrap + boundaries                                 |
| 018-019 (DB FTS)                   | ✅ done             | migrations 0001+0003                                               |
| 020 (SQLite fallback)              | ✅ done             | guard em 0001_initial                                              |
| 021 + 021b + 022 (Algo)            | ✅ done             | SearchService.query (12 invariantes) + caps + query_terms_expanded |
| 023-025 (Backend)                  | ✅ done             | SearchView + serializers + cursor + total_estimate                 |
| 026 + 027 (FE infra)               | ✅ done             | CSR + lazy + TanStack + useDebouncedValue + Bug 6 fix              |
| 028 (a11y combobox)                | ✅ done             | `<form role="search">` + `<input type="search">`                   |
| 029 (paleta herdada)               | ✅ done             | tokens novos sem fork; `--clr-cat-*` aplicado                      |
| 030-DB/FE/UI                       | ✅ done             | indexes + ErrorBoundary + chips + thumb-left                       |
| 031-DB                             | ⏳ doc only         | gatilho documentado (>100GB OR p95>250ms)                          |
| 031-FE                             | ⏳ pending          | TX-16 — gate Lighthouse CI em backlog                              |
| 032 (backup lean)                  | ⏳ pending          | Sprint 5 prod runbook                                              |
| 033 (single-tenant)                | ✅ done             | doc-only                                                           |
| 034 (vacuum tuning)                | ✅ done             | migration 0004                                                     |
| 035 (search_log pseudonim. forte)  | ⏳ pending          | Sprint 5 (T30.4.X1)                                                |
| 036 (throttle global)              | ✅ done             | SearchGlobalThrottle implementado                                  |
| 037 (cache SHA256+auth_tier)       | ✅ done             | `cache.py:build_cache_key`                                         |
| 038 (semgrep custom CI)            | ⏳ pending          | Sprint 5                                                           |
| 039 (trigger ENABLE ALWAYS)        | ✅ done             | migration 0005 + T30.1.5d                                          |
| 040 (property-based Hypothesis)    | ⏳ pending          | T30.1.X22 Sprint 5                                                 |
| 041 (contract schemathesis)        | ⏳ pending          | T30.1.TY4 Sprint 5                                                 |
| 042 (visual regression Playwright) | ⏳ pending          | T30.1.X20 Sprint 5                                                 |
| 043 (mutation Stryker)             | ⏳ pending          | Sprint 5                                                           |
| 044 (k6 Zipfiano)                  | ⏳ pending          | Sprint 5                                                           |
| 045 (axe-playwright + manual NVDA) | ✅ done (axe parte) | a11y.test.tsx 12 checks; manual NVDA via TX-20                     |

---

_Tracker vivo. Atualizar a cada PR que toca implementação. Estado em 2026-06-06: PR US30.1 destravado (0 BLOQUEIOs); 22/35 ADRs done, 13/35 em backlog Sprint 5._
