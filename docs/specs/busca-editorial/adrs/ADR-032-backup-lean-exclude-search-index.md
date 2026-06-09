# ADR-032: Backup lean — `--exclude-table-data=search_index` + reindex pós-restore

- **Status**: Accepted (novo v3)
- **Date**: 2026-06-03
- **Tags**: database, backup, disaster-recovery, postgres, dr-rto, lgpd
- **Stakeholders**: database-architect (autor), cyber-security-architect, code-implementer
- **Layer**: DB (DR)

## Context

`search_index` é **read-projection** (ADR-016) — deriva de `articles`. Incluí-lo no backup full:

- Aumenta tamanho ~20% (50k → ~120MB GIN + dados).
- Aumenta banda de transferência em backups externos (S3, Backblaze).
- LGPD: dados pessoais em search_log estão no backup (retention 7d local, mas backup pode reter meses).

## Decision Drivers

- Reduzir tamanho/banda de backup
- LGPD: reduzir surface de dados pessoais em backup
- RTO acceptable (+10min para reindex)
- Backup → restore reproduce search_index sem erro

## Considered Options

1. **Backup full (incluir search_index e search_log)** — paga +20% sem ganho.
2. **`--exclude-table-data` em search_index; reindex pós-restore** ⭐
3. **`--exclude-table-data` em ambos search_index e search_log** — escolhido para search_log também (LGPD-friendly).

## Decision Outcome

**Chosen: Opção 2 + extensão para search_log**.

### Comando pg_dump

```bash
pg_dump \
  --exclude-table-data=search_index \
  --exclude-table-data=search_log \
  --format=custom \
  -f interpop_$(date +%Y%m%d).backup \
  $DATABASE_URL
```

### Restore + reindex

```bash
# 1. Restore (sem dados de search_index/search_log)
pg_restore --clean --if-exists -d $DATABASE_URL interpop_*.backup

# 2. Reindex search (reconstrói search_index a partir de articles)
uv run python manage.py reindex_search --parallel=4

# 3. search_log começa do zero (dados de 7d se perdem — aceitável LGPD-friendly)
```

### systemd hook (opcional)

`docs/ops/runbook-dr.md` documenta:

```ini
# postgres-restore.service
[Service]
ExecStartPost=/opt/interpop/bin/reindex_search.sh --parallel=4
```

### Tempos estimados

| Tamanho `articles` | reindex --parallel=4 |
| ------------------ | -------------------- |
| 50k                | ~1min                |
| 500k               | ~10min               |

RTO impact: +10min vs RTO atual. RPO inalterado.

### LGPD-friendly bonus

`search_log` (hash 16 chars + IP /24 + user hash + timestamp) tem retention 7d em prod via cron. Sem backup, vazamento de backup antigo expõe < 7d de dados. **Trade-off**: forensics retroativa fica impossível. Aceitável (auditoria de busca usa `apps.audit` se necessário).

### Positive Consequences

- Backup -20% tamanho/banda.
- LGPD: search_log fora do backup reduz surface.
- Restore documentado e testado.

### Negative Consequences

- +10min RTO.
- Forensics retroativa de busca impossível pós-restore.
- Reindex falha → estado parcial; documentar fallback.

## Implementation Notes

- **Task IDs**: TX-13 (runbook DR), T30.1.6b (reindex --parallel)
- **Scripts**: `scripts/backup-prod.sh`, `scripts/restore-and-reindex.sh`
- **Test**: smoke local — backup + drop search_index + restore + reindex → search funciona
- **Referência DESIGN.md**: §2.2, §3.4
- **Referência specialist**: `_specialist-outputs/01-database-architect.md`

## References

- DESIGN.md §2.2
- `_specialist-outputs/01-database-architect.md`
- ADR-016 (read-projection — justifica derivabilidade)
- ADR-018 (trigger SQL — garante consistência pós-restore)
- pg_dump docs — `--exclude-table-data`
- LGPD Art. 16 (eliminação de dados pessoais)
