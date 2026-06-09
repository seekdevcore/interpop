# ADR-025: `total_estimate` via `EXPLAIN`, não `COUNT(*)`, com floor por `len(results)`

- **Status**: Accepted
- **Date**: 2026-06-03
- **Tags**: backend, performance, postgres, count-vs-estimate, ux
- **Stakeholders**: backend-architect (autor), database-architect, frontend-architect, code-implementer
- **Layer**: Backend

## Context

UX da página `/buscar` mostra "142 resultados". Forças:

- `SELECT COUNT(*) FROM search_index WHERE search_vector @@ q AND ...` em 500k com Zipf-head escaneia 200k linhas → +400ms só no count.
- `COUNT(*)` em GIN não usa index-only scan (precisa visibility check via heap).
- Postgres planner já produz estimativa de linhas via `EXPLAIN (FORMAT JSON) SELECT ...`. Custo: ~5ms.
- Frustração de UX: "1 resultado encontrado" mas página vazia → bug clássico de estimativa enganosa quando rows reais > 0 mas plan_rows = 0.

## Decision Drivers

- p95 ≤ 200ms backend efetivo (budget §3.3 DESIGN)
- UX consistente (count nunca menor que resultados visíveis)
- Sem dependência de cache pré-aquecido

## Considered Options

1. **`COUNT(*)` exato em paralelo à query principal** — rejeitado (custo dobra).
2. **`EXPLAIN` plan_rows com floor por `len(results)`** ⭐
3. **Sentinela "200+"** se total > 200 — rejeitado (UX inferior).
4. **Sem count** — rejeitado (NFR UX exige).

## Decision Outcome

**Chosen: Opção 2** com floor.

### Implementação

```python
def estimate_total(
    results: list,
    per_page: int,
    plan_rows: int,
    page_count: int,
) -> int:
    """
    Floor: nunca menor que `len(results)` da página atual + páginas anteriores
    conhecidas via cursor depth.
    """
    floor = (page_count - 1) * per_page + len(results)
    return max(plan_rows, floor)
```

Execução paralela com a query principal:

```python
plan_json = connection.cursor().execute(
    "EXPLAIN (FORMAT JSON) " + query_sql, params
).fetchone()[0]
plan_rows = plan_json[0]["Plan"]["Plan Rows"]
```

Custo ~5ms (vs 400ms COUNT) — vale o trade.

### Caveat: plan_rows pode ser muito errado

Postgres planner usa estatísticas; em queries seletivas Zipf-tail, plan_rows pode estimar 100 quando real é 3. Floor por `len(results)` corrige o caso "1 resultado mas página vazia":

- Página 1, `len(results) = 20`, plan_rows = 15 → mostra `max(15, 20) = 20`.
- Página 3, `len(results) = 7`, plan_rows = 10, page_count = 3, per_page = 20 → mostra `max(10, 2*20 + 7) = 47`.

### UI exibição

`<p>{total_estimate} resultado{total_estimate !== 1 ? 's' : ''}</p>` com sufixo `~` quando `plan_rows > floor` (diferenciador semântico):

- Se `plan_rows ≤ floor`: "47 resultados" (exato — vimos todos).
- Se `plan_rows > floor`: "~142 resultados" (estimado).

### Positive Consequences

- p95 backend ≤ 200ms (sem +400ms do COUNT).
- UX nunca mostra count menor que resultados visíveis.
- Sinalização clara de estimado (`~`) vs exato.

### Negative Consequences

- Plan_rows pode estar errado em Zipf-tail extremo (plan diz 1, real é 50). Floor mitiga parcial.
- `EXPLAIN` toca o planner mas não executa — não 100% confiável em queries com parameters voláteis.
- Frontend precisa lidar com sufixo `~` (lógica + i18n futuro).

## Pros and Cons of the Options

### Opção 1 — COUNT(\*) exato

- 👍 Exato.
- 👎 +400ms; NFR violado.

### Opção 2 — EXPLAIN + floor ⭐

- 👍 ~5ms; NFR respeitado.
- 👍 UX correto (floor).
- 👎 Estimativa pode divergir do real.

### Opção 3 — Sentinela "200+"

- 👍 Barato.
- 👎 UX inferior ("quantos exatamente?").

## Implementation Notes

- **Task IDs**: T30.1.X3 (`estimate_total()` com floor)
- **Settings**: nenhuma
- **Test**: unit (`estimate_total(results=20, per_page=20, plan_rows=15, page_count=1) == 20`); integration (plan_rows real > 1000, retornado correto)
- **Referência DESIGN.md**: §2.4 (backend), §2.2 (DB)
- **Referência specialist**: `_specialist-outputs/01-database-architect.md` (Bug discutido sobre estimativa)

## References

- DESIGN.md §2.4
- `_specialist-outputs/01-database-architect.md`
- ADR-021 (algoritmo principal)
- Postgres docs — `EXPLAIN (FORMAT JSON)`, planner statistics
