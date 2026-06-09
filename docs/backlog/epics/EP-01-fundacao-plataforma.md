# EP-01 — Fundação da plataforma

> **Tipo**: Epic
> **Status**: ✅ Done (Sprint 1) — preenchimento retroativo pendente
> **Prioridade global**: 🔴 Imediato

---

## Visão de produto

Tudo o que precisava existir ANTES de qualquer feature de produto: Django funcional, autenticação JWT em cookie httpOnly, settings split por ambiente, observability mínima (`/healthz/`, structlog, AuditLog), CI verde com gates de cobertura, deploy reproduzível.

Esta fundação é **a razão** de a US30.1 ter sido entregue em 7 dias — sem ela, busca exigiria 4 semanas.

---

## Requisitos realizados (rastreabilidade ↑)

| ID                                                             | Requisito                                                    | Tipo            |
| -------------------------------------------------------------- | ------------------------------------------------------------ | --------------- |
| [RF-005](../../requirements/RF/RF-005-users-auth.md)           | Sistema autentica leitor via login/senha com cookie httpOnly | Funcional       |
| [RF-006](../../requirements/RF/RF-006-audit.md)                | Sistema registra eventos sensíveis em log auditável          | Funcional       |
| [RNF-security](../../requirements/RNF/RNF-security.md)         | OWASP Top 10 baseline                                        | Segurança       |
| [RNF-availability](../../requirements/RNF/RNF-availability.md) | /healthz/ + UptimeRobot + runbooks                           | Disponibilidade |
| [RNF-perf](../../requirements/RNF/RNF-perf.md)                 | Bundle ≤ 500 KB gz, p95 ≤ 300ms                              | Performance     |

---

## Features sob este Epic

> **STUB** — preencher retroativamente em Sprint dedicado. Por enquanto, features desta fundação vivem dispersas no [Improvement-system.md §6 Sprint 1](../../planning/Improvement-system.md).

| ID   | Nome                                                           | Sprint | Status  |
| ---- | -------------------------------------------------------------- | ------ | ------- |
| F-01 | Bootstrap Django + uv + DRF + settings split                   | 1      | ✅ Done |
| F-02 | Auth JWT em cookie httpOnly + django-axes + roles              | 1      | ✅ Done |
| F-03 | Observability (structlog JSON + Sentry + AuditLog + /healthz/) | 1      | ✅ Done |
| F-04 | CI + cobertura 40% gate + SAST + secret scan                   | 1      | ✅ Done |
| F-05 | Vite + React 19 + tsc + eslint + prettier                      | 1      | ✅ Done |

---

## ADRs relacionadas

- [ADR-005 Hostinger KVM 1](../../planning/adrs/ADR-005-hostinger-kvm1.md)
- [ADR-006 DevSecOps embedded](../../planning/adrs/ADR-006-devsecops-embedded.md)
- [ADR-010 /api/v1/ versioning](../../planning/adrs/ADR-010-api-v1-versioning.md)
- [ADR-012 Integridade transacional](../../planning/adrs/ADR-012-integridade-transacional.md)
- [ADR-013 Observability gate](../../planning/adrs/ADR-013-observability-gate.md)

---

## Cross-references

- [Sprint 1 (Improvement-system.md §6)](../../planning/Improvement-system.md)
- [architecture/overview.md](../../architecture/overview.md)

_Stub criado em 2026-06-09 (chore/docs-reorg). Preencher retroativamente em Sprint dedicado de housekeeping._
