# Design — <Nome da Feature em pt-BR>

> **Versão**: v1 · **Data**: YYYY-MM-DD · **Feature**: [F-NN](../../backlog/features/F-NN-slug.md) · **Sprint**: N
> **Modo de execução**: <Quick / Medium / Large / Complex>
> **Specialists envolvidos**: <opcional, se Complex>

---

## 0. Problem statement (1 parágrafo de negócio)

> Em pt-BR explícito, sem termo técnico. O que o leitor/editor/admin não consegue fazer hoje? Por que isso dói? Que requisito ([RF-NNN](../../requirements/RF/RF-NNN.md)) esta feature realiza?

---

## 1. Decomposition map (camadas envolvidas)

| Camada                                 | Toca?   | Specialist responsável                 | Output             |
| -------------------------------------- | ------- | -------------------------------------- | ------------------ |
| Software (arquitetura cross-app)       | sim/não | `software-architect`                   | §2.1               |
| Database (schema + migrations)         | sim/não | `database-architect`                   | §2.2               |
| Algorithms & data structures           | sim/não | `algorithms-data-structures-architect` | §2.3               |
| Backend (Django app + DRF)             | sim/não | `backend-architect`                    | §2.4               |
| Frontend (React + state + routing)     | sim/não | `frontend-architect`                   | §2.5               |
| UI/UX (componentes + tokens + a11y)    | sim/não | `ui-ux-architect`                      | §2.6               |
| Segurança (auth + LGPD + threat model) | sim/não | `cyber-security-architect`             | SECURITY-REVIEW.md |
| Testing                                | sempre  | `testing-engineer`                     | TEST-STRATEGY.md   |

---

## 2. Layer decisions

### 2.1 Software architecture

[Bounded context novo? Estende app existente? Justificativa com referência a princípios DDD/Common Closure.]

ADRs novos: <lista>

### 2.2 Database

[Schema, migrations, indexes, triggers, vacuum. SQL completo de cada migration.]

ADRs novos: <lista>

### 2.3 Algorithms

[Estruturas de dados, complexidade, invariantes, edge cases. Mostre números (constants check).]

ADRs novos: <lista>

### 2.4 Backend

[Endpoint, serializers, permissions, throttle, cache, observability.]

ADRs novos: <lista>

### 2.5 Frontend

[Routing, state, hooks, services. Padrão de comunicação com backend.]

ADRs novos: <lista>

### 2.6 UI/UX

[Tokens, componentes, estados visíveis, a11y, dark mode, mobile.]

ADRs novos: <lista>

---

## 3. Cross-layer decisions (orquestrador)

| Tema                | Decisão                                            |
| ------------------- | -------------------------------------------------- |
| Contrato API ↔ FE   | <ex.: drf-spectacular + openapi-typescript>        |
| Naming consistency  | <padrão para nomes de campo, endpoint, componente> |
| Perf budget split   | <quanto rede + quanto backend + quanto frontend>   |
| Security trade-offs | <cursor HMAC? cache key? rate limit por tier?>     |
| Testability         | <handoff para testing-engineer>                    |

---

## 4. ADRs (lista completa nesta feature)

Tabela mostrando todas as ADRs novas em `adrs/`. Detalhe completo em [adrs/INDEX.md](adrs/INDEX.md).

| ID      | Título   | Layer                     | Status            |
| ------- | -------- | ------------------------- | ----------------- |
| ADR-NNN | <titulo> | software/db/algo/be/fe/ui | Proposed/Accepted |

---

## 5. Open questions (escalar ao usuário ANTES de implementar)

1. <pergunta gray-area>
2. <…>

---

## 6. Implementation order — handoff `code-implementer`

Fases (dias estimados):

**Fase 1 — DB schema** (X dias)

- T<task IDs>

**Fase 2 — Backend** (X dias)

- T<task IDs>

**Fase 3 — Frontend** (X dias)

- T<task IDs>

---

## 7. Verification gates (CA × testes)

| CA (do F-NN) | Teste(s) que verifica |
| ------------ | --------------------- |
| CA01         | <test path:linha>     |
| ...          | ...                   |

---

## 8. Spec bundle pronto para `code-implementer`

- [ ] DESIGN.md (este)
- [ ] ADRs em `adrs/`
- [ ] OpenAPI sketch (se aplicável)
- [ ] Schema + migration plan
- [ ] Algorithm invariants
- [ ] UI tokens + estados
- [ ] Test plan por layer
- [ ] Security review (se aplicável)
- [ ] Test strategy review (se Complex)
- [ ] F-NN.md atualizada em docs/backlog/features/

---

## Cross-references

- [Feature](../../backlog/features/F-NN-slug.md)
- [Requisito](../../requirements/RF/RF-NNN.md)
- [Sprint](../../backlog/sprints/sprint-N.md)
- [Architecture overview](../codebase/ARCHITECTURE.md)

---

_Template criado em 2026-06-09. Copiar para nova feature: `cp -r docs/specs/_template docs/specs/<slug>`._
