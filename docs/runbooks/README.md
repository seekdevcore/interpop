# Runbooks operacionais — Interpop

> **Status**: STUBS (A38 do reorganization-proposal). Cada runbook é placeholder
> a ser preenchido conforme incidentes reais ocorrerem. Não inventar conteúdo
> antes de ter sintomas reais — runbook sem evidência vira ficção.

Cada runbook segue o formato:

```
Sintoma          → o que o operador vê (alerta, log, comportamento do usuário)
Diagnóstico      → passos para confirmar a hipótese (comandos, dashboards)
Ações            → procedimento de mitigação (ordem, comandos, side-effects)
Escalation       → quando + para quem escalar
Postmortem link  → link para postmortem após resolução
```

## Catálogo

| #   | Runbook                                                                | Cobre                                                    |
| --- | ---------------------------------------------------------------------- | -------------------------------------------------------- |
| 1   | [gunicorn-down.md](./gunicorn-down.md)                                 | App não responde (502/504 do nginx)                      |
| 2   | [celery-worker-stuck.md](./celery-worker-stuck.md)                     | Tasks Celery enfileirando sem processar                  |
| 3   | [database-connection-exhausted.md](./database-connection-exhausted.md) | "too many connections" no Postgres                       |
| 4   | [disk-full.md](./disk-full.md)                                         | /var ou / cheio (logs, media, backups)                   |
| 5   | [redis-down.md](./redis-down.md)                                       | Cache + Celery broker offline                            |
| 6   | [smtp-failure.md](./smtp-failure.md)                                   | Emails não saem (welcome, password reset, notifications) |
| 7   | [ddos-spike.md](./ddos-spike.md)                                       | Tráfego anômalo / abuse                                  |

Detalhe completo: HOSTING-DEPLOY-PLAN.md §1222-§1232.
