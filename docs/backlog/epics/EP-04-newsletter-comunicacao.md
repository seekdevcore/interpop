# EP-04 — Newsletter + comunicação

> **Tipo**: Epic
> **Status**: 🚧 Em progresso (preenchimento retroativo pendente)
> **Prioridade global**: 🟠 Alta

---

## Visão de produto

> **STUB** — descrição a expandir em Sprint de housekeeping. Por enquanto, o módulo correspondente existe em código e está documentado em [`docs/architecture/overview.md`](../../architecture/overview.md).

---

## Requisitos realizados (rastreabilidade ↑)

| ID                                                     | Requisito                  | Tipo           |
| ------------------------------------------------------ | -------------------------- | -------------- |
| RF-004 (newsletter)                                    | ver pasta requirements/RF/ | Funcional      |
| [RNF-security](../../requirements/RNF/RNF-security.md) | OWASP + auth + DRF perms   | Segurança      |
| [RNF-a11y](../../requirements/RNF/RNF-a11y.md)         | WCAG 2.2 AA                | Acessibilidade |

---

## Features sob este Epic (rastreabilidade ↓)

| ID   | Nome                                   | Sprint | Status  |
| ---- | -------------------------------------- | ------ | ------- |
| F-40 | Subscribe + welcome email              | 2      | ✅ Done |
| F-41 | Per-article notification (Celery task) | 3      | ✅ Done |
| F-42 | Unsubscribe 1-click via token URL      | 2      | ✅ Done |

---

## Cross-references

- [Improvement-system.md](../../planning/Improvement-system.md) — backlog mestre pré-reorg
- [architecture/overview.md §5](../../architecture/overview.md)

_Stub criado em 2026-06-09 (chore/docs-reorg). Preencher retroativamente em Sprint dedicado de housekeeping. Não bloqueia Sprint 5 (busca)._
