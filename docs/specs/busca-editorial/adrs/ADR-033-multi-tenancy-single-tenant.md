# ADR-033: Multi-tenancy — single-tenant declarado

- **Status**: Accepted (novo v3 — clarificação)
- **Date**: 2026-06-03
- **Tags**: database, multi-tenancy, architecture, scope
- **Stakeholders**: database-architect (autor), software-architect, code-implementer
- **Layer**: DB / Architecture

## Context

Multi-tenancy é decisão estrutural: schema shared vs schema-per-tenant vs database-per-tenant. Específico para Interpop:

- Interpop é **uma marca editorial** (single brand, single editorial team).
- Não há previsão de "Interpop White Label para terceiros".
- ADR-015 (apps.search bounded context) não tem trace de `tenant_id`.

Specialist `database-architect` documentou: **single-tenant declarado** para evitar:

- `tenant_id` em `search_index` (write amp inútil).
- Composite indexes incluírem `tenant_id` primeiro (overhead).
- Lógica condicional no SearchService (`filter(tenant_id=X)`).

## Decision Drivers

- Escopo do produto (single brand editorial)
- KISS — não pagar overhead de multi-tenant sem demanda
- Possibilidade de re-avaliar (gatilho explícito)

## Considered Options

1. **Single-tenant declarado** ⭐
2. **Multi-tenant ready (tenant_id em todas tabelas)** — over-engineering.
3. **Schema-per-tenant** — fora de escopo.

## Decision Outcome

**Chosen: Opção 1**.

### Declaração explícita

- `search_index` NÃO tem `tenant_id`.
- `search_log` NÃO tem `tenant_id`.
- `SearchService.query()` NÃO recebe `tenant`.
- Documento `docs/architecture/multi-tenancy-stance.md` (novo) registra: "Interpop é single-tenant. Re-avaliar se [gatilho]."

### Gatilho de re-avaliação

| Condição                                               | Ação          |
| ------------------------------------------------------ | ------------- |
| Decisão de produto: vender Interpop White Label        | ADR-NNN ABRIR |
| Aquisição/fusão com outra marca editorial              | ADR-NNN ABRIR |
| Não-objetivos atuais (LGPD multi-data-controller etc.) | Manter        |

### Migration path futura (caso ative)

1. Add `tenant_id UUID` em `articles`, `search_index`, `search_log`.
2. Backfill `tenant_id = 'interpop-default-uuid'`.
3. Modificar composite indexes para `(tenant_id, ...)` first.
4. Update SearchService para receber `tenant` do request.
5. RLS Postgres (opcional) para defense-in-depth.

Estimativa: 3 sprints.

### Positive Consequences

- Zero overhead estrutural inútil.
- Indexes menores, queries simples.
- Decisão documentada (não implícita).

### Negative Consequences

- Refactor doloroso se multi-tenant chegar — mas gatilho é decisão de produto, não emergência.

## Implementation Notes

- **Task IDs**: nenhuma (decisão de não-fazer); documentar em `docs/architecture/multi-tenancy-stance.md`
- **Test**: nenhuma
- **Referência DESIGN.md**: §2.2 (DB; multi-tenancy declarado)
- **Referência specialist**: `_specialist-outputs/01-database-architect.md`

## References

- DESIGN.md §2.2
- `_specialist-outputs/01-database-architect.md`
- ADR-015 (apps.search bounded context — single-tenant implícito)
- Postgres docs — Row Security Policies (para se multi-tenant ativar futuramente)
