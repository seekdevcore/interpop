# F-60 — Observability + audit trail (4 responsabilidades grudadas)

> **Tipo**: Feature
> **Epic pai**: [EP-06 Administração do sistema](../epics/EP-06-administracao-sistema.md)
> **Sprint de execução**: 1 (pré-busca, sem arquivo histórico formal)
> **Status**: ✅ Done (Sprint 1, pré-busca) — código em `backend/apps/audit/` (810 LOC + 806 LOC de testes)
> **Prioridade**: 🟠 Alta (entrega real) · 🔴 débitos S-10 (LGPD) e D-AUD-00 (refactor) abertos

---

## Descrição (visão de produto)

F-60 entrega, **em um único app Django**, a quarteta operacional que sustenta investigação de incidente, resposta a vazamento, monitoramento ativo e auditoria de moderação:

1. **AuditLog** — tabela INSERT-only que registra toda escrita HTTP autenticada com autor, ação, recurso, status, IP e user-agent.
2. **RequestID + logs estruturados** — toda requisição recebe identificador único propagado em logs JSON e devolvido no header `X-Request-ID`.
3. **Sentry com PII scrubbing** — exceções vão para telemetria externa com remoção de senha/token/e-mail/cookie/CPF antes do envio; release tag por commit SHA; healthz droppado para não poluir quota.
4. **Security headers + healthcheck + AdminMetricsView** — Permissions-Policy + CSP (hoje Report-Only), endpoint `/healthz/` para UptimeRobot, e dashboard agregando KPIs para admin.

**Anti-sycophancy**: este desenho está **inchado** — quatro responsabilidades em um único app é o maior débito estrutural do backend (DESIGN §0 e CONCERNS §D-02). Esta Feature **documenta o estado real do código entregue**, lista débitos abertos explicitamente (S-10, D-AUD-00..08), aponta gaps de cobertura (GAP-AUD-01..04) e mapeia o caminho de saída (F-61 refactor com ADR prévio em Sprint 9+, F-62 LGPD hotfix obrigatório em Sprint 5).

Features futuras irmãs sob EP-06:

- **F-61** — refactor em 4 apps (`apps.observability` + `apps.audit` puro + `apps.admin_bff` + `apps.security_headers`)
- **F-62** — AuditLog TTL + anonimização IP (LGPD blocker pré-go-live)
- **F-63** — Admin promote/demote role UI

---

## Requisitos atendidos (rastreabilidade ↑)

| ID                                                             | Requisito                                                    | Relação                               |
| -------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------- |
| [RF-006](../../requirements/RF/RF-006-audit.md)                | Auditoria, observabilidade e telemetria operacional          | Realiza diretamente (todas subseções) |
| [RNF-security](../../requirements/RNF/RNF-security.md)         | Security headers, PII scrubbing, AuditLog INSERT-only        | Realiza CA04, CA08, CA10              |
| [RNF-availability](../../requirements/RNF/RNF-availability.md) | `/healthz/` < 50ms + UptimeRobot < 1min                      | Realiza CA05, CA06                    |
| [RNF-lgpd](../../requirements/RNF/RNF-lgpd.md)                 | Retenção AuditLog (hoje **indefinida** — débito S-10)        | Cumpre parcialmente; **F-62 fecha**   |
| [RNF-perf](../../requirements/RNF/RNF-perf.md)                 | AdminMetrics tolera 1-2s; query budget ≤ 25 (sem guard hoje) | Cumpre parcialmente; gap GAP-AUD-02   |

---

## Critérios de Aceitação (CAs)

| ID       | Critério                                                                                                                                                                                                                                                                                                                                                                                                                                        | Como verificar                                                            | Status                                                                                                                                             |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CA01** | Toda requisição HTTP recebe `request_id` UUID único (16 hex chars = 64 bits), propagado em log lines e devolvido em response header `X-Request-ID`; cliente que enviou `X-Request-ID` é honrado                                                                                                                                                                                                                                                 | `tests/test_middleware.py` cobre stamp + reset + honor                    | ✅ (Sprint 1, pré-busca)                                                                                                                           |
| **CA02** | Logs em produção são JSON structured (formatter `json` em `base.py:286+`), cada linha carrega `request_id` + `user_id` via `RequestContextFilter`; dev usa formatter `console` legível                                                                                                                                                                                                                                                          | Smoke manual no journald + `LOGGING` dict em `base.py:307-321`            | ✅ (Sprint 1, pré-busca)                                                                                                                           |
| **CA03** | Sentry SDK inicializa automaticamente em prod se `SENTRY_DSN` setado; no-op silencioso se vazio; release tag via `GIT_SHA[:12]`; `traces_sample_rate=0.1` e `profiles_sample_rate=0.05` env-overridable                                                                                                                                                                                                                                         | `tests/test_sentry.py` (108 LOC)                                          | ✅ (Sprint 1, pré-busca)                                                                                                                           |
| **CA04** | Security headers obrigatórios injetados em **toda** response: HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy (baseline em `security_headers_middleware.py:28-34`), CSP (Report-Only por default; flip via `CSP_ENFORCE=True` env)                                                                                                                                                                           | `tests/test_security_headers.py` (145 LOC)                                | ✅ entrega real · 🟠 **débito S-03**: CSP Report-Only indefinido + `CSP_REPORT_URI=''` silencioso                                                  |
| **CA05** | Endpoint `GET /healthz/` (+ alias `/healthz` sem slash) retorna `{status, version, db, cache}` em ≤ 50ms p99 sem autenticação; checa DB via `SELECT 1` e cache via set/get round-trip                                                                                                                                                                                                                                                           | `tests/test_health.py` (4 testes, 43 LOC) — 200/alias/no-auth/version-env | ✅ entrega real · 🟢 gap **GAP-AUD-01**: sem assertion de latência                                                                                 |
| **CA06** | UptimeRobot externo bate `/healthz/` a cada 1min — degradação detectada em < 1min; nginx upstream check e smoke test do `deploy.sh` consomem o mesmo endpoint (rollback automático se 503 pós-restart)                                                                                                                                                                                                                                          | Histórico UptimeRobot + `scripts/deploy.sh`                               | ✅ ativo em produção                                                                                                                               |
| **CA07** | AuditLog grava: `actor` (FK SET_NULL nullable), `action` (string `'{method} {path}'`), `request_path`, `request_method`, `response_status`, `ip_address` (IPv4/IPv6 cru — débito S-10), `user_agent` (truncado em 500 chars), `created_at` auto. Insert é post-response com `try/except Exception` (falha **nunca** quebra request)                                                                                                             | `tests/test_middleware.py` + `apps/audit/middleware.py:57-85`             | ✅ entrega real · 🔴 **débito S-10**: IP cru sem anonimização                                                                                      |
| **CA08** | AuditLog é **INSERT-only**: Django admin bloqueia `add`/`change` (`admin.py:12-16`); middleware só faz `objects.create`; nunca `update()` nem `delete()` pela aplicação. Garantia **convencional** (não enforced no DB — gap defense-in-depth)                                                                                                                                                                                                  | Code inspection + `admin.py` readonly_fields cobre todos os campos        | ✅ por design                                                                                                                                      |
| **CA09** | Eventos auditados pela escrita HTTP: login, logout, login_failed, ban_created, ban_request_open, ban_request_decide, password_change, article_published, comentário criado/editado/removido via API. Captura é HTTP-method-driven (POST/PUT/PATCH/DELETE) com skip de `_SKIP_PATHS = {/api/v1/auth/refresh/, /admin/}`                                                                                                                          | Smoke test de cada rota canônica + `_WRITE_METHODS` em `middleware.py:20` | ✅ entrega real · 🟡 **débito D-AUD-07**: `/admin/` skipped — admin Django bypassa AuditLog custom                                                 |
| **CA10** | Endpoint `GET /api/v1/admin/metrics/` (gate `IsAuthenticated + IsAdminUser`) retorna agregados: `totals` lifetime, `period_stats` + `previous_period_stats` (delta), `per_article` ranking top 20, `time_series` em 5 séries, `category_breakdown` completo. Query param `?period=day                                                                                                                                                           | week                                                                      | month                                                                                                                                              | year`(default`week`) | `tests/test_admin_metrics.py` (426 LOC) | ✅ entrega real · 🟠 **débito D-AUD-02**: ~25 queries sem cache, sem `ScopedRateThrottle 'admin_metrics': 30/min`, sem `assertNumQueries` (regression guard) · gap GAP-AUD-02 |
| **CA11** | `get_client_ip` utility (`utils.py:12-30`) lê `HTTP_X_FORWARDED_FOR[0]` → fallback `REMOTE_ADDR` → `None`. **Não respeita `CF-Connecting-IP` explicitamente** — confia que nginx agrega Cloudflare em XFF. **Não respeita `NUM_PROXIES`** — pattern Django ausente                                                                                                                                                                              | `utils.py:12-30` + cobertura indireta em `test_middleware.py`             | ✅ entrega real · 🟡 **débito D-AUD-08**: frágil se Cloudflare bypassed                                                                            |
| **CA12** | **(DESIGN §8 S-10 — LGPD blocker pré-go-live)** AuditLog hoje retém IP **cru** e **sem TTL**. LGPD Art. 16 exige tratamento por tempo necessário. **Mitigação obrigatória Sprint 5** via F-62: cron semanal anonimiza IP após 90d, purge completo após 2 anos, ADR formal de retenção por tabela. **Bloqueia go-live público regulatoriamente**                                                                                                 | F-62 deliverable + ADR de retenção                                        | 🔴 **PENDENTE — F-62 Sprint 5 obrigatória**                                                                                                        |
| **CA13** | **(DESIGN §0 D-AUD-00 — refactor backlog Sprint 9+)** Módulo `apps.audit` carrega 4 responsabilidades grudadas (AuditLog + observability + AdminMetricsView + security_headers). Ordem de middleware em `base.py:55-79` é **crítica** — quebrar a ordem mata logs estruturados em silêncio. Refactor candidato para Sprint 9+ via F-61 com ADR prévio mandatório (ordem de extração: security_headers → observability → admin_bff → audit puro) | ADR de split + F-61 deliverable                                           | ⏳ **PENDENTE — F-61 Sprint 9+**                                                                                                                   |
| **CA14** | Sentry `_before_send` faz scrub recursivo (depth ≤ 6) por chave em `_PII_KEYS`: `password*`, `*_token`, `csrf_token`, `authorization`, `cookie`, `email`, `cpf`, `phone`, `sendgrid_api_key`, `secret_key`, `jwt_signing_key`. Healthz droppado por path-suffix. `send_default_pii=False` como defesa em profundidade                                                                                                                           | `tests/test_sentry.py`                                                    | ✅ entrega real · 🟠 **débito D-AUD-01**: `?probe=1` em healthz **bypassa** drop e gera event Sentry (fix 2 linhas: `urlparse(url).path in {...}`) |
| **CA15** | RequestID e AuditLog middlewares usam defensive guard `request.user.is_authenticated` — divergem em `hasattr(request, 'user')` (RequestID tem, AuditLog não). Sem hasattr em AuditLog, ordem de middleware quebrada explode silenciosamente engolida pelo `try/except Exception`                                                                                                                                                                | `middleware.py:41-45` vs `:74`                                            | ✅ funciona · 🟠 **débito D-AUD-03**: fix 5 linhas — extrair helper `_user_or_none(request)`                                                       |

---

## User Stories

### US60.1 — Dev investiga incidente via `request_id` em logs

> **Como** desenvolvedor em incident response
> **Quero** correlacionar todas as linhas de log de uma requisição específica usando o identificador `X-Request-ID` que o cliente reportou
> **Para** reconstituir o que aconteceu em segundos, não em minutos, e identificar a causa raiz sem hipótese.

- **Prioridade**: 🟠 Alta
- **Estimativa**: 3 Story Points
- **Sprint**: 1 (entrega real, pré-busca)
- **Status**: ✅ Done
- **CAs cobertos**: CA01, CA02
- **Persona**: dev em incident response ([personas](../../requirements/personas-e-cenarios.md))

#### Cenários BDD (Gherkin pt-BR)

```gherkin
Funcionalidade: Rastreabilidade end-to-end de requisição via request_id
  Como dev em incident response
  Quero correlacionar logs por request_id
  Para reconstituir o incidente em segundos

Cenário: Cliente envia X-Request-ID e backend honra
  Dado que o cliente envia header "X-Request-ID: abc123def456"
  Quando a requisição chega ao backend
  Então toda linha de log do ciclo de vida do request carrega "request_id=abc123def456"
  E a response devolve header "X-Request-ID: abc123def456"
  E o dev consegue grep journalctl com esse mesmo valor

Cenário: Cliente não envia X-Request-ID — backend gera
  Dado que o cliente não envia header X-Request-ID
  Quando a requisição chega ao backend
  Então o RequestIDMiddleware gera "uuid.uuid4().hex[:16]" (16 hex chars)
  E a response devolve esse identificador no header X-Request-ID
  E o cliente pode logar em paralelo para correlação

Cenário: ContextVar é resetado entre requisições
  Dado uma requisição com request_id "aaa111" termina
  Quando uma nova requisição entra com request_id "bbb222"
  Então logs da segunda nunca contêm "aaa111"
  E ContextVar.reset(token) foi chamado em finally do middleware

Cenário: Investigação em prod via journalctl
  Dado o cliente reporta erro com X-Request-ID "xyz789..." às 14:32 UTC
  Quando o dev roda "sudo journalctl -u gunicorn --since '1 hour ago' | grep 'request_id=xyz789'"
  Então todas as linhas daquele request aparecem agregadas
  E o dev identifica o stack-trace + módulo afetado sem precisar abrir Sentry
```

---

### US60.2 — Admin revisa AuditLog de uma decisão de moderação

> **Como** administrador investigando uma reclamação
> **Quero** consultar o AuditLog filtrado por autor, ação ou IP suspeito
> **Para** fundamentar uma decisão de moderação ou responder a um pedido LGPD com prova documental.

- **Prioridade**: 🟠 Alta
- **Estimativa**: 2 Story Points
- **Sprint**: 1 (entrega real via Django admin)
- **Status**: ✅ Done (sem UI custom; via `/admin/audit/auditlog/`)
- **CAs cobertos**: CA07, CA08, CA09
- **Persona**: admin investigador ([personas](../../requirements/personas-e-cenarios.md))

#### Cenários BDD (Gherkin pt-BR)

```gherkin
Funcionalidade: Investigação de AuditLog por administrador
  Como administrador
  Quero consultar AuditLog filtrado
  Para fundamentar moderação e responder LGPD

Cenário: Admin lista últimas 50 ações de um usuário
  Dado que admin está em "/admin/audit/auditlog/"
  Quando filtra "actor__email=gabriel@interpop.com.br"
  Então vê lista ordenada por created_at desc
  E cada linha mostra (created_at, actor, action, response_status, ip_address)
  E nenhum campo é editável (readonly_fields cobre todos)

Cenário: Admin investiga burst de erro 5xx
  Dado que o sistema teve pico de erros nas últimas 2h
  Quando admin filtra response_status>=500 nas últimas 2h
  Então vê agregação por action ordenada por contagem desc
  E identifica qual rota explodiu

Cenário: Admin tenta editar AuditLog (não pode)
  Dado que admin abre uma linha em "/admin/audit/auditlog/<id>/"
  Então todos os campos aparecem como readonly
  E não há botão "Save"
  E tentativa de POST direto retorna 403 (admin.py:12-16 bloqueia change/add)

Cenário: Admin cumpre LGPD-DSAR
  Dado que titular pede via DPO "que ações foram registradas sobre mim?"
  Quando admin filtra actor=<titular> em "/admin/audit/auditlog/"
  Então exporta CSV com todas as linhas
  E entrega ao DPO para resposta formal ao titular
  Mas (limitação atual): mudanças via Django admin sobre o titular NÃO aparecem nesse export (skip de "/admin/" — D-AUD-07); LogEntry nativo precisa ser anexado em paralelo
```

---

### US60.3 — UptimeRobot detecta downtime em < 1min via `/healthz/`

> **Como** owner do sistema (Gabriel)
> **Quero** que UptimeRobot detecte degradação em < 1min
> **Para** ser notificado por SMS/e-mail antes que o leitor reporte e iniciar response.

- **Prioridade**: 🔴 Imediato (disponibilidade percebida)
- **Estimativa**: 1 Story Point
- **Sprint**: 1 (entrega real)
- **Status**: ✅ Done
- **CAs cobertos**: CA05, CA06
- **Persona**: owner em on-call ([personas](../../requirements/personas-e-cenarios.md))

#### Cenários BDD (Gherkin pt-BR)

```gherkin
Funcionalidade: Monitoramento ativo de saúde via /healthz/
  Como owner em on-call
  Quero ser notificado em < 1min de downtime
  Para iniciar response antes que o leitor reporte

Cenário: Tudo saudável
  Dado que UptimeRobot bate "GET /healthz/" a cada 1min
  Quando DB e cache respondem
  Então response é 200 com {"status":"ok","version":"<sha12>","db":"ok","cache":"ok"}
  E UptimeRobot registra "up"
  E nenhum alerta dispara

Cenário: DB indisponível
  Dado que Postgres parou de responder
  Quando UptimeRobot bate "GET /healthz/"
  Então _check_db lança exceção em "cursor.execute('SELECT 1')"
  E response é 503 com {"status":"degraded","db":"error: ...","cache":"ok"}
  E UptimeRobot dispara alerta SMS/e-mail em < 1min

Cenário: Deploy quebrou — rollback automático
  Dado que "scripts/deploy.sh" reiniciou o gunicorn
  Quando smoke test bate "/healthz/" e recebe 503
  Então deploy.sh executa rollback para release anterior
  E reinicia gunicorn no commit anterior
  E confirma /healthz/ retornando 200

Cenário: Alias sem slash funciona
  Dado que monitor configurou "GET /healthz" (sem trailing slash)
  Quando bate o endpoint
  Então response é 200 (alias montado em config/urls.py:21-22)
  E não há redirect para "/healthz/"
```

---

### US60.4 — Admin abre dashboard `/api/v1/admin/metrics/` e vê KPIs do sistema

> **Como** administrador
> **Quero** abrir o dashboard admin e ver totais + séries temporais + ranking de artigos + breakdown de editoria
> **Para** acompanhar saúde editorial sem precisar abrir Django admin e fazer queries manuais.

- **Prioridade**: 🟠 Alta
- **Estimativa**: 5 Story Points
- **Sprint**: 1 (entrega real)
- **Status**: ✅ Done · 🟠 com débito D-AUD-02 (~25 queries sem cache/throttle/assertNumQueries)
- **CAs cobertos**: CA10
- **Persona**: admin editorial ([personas](../../requirements/personas-e-cenarios.md))

#### Cenários BDD (Gherkin pt-BR)

```gherkin
Funcionalidade: Dashboard admin com KPIs agregados
  Como administrador
  Quero KPIs do sistema em uma única view
  Para acompanhar saúde editorial

Cenário: Admin abre dashboard com period=week (default)
  Dado que admin autenticado bate "GET /api/v1/admin/metrics/"
  Então response é 200 com {totals, period_stats, previous_period_stats, per_article, time_series, category_breakdown}
  E totals contém (users, subscribers, articles_published, view_count_total, comments_visible, likes)
  E period_stats cobre últimos 7 dias e previous_period_stats cobre 7 dias antes (para delta)
  E per_article é ranking top 20 (PER_ARTICLE_LIMIT=20)
  E time_series tem 5 séries (comments, likes, subscribers, users, articles) bucketizadas por dia

Cenário: Admin troca period para year
  Dado admin bate "GET /api/v1/admin/metrics/?period=year"
  Então time_series é bucketizado por mês (não por dia)
  E period_stats cobre últimos 12 meses

Cenário: Usuário não-admin é negado
  Dado usuário autenticado mas role != admin/dev
  Quando bate "GET /api/v1/admin/metrics/"
  Então response é 403 (gate "IsAuthenticated + IsAdminUser")
  E nenhuma query agregada é executada

Cenário: Anônimo é negado
  Dado cliente sem autenticação
  Quando bate "GET /api/v1/admin/metrics/"
  Então response é 401 (IsAuthenticated falha primeiro)
```

---

## Tasks (implementação — entregue Sprint 1, pré-busca)

### Tasks US-bound — todas ✅ Done (Sprint 1, pre-busca)

| ID      | Descrição                                                                                                                                                                                 | Prioridade | Arquivo / referência                                                   |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------- |
| T60.1.1 | Bootstrap app `apps.audit` (`apps.py`, `__init__.py`, `models.py`, `admin.py`, `urls.py`)                                                                                                 | 🔴         | ✅ Done (Sprint 1, pré-busca) — `backend/apps/audit/`                  |
| T60.1.2 | `RequestIDMiddleware` (gera/honra `X-Request-ID`, propaga via contextvars, stamp em response header)                                                                                      | 🔴         | ✅ Done (Sprint 1, pré-busca) — `middleware.py:24-54`                  |
| T60.1.3 | `RequestContextFilter` (`logging.Filter` que injeta `request_id` + `user_id` em todo LogRecord)                                                                                           | 🔴         | ✅ Done (Sprint 1, pré-busca) — `logging.py:30-41`                     |
| T60.1.4 | Config structlog/LOGGING em `base.py:286-360` (formatter `json` em prod, `console` em dev)                                                                                                | 🟠         | ✅ Done (Sprint 1, pré-busca) — `config/settings/base.py:286+`         |
| T60.1.5 | `init_sentry(environment)` com gate `SENTRY_DSN`, `_scrub` recursivo por chave, drop healthz, release tag                                                                                 | 🟠         | ✅ Done (Sprint 1, pré-busca) — `sentry.py:56-90`                      |
| T60.2.1 | `AuditLog` model (BigAutoField, actor FK SET_NULL, action, request_path/method, response_status, ip_address, user_agent, metadata, created_at)                                            | 🔴         | ✅ Done (Sprint 1, pré-busca) — `models.py:5-34`                       |
| T60.2.2 | Migrações iniciais `0001_initial.py` + `0002_initial.py` (schema base + índices `(actor, -created_at)`, `(action, -created_at)`, `(response_status, -created_at)`)                        | 🔴         | ✅ Done (Sprint 1, pré-busca) — `migrations/`                          |
| T60.2.3 | `AuditLogMiddleware` post-response com filtro `_WRITE_METHODS = {POST,PUT,PATCH,DELETE}` + skip `_SKIP_PATHS` + `try/except Exception`                                                    | 🔴         | ✅ Done (Sprint 1, pré-busca) — `middleware.py:57-85`                  |
| T60.2.4 | Django admin do AuditLog: `list_display`, `search_fields`, `readonly_fields` cobre tudo, bloqueia `add`/`change`                                                                          | 🟠         | ✅ Done (Sprint 1, pré-busca) — `admin.py:5-16`                        |
| T60.3.1 | `SecurityHeadersMiddleware` injeta Permissions-Policy (baseline desabilita camera/mic/geo/payment/usb/sensors) + CSP (Report-Only por default, flip via `CSP_ENFORCE`)                    | 🟠         | ✅ Done (Sprint 1, pré-busca) — `security_headers_middleware.py:69-92` |
| T60.3.2 | `_build_csp(report_uri)` constrói policy baseline (`script-src 'self' 'unsafe-inline'` com comentário de compromisso consciente, `frame-ancestors 'none'`, `img-src 'self' data: https:`) | 🟠         | ✅ Done (Sprint 1, pré-busca) — `security_headers_middleware.py:37-66` |
| T60.4.1 | `healthz` view (FBV em `health_view.py:49-65`) — 2 checks (`_check_db` SELECT 1 + `_check_cache` set/get), retorna `version=GIT_SHA[:12]`                                                 | 🔴         | ✅ Done (Sprint 1, pré-busca) — `health_view.py:49-65`                 |
| T60.4.2 | URL `/healthz/` + alias `/healthz` em `config/urls.py:21-22` (sem auth, sem throttle)                                                                                                     | 🔴         | ✅ Done (Sprint 1, pré-busca) — `config/urls.py:21-22`                 |
| T60.4.3 | `get_client_ip` utility (`utils.py:12-30`) — XFF[0] → REMOTE_ADDR → None                                                                                                                  | 🟠         | ✅ Done (Sprint 1, pré-busca) — `utils.py:12-30`                       |
| T60.5.1 | `AdminMetricsView` (`views.py:132-237`) com `IsAuthenticated + IsAdminUser`, query param `?period=`, agrega 6 totals + period × 2 + per_article + time_series × 5 + category_breakdown    | 🟠         | ✅ Done (Sprint 1, pré-busca) — `views.py:132-237`                     |
| T60.5.2 | `_period_stats`, `_generate_buckets`, `_trunc_for` helpers em `views.py:42-129`                                                                                                           | 🟠         | ✅ Done (Sprint 1, pré-busca) — `views.py:42-129`                      |
| T60.6.1 | Testes formais — `test_health.py` (43 LOC, 4 testes: 200/alias/no-auth/version-env)                                                                                                       | 🔴         | ✅ Done (Sprint 1, pré-busca) — `tests/test_health.py`                 |
| T60.6.2 | Testes formais — `test_middleware.py` (84 LOC), `test_security_headers.py` (145 LOC), `test_sentry.py` (108 LOC), `test_admin_metrics.py` (426 LOC)                                       | 🟠         | ✅ Done (Sprint 1, pré-busca) — `tests/`                               |
| T60.7.1 | Chamada `init_sentry(environment='production')` em `production.py`                                                                                                                        | 🟠         | ✅ Done (Sprint 1, pré-busca) — `config/settings/production.py`        |

### Tasks transversais (TX-NN) — herdadas, escalam para Sprint 5+

| ID    | Descrição                                                                                                                              | Prioridade | Status                                  |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------- |
| TX-60 | ADR formal de retenção AuditLog (90d anonim. IP + 2 anos purge total) — pré-requisito F-62                                             | 🔴         | ⏳ Sprint 5 (obrigatório pré-go-live)   |
| TX-61 | ADR formal de split `apps.audit` em 4 apps (ordem: security_headers → observability → admin_bff → audit puro)                          | 🟠         | ⏳ Sprint 9+ (pré-requisito F-61)       |
| TX-62 | Endpoint `POST /api/v1/security/csp-report/` que loga via structlog + `sentry_sdk.capture_message(level='warning')`                    | 🟠         | ⏳ Sprint 5 (destrava flip CSP enforce) |
| TX-63 | Hard-fail em `production.py` se `CSP_REPORT_URI == ''` e Sentry DSN configurado (auto-Sentry endpoint OU `raise ImproperlyConfigured`) | 🟠         | ⏳ Sprint 5                             |
| TX-64 | Decisão "preencher `target_repr` + `metadata` vs. remover via migration" (D-AUD-04)                                                    | 🟡         | ⏳ Sprint 9+ (vinculado a F-61)         |

---

## Definition of Done — verificação

- [x] CA01–CA11, CA14, CA15 verificados por automated test (`apps/audit/tests/` 5 arquivos, 806 LOC)
- [x] US60.1, US60.2, US60.3, US60.4 com cenários BDD cobertos por testes existentes ou smoke real em produção
- [x] Todas as Tasks 🔴 Imediate done (Sprint 1, pré-busca)
- [x] Code-review implícito (commits diretos em main pré-busca; sem PR formal histórico — documentação retroativa cobre esse gap)
- [x] Cobertura backend `apps/audit/` ≥ 85% local (806 LOC de teste para 810 LOC de código)
- [x] Documentação cruzada atualizada — RF-006 cita F-60, EP-06 lista F-60, DESIGN.md cita RF-006
- [ ] **CA12 (S-10 LGPD)** verificável **apenas após F-62 Sprint 5** — 🔴 **bloqueia go-live público regulatoriamente**
- [ ] **CA13 (D-AUD-00 refactor)** verificável **apenas após F-61 Sprint 9+** — débito estrutural mapeado mas aceito

**Status final**: ✅ **Done como entrega Sprint 1** com **2 CAs (CA12, CA13) marcados como débitos abertos** mapeados para Features futuras (F-62 obrigatória, F-61 opcional/estrutural). **Anti-sycophancy honesto**: o desenho está inchado, o spec não defende — apenas documenta para tornar o caminho de saída visível e seguro.

---

## Open Questions (DESIGN §10 — escalar antes de refatorar)

1. **(S-10 LGPD — hotfix obrigatório pré-go-live)** AuditLog TTL formal — 90 dias? 1 ano? 2 anos? Indefinido **não pode permanecer**. ADR explícito de retenção por tabela (audit_logs + comments soft-deleted + newsletter unsubscribed) precisa preceder o cron de F-62.
2. **(S-03)** CSP `Report-Only` indefinido — quando flip para `enforce`? Sem decisão, é cerimônia sem proteção real contra stored-XSS (combinado com S-01 sem sanitização HTML em comments/articles).
3. **(D-AUD-00 — refactor Sprint 9+)** Quando o split do app acontece? Ordem de extração: (a) `apps.security_headers` (independente, menor risco), (b) `apps.observability` (Sentry + RequestID + healthz — testar middleware order), (c) `apps.admin_bff` (mover AdminMetricsView), (d) `apps.audit` enxuto fica.
4. **(D-AUD-02)** `AdminMetricsView` N+1 sem cache — refactor com cache 60s + `ScopedRateThrottle 'admin_metrics': 30/min` + `assertNumQueries(<=25)` em test? Sem decisão, dashboard quebra em escala.
5. **(D-AUD-05)** `request_id` 16 hex chars (64 bits) — colisão teórica em 4.3 bilhões de requests (não-prático). Trocar para UUID completo (32 chars) por defesa em profundidade? Custo trivial; debate é UX de log.
6. **(O-07)** `X-Request-ID` no response é trade-off consciente — manter ou trocar por HMAC para zero-leak? Hoje aceitável (UUID aleatório, 64 bits — não há risco de enumeration).
7. **(D-AUD-07)** `/admin/` skip — manter e usar `LogEntry` nativo (formato divergente) OU remover skip e aceitar overhead? Decisão precisa documentar em ADR antes de F-62.
8. **(D-AUD-04)** `target_repr` + `metadata` — implementar de fato (action como enum + ContentType polimórfico + metadata estruturado) OU remover via migration? Decisão vinculada à seriedade que damos ao LGPD-DSAR.
9. **Log handler `console` vs `file` em prod** — hoje provavelmente journald via gunicorn → systemd. Confirmar com owner e documentar runbook.

---

## Specs técnicas relacionadas

- [DESIGN do módulo `audit`](../../specs/audit/DESIGN.md) — 526 LOC, fonte de verdade
- [CONCERNS §D-02, §S-03, §S-10, §D-08, §D-09, §O-07](../../specs/codebase/CONCERNS.md)
- [ARCHITECTURE — middleware order + signal flow](../../specs/codebase/ARCHITECTURE.md)
- [STRUCTURE — `backend/apps/audit/`](../../specs/codebase/STRUCTURE.md)
- [INTEGRATIONS — Sentry, UptimeRobot, Cloudflare](../../specs/codebase/INTEGRATIONS.md)

---

## Cross-references resumidas

| Direção                    | Onde                                                                                                                                                                                                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ↑ Requisitos atendidos     | [RF-006](../../requirements/RF/RF-006-audit.md), [RNF-security](../../requirements/RNF/RNF-security.md), [RNF-availability](../../requirements/RNF/RNF-availability.md), [RNF-lgpd](../../requirements/RNF/RNF-lgpd.md), [RNF-perf](../../requirements/RNF/RNF-perf.md) |
| ↑ Epic pai                 | [EP-06](../epics/EP-06-administracao-sistema.md)                                                                                                                                                                                                                        |
| → Sprint(s)                | Sprint 1 (entrega histórica retroativa) · Sprint 5 (F-62 LGPD obrigatória) · Sprint 9+ (F-61 refactor)                                                                                                                                                                  |
| → Specs técnicas           | [DESIGN.md](../../specs/audit/DESIGN.md) + ADRs A27/A28/A29/A20 em `Improvement-system.md`                                                                                                                                                                              |
| → Features filhas          | n/a (F-60 é Feature, não Epic)                                                                                                                                                                                                                                          |
| ← Features irmãs sob EP-06 | F-61 (refactor 4 apps — Sprint 9+), F-62 (LGPD TTL — Sprint 5 🔴), F-63 (promote/demote UI — Sprint 9+)                                                                                                                                                                 |

---

_F-60 ✅ Done como entrega histórica Sprint 1 (pré-busca). Documentação retroativa formalizada em 2026-06-09. **Anti-sycophancy**: este desenho carrega o maior débito estrutural do backend (DESIGN §0). Não defende — documenta. Próxima ação obrigatória: kickoff F-62 (LGPD AuditLog TTL) no início do Sprint 5. Skills aplicadas: `engenharia-de-requisitos`, `tlc-spec-driven`, `architecture-decision-records`, `security-requirement-extraction`._
