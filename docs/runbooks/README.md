# Runbooks operacionais — Interpop

> **Status**: STUBS (A38 do reorganization-proposal). Cada runbook é placeholder
> a ser preenchido conforme incidentes reais ocorrerem. Não inventar conteúdo
> antes de ter sintomas reais — runbook sem evidência vira ficção.

Cada runbook segue o formato (alinhado à skill _engenharia-de-requisitos_ v1.28 — carrega um **id `RB-NN`** no H1 + um link **↑** ao `RNF` que operacionaliza; o id vive no documento, o filename é mantido por já ser referenciado em ADRs/specs):

```
RB-NN (header)   → tipo · gatilho · status
Operacionaliza ↑ → o RNF de resiliência/disponibilidade que este procedimento entrega
Sintoma          → o que o operador vê (alerta, log, comportamento do usuário)
Diagnóstico      → passos para confirmar a hipótese (comandos, dashboards)
Ações            → procedimento de mitigação (ordem, comandos, side-effects)
Escalation       → quando + para quem escalar
Postmortem link  → link para o PM-NN após resolução
```

## Catálogo

| Id      | Runbook                                                                            | Cobre                                                            | ↑ RNF                    |
| ------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------ |
| `RB-01` | [RB-01-celery-worker-stuck.md](./RB-01-celery-worker-stuck.md)                     | Tasks Celery enfileirando sem processar                          | availability             |
| `RB-02` | [RB-02-database-connection-exhausted.md](./RB-02-database-connection-exhausted.md) | "too many connections" no Postgres                               | availability             |
| `RB-03` | [RB-03-ddos-spike.md](./RB-03-ddos-spike.md)                                       | Tráfego anômalo / abuse                                          | availability · security  |
| `RB-04` | [RB-04-disk-full.md](./RB-04-disk-full.md)                                         | /var ou / cheio (logs, media, backups)                           | availability             |
| `RB-05` | [RB-05-demo-render.md](./RB-05-demo-render.md)                                     | Site demo no Render (MSW, sem backend) para o design             | — (ferramenta de design) |
| _pend._ | gunicorn-down.md · redis-down.md · smtp-failure.md                                 | App down · Cache/broker down · SMTP falhando (ainda sem arquivo) | availability             |

Detalhe completo: HOSTING-DEPLOY-PLAN.md §1222-§1232.
