# ADR-034: Vacuum tuning GIN — `fastupdate = on` + `gin_pending_list_limit` + `scale_factor` agressivo

- **Status**: Accepted (novo v3)
- **Date**: 2026-06-03
- **Tags**: database, postgres, vacuum, gin, autovacuum, write-amplification
- **Stakeholders**: database-architect (autor), code-implementer, sre-runbook
- **Layer**: DB

## Context

GIN indexes têm comportamento especial:

- Sem `fastupdate`, cada insert/update no `search_vector` faz upsert direto no GIN — caro (B-tree-like leaf traversal).
- `fastupdate = on` armazena entries em **pending list**; flush periódico move para o índice principal. Pending list = buffer.
- `gin_pending_list_limit` controla quando flush dispara (default 4MB; recomendado 2MB para tabelas write-heavy).
- `autovacuum_vacuum_scale_factor` (default 0.2 = 20%) é alto demais para `search_index` que sofre updates frequentes — pending list cresce demais sem ser flushed via autovacuum.

Specialist `database-architect` definiu config explícita:

## Decision Drivers

- p95 estável (sem picos quando pending list flusha em massa)
- Autovacuum frequente o bastante para manter pending list pequena
- KVM 1 com I/O limitado: write throughput não pode saturar

## Considered Options

1. **Defaults Postgres** — pending list cresce, flushes pontuais geram spike.
2. **Tuning explícito em ALTER TABLE/INDEX** ⭐
3. **Manual VACUUM via cron** — duplica responsabilidade com autovacuum.

## Decision Outcome

**Chosen: Opção 2**.

### Migration `0004_search_vacuum_tuning`

```sql
-- GIN: ativa fastupdate, define limite pending list
ALTER INDEX idx_search_vector_gin SET (
    fastupdate = on,
    gin_pending_list_limit = '2MB'
);

-- Autovacuum agressivo em search_index (table-level)
ALTER TABLE search_index SET (
    autovacuum_vacuum_scale_factor = 0.05,    -- vacuum quando 5% modificado (vs 20%)
    autovacuum_analyze_scale_factor = 0.02,   -- analyze quando 2% modificado
    autovacuum_vacuum_cost_delay = '10ms'     -- pacing throttle (vs 20ms default)
);
```

### Por que cada parâmetro?

| Parâmetro                         | Default | Valor escolhido | Razão                                                              |
| --------------------------------- | ------- | --------------- | ------------------------------------------------------------------ |
| `fastupdate`                      | on      | on              | Confirmar explícito; permite VACUUM manual desativar se necessário |
| `gin_pending_list_limit`          | 4MB     | 2MB             | Flushes mais frequentes e pequenos → spikes menores                |
| `autovacuum_vacuum_scale_factor`  | 0.2     | 0.05            | Vacuum 4× mais frequente                                           |
| `autovacuum_analyze_scale_factor` | 0.1     | 0.02            | Statistics fresh para planner (plan_rows do ADR-025)               |
| `autovacuum_vacuum_cost_delay`    | 20ms    | 10ms            | Throughput melhor; KVM 1 I/O tolera                                |

### Monitoring obrigatório

Prometheus metrics (via postgres_exporter):

- `pg_stat_user_tables_n_dead_tup{table="search_index"}` — alert > 5000.
- `pg_stat_user_tables_last_autovacuum{table="search_index"}` — alert > 24h sem autovacuum.
- `pg_stat_bgwriter_buffers_clean_total` — sinal de pressure.

### Positive Consequences

- p95 estável (sem spike de pending list flush em massa).
- Autovacuum mantém dead tuples baixo.
- Plan_rows do ADR-025 fica preciso (analyze fresh).

### Negative Consequences

- Mais I/O em autovacuum (mas pacing throttle suaviza).
- Config table-level (não global) — não afeta outras tabelas, mas exige memória de revisão.

## Implementation Notes

- **Task IDs**: T30.1.X1 (vacuum tuning migration)
- **Migration**: `0004_search_vacuum_tuning` com SQL puro (não há ORM op para ALTER TABLE SET)
- **Monitoring**: configurar em `docs/ops/postgres-monitoring.md`
- **Test**: integration smoke (após 1000 inserts + 100 updates, `n_dead_tup < 100`)
- **Referência DESIGN.md**: §2.2
- **Referência specialist**: `_specialist-outputs/01-database-architect.md`

## References

- DESIGN.md §2.2
- `_specialist-outputs/01-database-architect.md`
- ADR-018 (trigger SQL — gera inserts no search_index)
- ADR-021 (planner statistics fresh são críticos)
- ADR-025 (plan_rows depende de analyze)
- Postgres docs — `gin_pending_list_limit`, GIN fastupdate, autovacuum tuning
