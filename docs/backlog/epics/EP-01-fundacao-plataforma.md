# EP-01 — Fundação da plataforma

> **Tipo**: Epic
> **Status**: ✅ Done em código (Sprint 1, pre-busca) · 🚧 Documentação retroativa parcial (F-01 detalhada; F-03/F-04/F-05 stubs)
> **Prioridade global**: 🔴 Imediato
> **Owner**: Gabriel Marques
> **Criado em**: Sprint 1 (pre-2026-05) · **Encerrado em**: Sprint 1 (entrega contínua)

---

## Visão de produto

Tudo o que precisava existir **antes** de qualquer feature editorial: Django funcional com settings split por ambiente, autenticação JWT em cookie httpOnly com hierarquia de papéis, observability mínima (`/healthz/`, structlog JSON, AuditLog, Sentry), CI verde com gates de cobertura, frontend bootstrap com Vite + React 19 + TypeScript, deploy reproduzível no Hostinger KVM 1.

Esta fundação é **a razão** de F-30 (busca editorial) ter sido entregue em 7 dias — sem ela, busca exigiria 4 semanas refazendo auth, CI, observability do zero.

**Recorte honesto deste Epic**: EP-01 cobre a **fundação técnica horizontal**. Ferramentas administrativas (hierarquia operada, banimento direto, management commands de staff) vivem em [EP-06](EP-06-administracao-sistema.md) porque tocam autoridade editorial, não infraestrutura.

---

## Requisitos realizados (rastreabilidade ↑)

| ID                                                             | Requisito                                                                              | Tipo            | Cobertura por este Epic                                    |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------- |
| [RF-005](../../requirements/RF/RF-005-users-auth.md)           | Autenticação e autorização de usuários (registro, login, rotação, recuperação, papéis) | Funcional       | **Parcial** — fluxos do leitor; ferramentas staff em EP-06 |
| [RF-006](../../requirements/RF/RF-006-audit.md)                | Sistema registra eventos sensíveis em log auditável                                    | Funcional       | Total — AuditLog está nesta fundação                       |
| [RNF-security](../../requirements/RNF/RNF-security.md)         | OWASP Top 10 baseline, CSRF, headers seguros, secret scan em CI                        | Segurança       | Total (gates em F-04)                                      |
| [RNF-availability](../../requirements/RNF/RNF-availability.md) | `/healthz/` + UptimeRobot + runbooks de deploy/restart                                 | Disponibilidade | Total (em F-03)                                            |
| [RNF-perf](../../requirements/RNF/RNF-perf.md)                 | Bundle ≤ 500 KB gz, p95 backend ≤ 300ms, baseline Lighthouse                           | Performance     | Parcial — baseline em F-05; gates em CI futuro             |

---

## Features sob este Epic (rastreabilidade ↓)

| ID   | Nome                                                             | Sprint | Status                               | Doc                                                                                    |
| ---- | ---------------------------------------------------------------- | ------ | ------------------------------------ | -------------------------------------------------------------------------------------- |
| F-01 | **Autenticação JWT em cookie httpOnly**                          | 1      | ✅ Done                              | [F-01](../features/F-01-autenticacao-jwt-cookie-httponly.md) — doc retroativa completa |
| F-02 | Bootstrap Django + uv + DRF + settings split                     | 1      | ✅ Done · 🚧 Doc retroativa pendente | _stub_ (housekeeping futuro)                                                           |
| F-03 | Observability (structlog JSON + Sentry + AuditLog + `/healthz/`) | 1      | ✅ Done · 🚧 Doc retroativa pendente | _stub_ (housekeeping futuro)                                                           |
| F-04 | CI + cobertura 40% gate + SAST (bandit/semgrep) + secret scan    | 1      | ✅ Done · 🚧 Doc retroativa pendente | _stub_ (housekeeping futuro)                                                           |
| F-05 | Frontend bootstrap (Vite + React 19 + tsc + ESLint + Prettier)   | 1      | ✅ Done · 🚧 Doc retroativa pendente | _stub_ (housekeeping futuro)                                                           |

> **Prioridade da retroatividade**: F-01 foi detalhada agora porque concentra o maior risco aberto (S-02, S-04, S-06 — débitos de segurança). F-02/F-03/F-04/F-05 entram em Sprint de housekeeping dedicado quando o ciclo de produto permitir — não bloqueiam Sprint 5.

---

## Métricas de sucesso do Epic

| Métrica                                  | Alvo                                        | Status                                                                                        |
| ---------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Tempo até primeira feature de produto    | ≤ 4 semanas pós-bootstrap                   | ✅ — F-30 (busca) entregue em 7 dias após Sprint 1                                            |
| Cobertura de testes backend (gate CI)    | ≥ 40% Sprint 1                              | ✅ — 82% efetivo (88 testes)                                                                  |
| `/healthz/` uptime medido externamente   | ≥ 99.5% mensal                              | ✅ — UptimeRobot ativo desde Sprint 1                                                         |
| CI bloqueia PR com queda de cobertura    | Gate ativo                                  | ✅ — `.github/workflows/ci.yml` falha se cobertura desce                                      |
| Auth funcional sem regressão em produção | 0 incidentes Sev-1/2 em auth desde Sprint 1 | ✅ — C1 (rotação silenciosa) e C3 (atomicidade reset) eram bugs latentes, não incidentes prod |

---

## ADRs relacionadas

- [ADR-005 Hostinger KVM 1](../../planning/adrs/ADR-005-hostinger-kvm1.md) — hospedagem
- [ADR-006 DevSecOps embedded](../../planning/adrs/ADR-006-devsecops-embedded.md) — security no PR loop
- [ADR-008 DPO/LGPD baseline](../../planning/adrs/ADR-008-dpo-lgpd-baseline.md) — princípios LGPD que F-01 herda
- [ADR-010 `/api/v1/` versioning](../../planning/adrs/ADR-010-api-v1-versioning.md) — prefixo de todas as rotas (inclusive `/api/v1/auth/*`)
- [ADR-012 Integridade transacional](../../planning/adrs/ADR-012-integridade-transacional.md) — atomicidade em mutações multi-tabela (origina fix C3 de F-01)
- [ADR-013 Observability gate](../../planning/adrs/ADR-013-observability-gate.md) — `/healthz/` + structlog + Sentry obrigatórios

---

## Sprints envolvidas

| Sprint   | Escopo                                                                 | Status                                |
| -------- | ---------------------------------------------------------------------- | ------------------------------------- |
| Sprint 1 | F-01 + F-02 + F-03 + F-04 + F-05 (todas em paralelo, fundação técnica) | ✅ entregue (pre-busca, pre-Sprint 4) |
| Sprint 4 | F-30 busca — primeira feature de produto sobre esta fundação           | ✅ entregue 2026-06-09 (PR #37)       |

---

## Histórico de mudanças

| Data       | Evento                                                                                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sprint 1   | Epic executado em código — F-01 a F-05 entregues em paralelo. Fundação habilitou as Sprints subsequentes (Sprint 2-3 produto editorial, Sprint 4 busca). |
| 2026-05-XX | Fix C1 (rotação silenciosa) + Fix C3 (atomicidade reset) — débitos identificados em revisão do `Improvement-system.md` §11.1.                            |
| 2026-06-09 | Documentação retroativa: F-01 detalhada (CAs, USs, BDD, Tasks); F-02/F-03/F-04/F-05 mantidas como stubs para Sprint de housekeeping futuro.              |

---

## Cross-references

- [Sprint 1 (Improvement-system.md §6)](../../planning/Improvement-system.md) — registro operacional original
- [F-01 Autenticação JWT em cookie httpOnly](../features/F-01-autenticacao-jwt-cookie-httponly.md) — única Feature deste Epic com doc retroativa completa
- [EP-06 Administração do sistema](EP-06-administracao-sistema.md) — Epic complementar para ferramentas operadas de staff (banimento, comandos)
- [Architecture overview](../../architecture/overview.md)
- [DESIGN.md users-auth](../../specs/users-auth/DESIGN.md)
- [RF-005](../../requirements/RF/RF-005-users-auth.md), [RF-006](../../requirements/RF/RF-006-audit.md)
- [CLAUDE.md §4](../../../CLAUDE.md) — convenções de hierarquia `dev > admin > editor > user`

---

_Última atualização: 2026-06-09 (doc retroativa parcial). Próxima ação: detalhar F-02/F-03/F-04/F-05 em Sprint de housekeeping; aplicar hotfix S-02 (`JWT_SIGNING_KEY` hard-fail) replicando padrão F2-B-03 da busca._
