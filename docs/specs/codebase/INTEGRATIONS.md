# INTEGRATIONS — Interpop

> Serviços de terceiros usados (ou pré-decididos) pelo sistema.
> Cada um: responsabilidade, env vars / config, plano B se cair, arquivo onde
> a conexão acontece.
>
> **Convenção de status**:
>
> - ✅ **Ativo** = código rodando e exercitado.
> - 🟡 **Pré-configurado** = código presente, integração depende só de env var ou de evento operacional (registrar provider, comprar domínio).
> - 🔴 **Planejado** = decisão tomada (ADR), implementação ainda não existe.

---

## 1. Tabela mestra

| Integração                       | Status              | Para que serve                                      | Env vars / config                                                                                                                                   | Plano B se cair                                                            | Arquivo onde se conecta                                                                                                         |
| -------------------------------- | ------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Cloudflare** (DNS + WAF + CDN) | 🔴 Planejado        | Edge cache, DDoS, TLS na frente do VPS              | DNS no painel CF; ranges em ufw rules                                                                                                               | Aponta DNS direto para o IP do VPS (downgrade, sem CDN/WAF)                | Nginx aceita `X-Forwarded-For` via `apps/audit/utils.get_client_ip`                                                             |
| **Cloudflare Turnstile**         | 🔴 Planejado        | Anti-bot invisível em endpoints sensíveis           | `CLOUDFLARE_TURNSTILE_SECRET` (planejada, HOSTING-DEPLOY-PLAN:898)                                                                                  | Honeypot field manual (rejeitado: reCAPTCHA por LGPD — ADR-007)            | A integrar em newsletter subscribe / password reset (Sprint 5+)                                                                 |
| **SendGrid** (ADR-004)           | 🔴 Planejado        | Email transacional + bulk newsletter (free 100/dia) | Não há `SENDGRID_API_KEY` em uso — código usa `EMAIL_HOST*` (SMTP genérico)                                                                         | Postmark (50/dia free) — rejeitado mas viável; AWS SES (custo variável)    | `backend/config/settings/production.py:58-64` (SMTP genérico) + `apps/newsletter/services.py`                                   |
| **Sentry** (ADR-013)             | 🟡 Pré-configurado  | Error tracking, traces (10%), profiles (5%)         | `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE` (default 0.1), `SENTRY_PROFILES_SAMPLE_RATE` (default 0.05), `GIT_SHA` (release), `HOSTNAME` (server tag) | Logs JSON em journald local + `apps/audit/AuditLog` (sem agregação remota) | [`backend/apps/audit/sentry.py`](../../../backend/apps/audit/sentry.py) — chamado em `production.py:27`                         |
| **Backblaze B2**                 | 🔴 Planejado        | Backup offsite cifrado (`pg_dump` + `media/`)       | `rclone config` (não em `.env` Django)                                                                                                              | Backup local apenas (sem proteção a falha de host)                         | `scripts/backup-daily.sh` é STUB (`exit 1`) — spec em HOSTING-DEPLOY-PLAN §504-555                                              |
| **UptimeRobot / Better Stack**   | 🔴 Planejado        | Heartbeat externo 1min + alerta Telegram/SMS        | URL pública `/healthz/` (endpoint já existe)                                                                                                        | Detecção interna apenas (gunicorn `Restart=always` + journald)             | Endpoint [`backend/apps/audit/health_view.py`](../../../backend/apps/audit/) — `GET /healthz/`                                  |
| **GitHub Actions**               | ✅ Ativo            | CI/CD (lint, tests, security) + Dependabot          | `GITHUB_TOKEN` automático; `SARIF` upload via `security-events: write`                                                                              | Rodar `pytest`, `npm test`, `gitleaks` manual local                        | [`.github/workflows/`](../../../.github/workflows/) (3 workflows) + [`dependabot.yml`](../../../.github/dependabot.yml)         |
| **MSW** (Mock Service Worker)    | ✅ Ativo (dev-only) | Mock HTTP de `/api/v1/search/articles/` em DEV      | n/a (sem env vars)                                                                                                                                  | `?msw=off` na URL desliga; aponta para Django local                        | [`src/main.tsx:33-41`](../../../src/main.tsx) + [`src/mocks/browser.ts`](../../../src/mocks/browser.ts) + `src/mocks/handlers/` |
| **django-axes**                  | ✅ Ativo            | Brute-force protection (5 fail / 30 min)            | `AXES_*` settings em `base.py`                                                                                                                      | Sem proteção (acesso a `apps.audit.AuditLog` para forense)                 | `MIDDLEWARE` em `base.py:67`; lib `django-axes==8.3.1`                                                                          |
| **Let's Encrypt**                | 🔴 Planejado        | TLS certbot --nginx + auto-renew                    | Nenhuma em Django (cron do certbot)                                                                                                                 | Auto-renew via `certbot.timer` systemd                                     | `/etc/nginx/sites-available/interpop` (HOSTING-DEPLOY-PLAN §371-388)                                                            |
| **Google OAuth** (B10)           | 🔴 Planejado        | Login social via django-allauth                     | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                                                                                                          | Login email/senha existente (já funciona)                                  | HOSTING-DEPLOY-PLAN §A.8.2 (provider setup); biblioteca ainda não instalada                                                     |
| **Facebook OAuth** (B10)         | 🔴 Planejado        | Idem Google                                         | `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`                                                                                                            | Idem                                                                       | HOSTING-DEPLOY-PLAN §A.8.3                                                                                                      |

---

## 2. Seções por integração

### 2.1 Cloudflare (DNS + WAF + CDN) — ADR-003

- **Status**: Planejado. Configurar **apenas após** registrar domínio (`interpop.cc`).
- **Por que dependemos**: ADR-005 deixa KVM 1 vulnerável a share viral sem CDN.
- **Funções no perímetro** (HOSTING-DEPLOY-PLAN §92-111): proxy laranja em `interpop.cc` + `www`; WAF managed rules; Bot Fight Mode; Cache de HTML/CSS/JS/imagens; SSL/TLS modo Full (strict).
- **Confiança em `X-Forwarded-For`**: extraído em `apps/audit/utils.get_client_ip` (consumido por `AuditLog` e por django-axes). Vulnerabilidade conhecida — observação operacional 873 do auditor: header é trust-leftmost sem validação de proxy. Hardening pendente.
- **Plano B**: DNS A apontando direto ao IP do VPS — funciona, perde CDN/WAF, exposto a DDoS.
- **ADR**: [ADR-003](../../planning/adrs/ADR-003-cloudflare-pos-dominio.md).

### 2.2 Cloudflare Turnstile — ADR-007

- **Status**: Planejado. Depende do Cloudflare ativo (2.1).
- **Para**: newsletter subscribe, comentário com link a partir do 3º, password reset.
- **Por que não reCAPTCHA**: dispara cookie do Google → exige banner LGPD. Turnstile é invisível e sem cookie.
- **Env vars planejadas** (HOSTING-DEPLOY-PLAN:898): `CLOUDFLARE_TURNSTILE_SECRET`.
- **Plano B**: honeypot + rate limit (já existe em `apps/audit`); reCAPTCHA é trade-off jurídico rejeitado.
- **ADR**: [ADR-007](../../planning/adrs/ADR-007-cloudflare-turnstile.md).

### 2.3 SendGrid (email) — ADR-004

- **Status**: Decidido na ADR-004; **não usado no código** atualmente. Implementação real é Django `EmailBackend` SMTP genérico:
  - `backend/config/settings/base.py:225-230` — defaults para Gmail SMTP (`smtp.gmail.com`, port 587, TLS).
  - `backend/config/settings/production.py:58-64` — mesmo backend, lê `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL` via decouple.
  - `backend/config/settings/development.py:35-40` — `console.EmailBackend` por padrão; `USE_REAL_EMAIL=True` faz fallback para SMTP.
- **Migração para SendGrid SMTP**: trocar `EMAIL_HOST=smtp.sendgrid.net`, `EMAIL_HOST_USER=apikey`, `EMAIL_HOST_PASSWORD=<api_key>`. Sem biblioteca extra.
- **Onde dispara**: 4 fluxos identificados pela ADR-009 — password reset (`users/views.py`), article publish (`articles/signals.py`), ban request notify (`moderation/signals.py`), welcome (`newsletter/views.py` + `newsletter/signals.py`). Todos devem rodar via Celery quando ADR-009 fechar.
- **Plano B**: Postmark (50/dia free) — rejeitado por preferência declarada na ADR-004; AWS SES (custo variável + complexidade).
- **ADR**: [ADR-004](../../planning/adrs/ADR-004-sendgrid-email.md).

### 2.4 Sentry — ADR-013

- **Status**: Pré-configurado. Init em `production.py:27` chama `init_sentry(environment='production')`.
- **Comportamento sem `SENTRY_DSN`**: no-op silencioso, loga info e retorna `False` (`sentry.py:62-64`).
- **Hooks**:
  - `_before_send` dropa eventos cujo `request.url` termina com `/healthz` ou `/healthz/` (observação 872 do auditor: vulnerável a `?probe=1` na URL — bug aberto).
  - `_scrub` recursivo redige `password*`, `*_token`, `authorization`, `cookie`, `email`, `cpf`, `phone`, `sendgrid_api_key`, `secret_key`, `jwt_signing_key` (até depth 6).
- **Sampling**: `traces_sample_rate=0.1`, `profiles_sample_rate=0.05`, `send_default_pii=False`.
- **Release tagging**: usa `GIT_SHA` env (primeiros 12 chars), default `'unknown'`.
- **Plano B**: logs JSON estruturados em journald (`python-json-logger` + `RequestContextFilter` injeta `request_id` + `user_id`); `AuditLog` no Postgres para eventos sensíveis.
- **ADR**: [ADR-013](../../planning/adrs/ADR-013-observability-gate.md).
- **Arquivo**: [`backend/apps/audit/sentry.py`](../../../backend/apps/audit/sentry.py).

### 2.5 Backblaze B2 (backup offsite)

- **Status**: Planejado. Script `scripts/backup-daily.sh` é STUB (`exit 1`).
- **Stack alvo** (HOSTING-DEPLOY-PLAN §504-555): `pg_dump | gzip -9 | gpg --symmetric AES256` (passphrase em `/etc/interpop/backup-passphrase`, chmod 600) → tarball cifrado de `media/` → `rclone copy` para `b2:interpop-backups/YYYY/MM/`.
- **Retenção**: 7 dailies locais, 30 dias offsite (B2 lifecycle rule).
- **Heartbeat pós-execução**: ping `https://uptime.betterstack.com/api/v1/heartbeat/<token>` (HOSTING-DEPLOY-PLAN:550).
- **Teste de restauração**: spec exige rodar `interpop-restore-test.sh` mensalmente em VM throwaway (HOSTING-DEPLOY-PLAN §558-569).
- **Plano B**: backup local apenas (sem proteção contra falha de host físico Hostinger).
- **Arquivo**: [`scripts/backup-daily.sh`](../../../scripts/backup-daily.sh) (STUB).

### 2.6 UptimeRobot / Better Stack (monitor externo)

- **Status**: Planejado.
- **Função**: bate `https://interpop.cc/healthz/` a cada 1min; alerta Telegram/SMS após 2 checks consecutivos falhando.
- **Endpoint já existe** (ADR-013): `GET /healthz/` em [`backend/apps/audit/health_view.py`](../../../backend/apps/audit/) retorna `{status, db, cache}` em <50ms. 4 testes em `test_health.py`.
- **Plano B**: detecção interna apenas — `systemd Restart=always` reinicia gunicorn/celery em <30s, mas sem aviso ao operador.
- **Spec**: HOSTING-DEPLOY-PLAN §600-606, §683-693 (alertas).

### 2.7 GitHub Actions (CI/CD)

- **Status**: Ativo.
- **Workflows**:
  1. **`ci.yml`** — backend (pytest + `--cov-fail-under=40`) + frontend (tsc + eslint + prettier + vitest + build). `concurrency` cancela runs anteriores em PR. Caches: `uv` via `astral-sh/setup-uv@v3` + `actions/setup-node@v4` (npm cache).
  2. **`security.yml`** — gitleaks (full history), pip-audit, npm audit, bandit, semgrep. Todos em `continue-on-error: true` (baseline). Cron domingo 06:00 UTC.
  3. **`branch-gate.yml`** — required status check em PRs para `main`: head_ref deve ser `develop`.
- **Deploy**: workflow `deploy.yml` planejado, **não existe** (HOSTING-DEPLOY-PLAN §A.3). Deploy hoje é manual via SSH no VPS futuro.
- **Dependabot**: weekly Monday 06:00 BRT em 3 ecossistemas (pip / npm / github-actions), target `develop`. Ignores listados na §STACK §Dependabot.
- **Plano B**: rodar `pytest`, `npm test`, `gitleaks` local antes do push.

### 2.8 MSW (Mock Service Worker) — dev-only

- **Status**: Ativo, **apenas em DEV**.
- **Função**: intercepta `/api/v1/search/articles/` para iterar UI sem backend. Tree-shaken do bundle de prod.
- **Wiring**: `src/main.tsx:33-41` faz `dynamic import('./mocks/browser')` somente se `import.meta.env.DEV` for true e a URL não contiver `?msw=off`. `onUnhandledRequest: 'bypass'` deixa requests não-mockados passar.
- **Worker SW**: requer `npx msw init public/ --save` uma vez para gerar `public/mockServiceWorker.js` (config em `package.json:83-87`).
- **Handlers**: [`src/mocks/handlers/search.ts`](../../../src/mocks/handlers/search.ts) e `handlers/index.ts`.
- **Plano B**: `?msw=off` na URL desliga e aponta para Django local em `:8000`.

### 2.9 django-axes (brute-force protection)

- **Status**: Ativo.
- **Função**: 5 falhas / 30min trava conta; integrado em `MIDDLEWARE` (`base.py:67`).
- **Forense**: cada falha logada também em `apps.audit.AuditLog` (login attempt). Fail2ban tem filtro custom planejado para ler esses logs (HOSTING-DEPLOY-PLAN §216-225).
- **Plano B**: sem proteção (acesso só via `AuditLog`).
- **Lib**: `django-axes==8.3.1` (`backend/pyproject.toml:9`).

### 2.10 Let's Encrypt (TLS)

- **Status**: Planejado. Depende de domínio + VPS provisionado.
- **Stack alvo**: `certbot --nginx -d interpop.cc -d www.interpop.cc`, renew automático via `certbot.timer` systemd.
- **TLS config**: TLS 1.3 only, ssl_stapling on (HOSTING-DEPLOY-PLAN §379-388). Mozilla SSL Config Generator (modern profile). Meta SSL Labs **A+**.
- **Plano B**: Cloudflare Origin CA cert (válido só atrás de Cloudflare).

### 2.11 OAuth providers (Google + Facebook) — B10

- **Status**: Planejado. Spec operacional em HOSTING-DEPLOY-PLAN §A.8.
- **Library**: `django-allauth[socialaccount]` ≥0.60 (ainda não em `pyproject.toml`).
- **Env vars**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` — entram na rotação trimestral.
- **Callbacks**:
  - Google: `https://interpop.cc/accounts/google/login/callback/`
  - Facebook: `https://interpop.cc/accounts/facebook/login/callback/` (Facebook **não** aceita HTTP — testes locais exigem ngrok / cloudflared).
- **Trade-off conhecido**: allauth assume sessões Django; projeto usa JWT cookie httpOnly. Custom `SocialAccountAdapter.save_user` chama `issue_tokens_for_user(user, response)` (HOSTING-DEPLOY-PLAN §1020).
- **Plano B**: login email/senha existente continua funcional.

---

## 3. Variáveis de ambiente — inventário consolidado

Não há `.env.example` no repositório (anti-padrão pendente). Variáveis lidas via `python-decouple` em `backend/config/settings/`:

| Env var                                                              | Onde lida                         | Default                                                           | Obrigatória em prod                    |
| -------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------- | -------------------------------------- |
| `SECRET_KEY`                                                         | `base.py:12`                      | (sem default — falha)                                             | ✅                                     |
| `SEARCH_CURSOR_HMAC_SECRET`                                          | `base.py` + `production.py:18-23` | `SECRET_KEY` em dev; **deve diferir** em prod (hard-fail F2-B-03) | ✅                                     |
| `ALLOWED_HOSTS`                                                      | `production.py:29`                | (sem default)                                                     | ✅                                     |
| `CORS_ALLOWED_ORIGINS`                                               | `production.py:31`                | (sem default)                                                     | ✅                                     |
| `CSRF_TRUSTED_ORIGINS`                                               | `production.py:32`                | (sem default)                                                     | ✅                                     |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD`                                  | `production.py:37-39`             | —                                                                 | ✅                                     |
| `DB_HOST`, `DB_PORT`                                                 | `production.py:40-41`             | `localhost`, `5432`                                               | —                                      |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD` | `production.py:59-62`             | port 587                                                          | ✅ (se enviar email)                   |
| `DEFAULT_FROM_EMAIL`                                                 | `base.py:225`, `production.py:64` | `noreply@interpop.com`                                            | recomendável                           |
| `USE_REAL_EMAIL`                                                     | `development.py:37`               | `False`                                                           | dev only                               |
| `SENTRY_DSN`                                                         | `sentry.py:61`                    | empty → no-op                                                     | opcional (gate de go-live por ADR-013) |
| `SENTRY_TRACES_SAMPLE_RATE`                                          | `sentry.py:77`                    | `0.1`                                                             | —                                      |
| `SENTRY_PROFILES_SAMPLE_RATE`                                        | `sentry.py:79`                    | `0.05`                                                            | —                                      |
| `GIT_SHA`                                                            | `sentry.py:84`                    | `'unknown'`                                                       | recomendável (release tagging)         |
| `HOSTNAME`                                                           | `sentry.py:86`                    | `'interpop'`                                                      | —                                      |

**Planejadas** (em HOSTING-DEPLOY-PLAN, ainda sem código):
`JWT_SIGNING_KEY`, `REDIS_PASSWORD`, `SENDGRID_API_KEY` (ou seguir SMTP), `CLOUDFLARE_TURNSTILE_SECRET`, `BACKUP_PASSPHRASE`, `B2_KEY_ID`, `B2_APPLICATION_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `TELEGRAM_WEBHOOK`.

---

## 4. Cross-references

- Stack consolidado: [`STACK.md`](./STACK.md)
- Visão arquitetural: [`docs/architecture/overview.md`](../../architecture/overview.md) — §7 Observability lista os mesmos pontos sob outra perspectiva
- Deploy operacional + hardening: [`docs/planning/HOSTING-DEPLOY-PLAN.md`](../../planning/HOSTING-DEPLOY-PLAN.md)
- ADRs:
  - [ADR-001](../../planning/adrs/ADR-001-celery-background-queue.md) — Celery
  - [ADR-003](../../planning/adrs/ADR-003-cloudflare-pos-dominio.md) — Cloudflare
  - [ADR-004](../../planning/adrs/ADR-004-sendgrid-email.md) — SendGrid
  - [ADR-005](../../planning/adrs/ADR-005-hostinger-kvm1.md) — KVM 1
  - [ADR-006](../../planning/adrs/ADR-006-devsecops-embedded.md) — DevSecOps embedded
  - [ADR-007](../../planning/adrs/ADR-007-cloudflare-turnstile.md) — Turnstile
  - [ADR-009](../../planning/adrs/ADR-009-celery-gate-deploy.md) — Celery hard-gate
  - [ADR-013](../../planning/adrs/ADR-013-observability-gate.md) — Sentry + healthz + JSON LOGGING
- Roadmap mestre: [`docs/planning/Improvement-system.md`](../../planning/Improvement-system.md) — §6.5 B10 (OAuth), §11.6 (security backlog), §12 (DORA + observability).

---

_Última atualização: 2026-06-09. Próxima revisão: ao subir o primeiro deploy real (que vai mover várias linhas de Planejado → Ativo)._
