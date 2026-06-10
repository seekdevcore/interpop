# RNF-availability — Disponibilidade e degradação graciosa

> **Tipo**: Requisito Não-Funcional (transversal)
> **Prioridade**: 🟠 Alta
> **Status**: ✅ Baseline atendido

---

## Enunciado

Sistema deve estar disponível para leitor anônimo (leitura de artigos) **mesmo quando subsistemas opcionais falham** (newsletter, busca, comentários, cache). Falhas devem ser detectadas em < 1min e ter caminho de degradação documentado.

### Métricas

| Métrica                            | Alvo                                 | Como medir                                     |
| ---------------------------------- | ------------------------------------ | ---------------------------------------------- |
| **Uptime mensal**                  | ≥ 99% (43 min downtime/mês tolerado) | UptimeRobot externo bate `/healthz/` cada 1min |
| **Tempo de detecção**              | < 1 min                              | UptimeRobot alert → Telegram/SMS               |
| **MTTR (Mean Time To Recovery)**   | < 30 min para incidentes do runbook  | Histórico de postmortems                       |
| **RPO (Recovery Point Objective)** | ≤ 24h (último backup diário)         | pg_dump cron + B2 offsite                      |
| **RTO (Recovery Time Objective)**  | ≤ 4h (re-deploy + restore)           | Scripts em `HOSTING-DEPLOY-PLAN.md`            |

### Padrões de degradação graciosa

| Falha                       | Comportamento esperado                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| **Redis down**              | Cache cai em LocMemCache por worker; busca/sessões funcionam, throttle relaxa              |
| **Celery down**             | Newsletter/email atrasados (queue persistente em Redis); usuário não bloqueia              |
| **Search feature flag OFF** | `/api/v1/search/articles/` retorna 503 + `Retry-After: 60`; frontend mostra mensagem clara |
| **DB connection exhausted** | nginx retorna 503 + Retry-After; runbook em `docs/runbooks/`                               |
| **SMTP down**               | Welcome/notification atrasados; usuário vê mensagem "vai chegar em alguns minutos"         |
| **OG crawler timeout**      | Middleware devolve HTML básico sem cards ricos; crawler retry                              |
| **Disco cheio**             | nginx 503 + alert; runbook `disk-full.md` instrui purge                                    |

### Health check (`GET /healthz/`)

```json
{
  "status": "ok" | "degraded" | "error",
  "db": "ok" | "error",
  "cache": "ok" | "error"
}
```

- < 50ms p99 (gate de monitor)
- Sem autenticação (UptimeRobot precisa bater anônimo)
- 4 testes formais em `apps/audit/tests/test_health.py`

---

## Realizado por (rastreabilidade ↓)

| Epic / Feature                                                         | Como atende                                                                     |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Plataforma base                                                        | `/healthz/` endpoint + UptimeRobot + Sentry alertas + 7 runbooks operacionais   |
| [EP-10 Busca → F-30](../../backlog/features/F-30-busca-texto-livre.md) | CA12 (feature flag = 503 graciosa); Redis fallback para LocMemCache documentado |
| Todos Epics que usam Celery                                            | Devem documentar comportamento quando worker = down                             |

---

## Runbooks operacionais ([`docs/runbooks/`](../../runbooks/README.md))

| Runbook                            | Cenário                   |
| ---------------------------------- | ------------------------- |
| `celery-worker-stuck.md`           | Worker travado            |
| `database-connection-exhausted.md` | DB pool esgotado          |
| `ddos-spike.md`                    | Spike de tráfego suspeito |
| `disk-full.md`                     | Disco saturado            |
| `gunicorn-down.md`                 | App server down           |
| `redis-down.md`                    | Cache + broker down       |
| `smtp-failure.md`                  | SendGrid falhando         |

---

## Cross-references

- Plano de deploy + disaster recovery: [HOSTING-DEPLOY-PLAN.md](../../planning/HOSTING-DEPLOY-PLAN.md)
- ADR-005 Hostinger KVM 1 + upgrade path: [ADR-005](../../planning/adrs/ADR-005-hostinger-kvm1.md)
- ADR-013 Observability gate: [ADR-013](../../planning/adrs/ADR-013-observability-gate.md)
- Architecture overview §7 observability: [overview.md §7](../../architecture/overview.md)
