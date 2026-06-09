# EP-05 — Moderação da comunidade

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
| RF-003 (moderation)                                    | ver pasta requirements/RF/ | Funcional      |
| [RNF-security](../../requirements/RNF/RNF-security.md) | OWASP + auth + DRF perms   | Segurança      |
| [RNF-a11y](../../requirements/RNF/RNF-a11y.md)         | WCAG 2.2 AA                | Acessibilidade |

---

## Features sob este Epic (rastreabilidade ↓)

| ID   | Nome                                        | Sprint | Status  |
| ---- | ------------------------------------------- | ------ | ------- |
| F-50 | Ban direto pelo admin                       | 2      | ✅ Done |
| F-51 | BanRequest (editor solicita → admin decide) | 2      | ✅ Done |
| F-52 | Admin imune a ban entre si (invariante)     | 2      | ✅ Done |

---

## Cross-references

- [Improvement-system.md](../../planning/Improvement-system.md) — backlog mestre pré-reorg
- [architecture/overview.md §5](../../architecture/overview.md)

_Stub criado em 2026-06-09 (chore/docs-reorg). Preencher retroativamente em Sprint dedicado de housekeeping. Não bloqueia Sprint 5 (busca)._
