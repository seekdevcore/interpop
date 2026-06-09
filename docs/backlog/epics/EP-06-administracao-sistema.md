# EP-06 — Administração do sistema

> **Tipo**: Epic
> **Status**: 🚧 Em progresso (F-60 ✅ Done · F-62 🔴 obrigatória Sprint 5 · F-61/F-63 ⏳ Sprint 9+)
> **Prioridade global**: 🟠 Alta (F-62 escala para 🔴 Imediato — LGPD blocker)
> **Owner**: Gabriel Marques
> **Criado em**: Sprint 1 (retroativo formalizado 2026-06-09)

---

## Visão de produto

Este Epic agrupa o **substrato operacional do administrador e do desenvolvedor**: aquilo que faz o sistema **observável, auditável, monitorável e governável**. Não entrega valor direto para o leitor final — entrega valor para quem **opera** o Interpop (admin moderando, dev investigando incidente, DPO respondendo LGPD, monitor externo detectando downtime).

Quatro capacidades de produto cabem aqui:

1. **Trilha auditável de eventos sensíveis** — login, ban, publicação, mudança de senha, decisão de moderação ficam registrados em tabela INSERT-only, consultável por administrador para investigação ou cumprimento LGPD.
2. **Rastreabilidade end-to-end de requisição** — cada request HTTP recebe identificador único propagado em todos os logs, devolvido ao cliente no header `X-Request-ID`, permitindo correlacionar logs em segundos.
3. **Telemetria de erro com proteção de dados pessoais** — exceções não tratadas vão para Sentry com remoção automática de senha, token, e-mail, cookie e demais PII antes do envio.
4. **Monitoramento ativo de saúde + dashboard administrativo** — endpoint `/healthz/` consumido por UptimeRobot a cada 1min; dashboard `/api/v1/admin/metrics/` agrega KPIs para o admin.

Trade-off honesto deste Epic: hoje, as quatro capacidades acima vivem **em um único app Django (`apps.audit`)** com responsabilidades grudadas — é o **maior débito estrutural do backend** (DESIGN §0 e CONCERNS §D-02). Este Epic cataloga a entrega atual (F-60), a obrigação regulatória que **bloqueia o go-live** (F-62 LGPD), e o caminho de saída para Sprint 9+ (F-61 refactor, F-63 admin promote/demote UI). **Não defende o desenho atual** — documenta para tornar o refactor visível e seguro.

---

## KPI alvo do Epic

| KPI                            | Alvo                                     | Como medir                                              | Status                        |
| ------------------------------ | ---------------------------------------- | ------------------------------------------------------- | ----------------------------- |
| Latência `/healthz/`           | p99 ≤ 50ms                               | UptimeRobot histórico + assertion futura em test_health | 🟡 sem assertion (GAP-AUD-01) |
| Detecção de downtime           | < 1 min do incidente                     | UptimeRobot 1×/min + alerta para owner                  | ✅ ativo                      |
| AuditLog cobertura             | 100% dos POST/PUT/PATCH/DELETE elegíveis | Smoke test de eventos canônicos (login/ban/publish)     | ✅ ativo via middleware       |
| Conformidade LGPD AuditLog     | retenção ≤ 2 anos, IP anonimizado ≥ 90d  | Cron semanal + ADR de retenção                          | 🔴 **F-62 obrigatória**       |
| `AdminMetricsView` query count | ≤ 25 queries (regression guard)          | `assertNumQueries` em test_admin_metrics                | 🟡 gap GAP-AUD-02             |
| Sentry quota                   | Eventos de healthz droppados em 100%     | Sentry UI filter; bug atual com query string bypass     | 🟠 D-AUD-01 a corrigir        |

---

## Requisitos realizados (rastreabilidade ↑)

| ID                                                             | Requisito                                                                                | Tipo            |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------- |
| [RF-005](../../requirements/RF/RF-005-users-auth.md)           | Autenticação + autorização (raiz das ações `login`/`logout`/`password_change` auditadas) | Funcional       |
| [RF-006](../../requirements/RF/RF-006-audit.md)                | Auditoria, observabilidade e telemetria operacional                                      | Funcional       |
| [RNF-security](../../requirements/RNF/RNF-security.md)         | Security headers, PII scrubbing, AuditLog INSERT-only, CSP roadmap                       | Segurança       |
| [RNF-availability](../../requirements/RNF/RNF-availability.md) | `/healthz/` < 50ms p99 + UptimeRobot + rollback automático                               | Disponibilidade |
| [RNF-lgpd](../../requirements/RNF/RNF-lgpd.md)                 | AuditLog retenção + anonimização (S-10 hotfix)                                           | LGPD            |
| [RNF-perf](../../requirements/RNF/RNF-perf.md)                 | AdminMetrics tolera 1-2s; query budget ≤ 25                                              | Performance     |

---

## Features sob este Epic (rastreabilidade ↓)

| ID   | Nome                                                                                   | Sprint | Status                         | Arquivo                                               |
| ---- | -------------------------------------------------------------------------------------- | ------ | ------------------------------ | ----------------------------------------------------- |
| F-60 | Observability + audit trail (4 responsabilidades grudadas em `apps.audit`)             | 1      | ✅ Done (Sprint 1, pré-busca)  | [F-60](../features/F-60-observability-audit-trail.md) |
| F-62 | AuditLog TTL + anonimização IP (LGPD S-10)                                             | 5      | 🔴 **Obrigatória pré-go-live** | _a criar no kickoff Sprint 5_                         |
| F-61 | Refactor `apps.audit` em 4 apps (observability + audit + admin_bff + security_headers) | 9+     | ⏳ Backlog                     | _a criar com ADR prévio_                              |
| F-63 | Admin promote/demote role UI                                                           | 9+     | ⏳ Backlog                     | _a criar_                                             |

**Nota sobre numeração**: a faixa `F-6X` é reservada para Features deste Epic. F-60 nasce com débito estrutural conhecido e mapeado; F-62 é hotfix regulatório que precede F-61 (não faz sentido refatorar app que ainda viola LGPD).

---

## Débitos arquiteturais herdados (DESIGN §8)

Este Epic carrega oito débitos do código em produção. Ordem de severidade:

| #        | Débito                                                             | Severidade    | Feature/Sprint dona         |
| -------- | ------------------------------------------------------------------ | ------------- | --------------------------- |
| S-10     | AuditLog sem TTL + IP cru — **LGPD blocker**                       | 🔴 Crítico    | **F-62** (Sprint 5)         |
| D-AUD-00 | 4 responsabilidades em um único app (`apps.audit`)                 | 🔴 Crítico    | F-61 (Sprint 9+, ADR antes) |
| D-AUD-02 | `AdminMetricsView` ~25 queries sem cache/throttle/assertNumQueries | 🟠 Importante | F-60 → backlog interno      |
| S-03     | CSP Report-Only indefinido + `CSP_REPORT_URI=''` silencioso        | 🟠 Importante | F-60 (decisão pendente)     |
| D-AUD-01 | Sentry `_before_send` filtro de healthz bypassed por query string  | 🟠 Importante | F-60 (fix 2 linhas)         |
| D-AUD-03 | RequestID e AuditLog middlewares divergem em defensive guard       | 🟠 Importante | F-60 (fix 5 linhas)         |
| D-AUD-04 | `target_repr` e `metadata` nasceram mortos no schema               | 🟡 Menor      | Decisão pendente Sprint 9+  |
| D-AUD-08 | `get_client_ip` não respeita `NUM_PROXIES`                         | 🟡 Menor      | Backlog oportunístico       |

Cross-ref completo: [DESIGN.md §8](../../specs/audit/DESIGN.md), [CONCERNS.md](../../specs/codebase/CONCERNS.md).

---

## ADRs relacionadas (decisões locked-in / pendentes)

Em `docs/planning/Improvement-system.md` (gitignored — solicitar ao owner):

- **A27** — Logging estruturado JSON com RequestContextFilter
- **A28** — Sentry init gating + PII scrubbing
- **A29** — `/healthz/` contract: sem auth, 2 checks, gate de deploy
- **A20** — Redis caching (libera D-AUD-06 — healthz de cache vira liveness real)
- **S-03 / S-09 §11.6** — Security headers (CSP, Permissions-Policy, HSTS)

ADRs **pendentes** (DESIGN §10 open questions):

- Split de `apps.audit` em 4 apps (ordem de extração, risco de quebrar ordem de middleware)
- AuditLog retention policy (90d? 1 ano? 2 anos?) — pré-requisito F-62
- `action` cru vs. enum semântico (impacta DSAR e queries agregadas)
- `AdminMetricsView` BFF formal vs. split em `apps.admin_bff`
- CSP `enforce` timeline + plano para remover `script-src 'unsafe-inline'`

---

## Sprints envolvidas

| Sprint    | Escopo                                                       | Status                   | Arquivo                                                                                      |
| --------- | ------------------------------------------------------------ | ------------------------ | -------------------------------------------------------------------------------------------- |
| Sprint 1  | F-60 (implementação inicial sem spec formal)                 | ✅ Entregue (retroativo) | _sem arquivo histórico de sprint formalizado_                                                |
| Sprint 5  | F-62 (LGPD hotfix) + débitos D-AUD-01/03 em paralelo         | ⏳ Planejado             | [sprint-5-filtros-deep-linking](../sprints/sprint-5-filtros-deep-linking.md) (compartilhado) |
| Sprint 9+ | F-61 (refactor 4 apps com ADR prévio) + F-63 (admin role UI) | ⏳ Backlog               | _a criar_                                                                                    |

---

## Histórico de mudanças

| Data       | Evento                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------- |
| Sprint 1   | Implementação inicial do `apps.audit` (4 responsabilidades) sem spec formal — pré-Epic                        |
| 2026-06-09 | DESIGN retroativo do módulo (526 LOC) documenta débitos S-10/S-03/D-AUD-00..08 e gaps GAP-AUD-01..04          |
| 2026-06-09 | EP-06 formalizado retroativamente; substitui stub anterior; F-60 catalogada como ✅ Done Sprint 1 (pré-busca) |
| 2026-06-09 | F-62 escalada para 🔴 obrigatória Sprint 5 — bloqueia go-live regulatoriamente (LGPD Art. 16)                 |
| Sprint 5   | **Previsto**: F-62 entrega cron + ADR de retenção + endpoint CSP report                                       |
| Sprint 9+  | **Previsto**: F-61 refactor com ADR prévio mandatório; F-63 admin promote/demote UI                           |

---

_EP-06 formalizado retroativamente em 2026-06-09. Substitui stub anterior. **Anti-sycophancy**: este Epic carrega o maior débito estrutural do backend (DESIGN §0). Não defende o desenho atual — cataloga estado real, prioriza F-62 como blocker LGPD pré-go-live e mapeia F-61 (refactor) para Sprint 9+ com ADR obrigatório. Skills aplicadas: `engenharia-de-requisitos`, `tlc-spec-driven`, `architecture-decision-records`._
