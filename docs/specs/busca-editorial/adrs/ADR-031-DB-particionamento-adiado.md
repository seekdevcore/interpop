# ADR-031-DB: Particionamento adiado; gatilho `>100GB` OR `p95>250ms` por 2 semanas

- **Status**: Accepted (novo v3)
- **Date**: 2026-06-03
- **Tags**: database, postgres, partitioning, deferred-decision, scaling-trigger
- **Stakeholders**: database-architect (autor), code-implementer, sre-runbook
- **Layer**: DB

## Context

Postgres 16 suporta RANGE partitioning por `published_at`. Em escala (>500k), partitioning oferece:

- Pruning automático em queries com filtro de data.
- VACUUM mais barato (partição por partição).
- DROP de partições antigas barato (sem DELETE massivo).

**Mas**: introduzir partitioning hoje (com 50k registros) é overhead injustificado:

- Triggers via `BEFORE INSERT ON partitioned_table` adicionam latência.
- Migration de unpartitioned → partitioned exige downtime ou pg_partman (complexidade).
- Postgres 16 partitioning não suporta GIN sobre coluna particionada como root-level (precisa criar GIN em cada partição).

## Decision Drivers

- KISS no MVP (50k → 500k em 5 anos não exige partitioning hoje)
- Gatilho explícito e mensurável para mudança
- Roadmap documentado em runbook

## Considered Options

1. **Partitioning desde o início** — overhead injustificado MVP.
2. **Adiar com gatilho explícito documentado** ⭐
3. **Nunca particionar** — depende de escala atingir limite.

## Decision Outcome

**Chosen: Opção 2**.

### Gatilhos de mudança (qualquer um → criar issue de migração)

| Métrica                      | Limite                             | Origem da medição                           |
| ---------------------------- | ---------------------------------- | ------------------------------------------- |
| Tamanho `search_index`       | > 100GB                            | `pg_total_relation_size`                    |
| p95 query Zipf-head          | > 250ms por 2 semanas consecutivas | Sentry / Prometheus                         |
| GIN index size               | > 30GB                             | `pg_relation_size('idx_search_vector_gin')` |
| Autovacuum não termina em 1h | qualquer ocorrência                | autovacuum logs                             |

### Plano futuro (esboço, não implementar agora)

```sql
-- 1. Cria nova tabela particionada
CREATE TABLE search_index_partitioned (LIKE search_index INCLUDING ALL)
PARTITION BY RANGE (published_at);

-- 2. Cria partições por ano
CREATE TABLE search_index_y2024 PARTITION OF search_index_partitioned
  FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
CREATE TABLE search_index_y2025 PARTITION OF search_index_partitioned
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
-- ...

-- 3. Copia dados (online via pg_partman ou janela de manutenção)

-- 4. Rename + drop antiga
```

### Doc ops

`docs/ops/scaling-triggers.md` documenta gatilhos + procedimento. Monitoring Prometheus alerta quando passa de 80GB ou p95 220ms (early warning).

### Positive Consequences

- KISS preservado.
- Gatilho objetivo (não "quando alguém lembrar").
- Plano futuro esboçado evita pânico quando precisar.

### Negative Consequences

- Equipe pode esquecer monitoring — runbook mitiga.
- Migração futura exige downtime ou pg_partman.

## Implementation Notes

- **Task IDs**: TX-14 (doc scaling triggers no runbook)
- **Settings**: nenhuma
- **Test**: nenhuma (decisão de roadmap)
- **Referência DESIGN.md**: §2.2 (DB)
- **Referência specialist**: `_specialist-outputs/01-database-architect.md`

## References

- DESIGN.md §2.2
- `_specialist-outputs/01-database-architect.md`
- ADR-018 (trigger SQL — funciona em partitioned table com pequena adaptação)
- ADR-030-DB (composite indexes — replicam por partição)
- Postgres docs — Declarative Partitioning, RANGE
- pg_partman docs — automatic partition management
