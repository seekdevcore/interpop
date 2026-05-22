# Interpop — Arquitetura (visão geral)

> **Objetivo deste documento**: contar, num único arquivo, **o que** o sistema
> é, **como** ele está montado HOJE (não aspiracionalmente), e **onde**
> procurar detalhes a mais. Substitui `docs/DOCUMENTATION.md` (deletado —
> estava desatualizado em 5+ pontos: ainda falava em `pip`, não citava
> roles `dev`/`editor`, não cobria `audit`, observability, settings split,
> ADRs, nem testes).
>
> **Quando atualizar**: a cada mudança que altere a topologia, stack, ou
> contrato de auth. Não é um doc operacional vivo (esses são os
> `runbooks/`); é um **mapa de leitura** para quem chega no projeto.

---

## 1. O que é o Interpop

Plataforma editorial brasileira de análise crítica do **Soft Power** e da geopolítica da cultura pop (música, moda, cinema, literatura, cultura digital). Produto editorial de leitura longa — KPI primário é **retenção** (sessão longa, retorno semanal), não conversão de funil.

Modelo de uso: leitor anônimo navega → cria conta opcional → comenta/cura → redator publica → admin modera.

---

## 2. Stack atual

| Camada            | Tecnologia                                                                    | Por que                                                                        |
| ----------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Frontend          | **React 19 + TypeScript + Vite + React Router 7**                             | SPA leve, build rápido, type safety                                            |
| Backend           | **Django 5.1 + DRF + Python 3.12**                                            | maturidade do admin, ORM produtivo, ecossistema DRF para REST                  |
| Toolchain Python  | **uv**                                                                        | 10-100× mais rápido que pip; gerencia Python+venv+deps numa ferramenta só      |
| Banco (prod)      | **PostgreSQL 16**                                                             | SSL obrigatório, conn pooling via CONN_MAX_AGE                                 |
| Banco (dev)       | **SQLite 3**                                                                  | zero setup, suficiente para iterar local                                       |
| Cache + broker    | **Redis** (prod) / LocMemCache (dev)                                          | view_count buckets, OG crawler cache, Celery broker                            |
| Tasks assíncronas | **Celery + django-celery-beat**                                               | email (welcome, notification), password reset; CELERY_TASK_ALWAYS_EAGER em dev |
| Auth              | **SimpleJWT** em cookie httpOnly + django-axes (5 fail/30min)                 | XSS-resistant, brute-force protection                                          |
| Static            | **WhiteNoise**                                                                | servir static pelo gunicorn em prod (sem nginx alias)                          |
| Observability     | LOGGING JSON + Sentry + `AuditLog` + `/healthz/`                              | request_id + user_id em toda linha; PII scrubbing no Sentry                    |
| Hosting           | **Hostinger KVM 1** (nginx + gunicorn + systemd + Let's Encrypt + Cloudflare) | custo baixo, controle total                                                    |

Detalhes de dependências: `backend/pyproject.toml` (Python), `package.json` (Node).

---

## 3. Topologia

```
[Cloudflare] → [nginx (TLS 1.3, security headers)] → [gunicorn (3 workers)]
                                                           ↓
                                                     [Django (apps/)]
                                                           ↓
                                            [PostgreSQL]  [Redis]
                                                                ↓
                                                       [Celery worker]
                                                       [Celery beat]
```

- **Cloudflare** absorve DDoS, popula `CF-Connecting-IP` consumido pelo nginx → Django via `X-Forwarded-For` (extraído em `apps.audit.utils.get_client_ip`).
- **nginx** termina TLS, injeta HSTS, serve SPA (dist do Vite) em `/` e proxy_pass `/api/` para gunicorn.
- **gunicorn** roda Django via systemd; restart automático.
- **Celery worker** e **beat** rodam em processos systemd separados; broker Redis local.
- SPA frontend é servida estática (build de Vite) — não há SSR. Crawlers sociais (WhatsApp/Twitter/Facebook) que acessam `/noticia/<slug>` são interceptados pelo `apps.articles.og_middleware.SocialOGMiddleware` que devolve HTML com meta tags OG ricas.

Detalhes de deploy: `docs/planning/HOSTING-DEPLOY-PLAN.md` (1262 LOC; ainda **não implementado** — Sprint dedicada futura).

---

## 4. Auth e roles

Hierarquia: `dev` > `admin` > `editor` > `user`.

| Role              | O que pode                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------- |
| **dev**           | Owner/criador. Admin++. **Imune a ban por design.** Único role que pode promover outros. |
| **admin**         | Tudo: banir, aprovar BanRequest, publicar, deletar. Admins são imunes a ban entre si.    |
| **editor**        | Publicar artigos, abrir `BanRequest` (admin decide).                                     |
| **user** (leitor) | Ler, curtir, comentar. Default em registro público.                                      |

**Sessão**: JWT access (30min) + refresh (30d) em cookies httpOnly + Secure + SameSite=Lax. Rotação silenciosa pelo interceptor axios em 401; rotação no backend implementa blacklist-after-rotation. Toda mudança de senha invalida **todas** as sessões do usuário (S7) via `blacklist_all_user_tokens`.

Detalhe da estratégia de sessão: `docs/planning/session-auth-strategy.md`.

---

## 5. Apps Django (`backend/apps/`)

Cada app é módulo Django padrão (models + serializers + views + urls + tests + admin).

| App          | Responsabilidade                                                                                                                                                                                                                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`      | `User` (custom AbstractUser com role), perfil, auth flow (login/register/refresh/logout), password reset, `PasswordResetToken`, permissions canônicas (`IsAdminUser`, `IsPublisherOrReadOnly`, `IsOwnerOrAdmin`, `IsNotBanned`, `IsEditorOrAdmin`).                                                  |
| `articles`   | `Article`, `Category`, view_count bucket anti-abuse (5min/IP), social OG middleware para crawlers, signal post_save que enfileira notification por email.                                                                                                                                            |
| `comments`   | `Comment` (replies via parent_id), likes, soft-delete.                                                                                                                                                                                                                                               |
| `moderation` | `Ban` (direto admin) + `BanRequest` (editor solicita → admin decide via service layer); admin read-only no Django admin para preservar invariantes.                                                                                                                                                  |
| `newsletter` | `NewsletterSubscriber`, welcome email + per-article notification (Celery task), unsubscribe via token URL.                                                                                                                                                                                           |
| `audit`      | `AuditLog` (trail de mudanças sensíveis), `RequestIDMiddleware` (UUID por request + X-Request-ID header), structured LOGGING (JSON em prod, verbose em dev), Sentry init, `/healthz/` endpoint, security headers middleware (Permissions-Policy + CSP), `AdminMetricsView`, `get_client_ip` utility. |

**Settings split**: `config/settings/{base,development,production}.py`. Base define tudo seguro-por-default (DEBUG=False, HSTS+, CSP); development sobrescreve para SQLite + EAGER tasks + DEBUG=True; production puxa env vars (DB, secrets, SENTRY_DSN, ALLOWED_HOSTS via decouple).

---

## 6. Frontend (`src/`)

| Diretório                      | O que tem                                                                                                                                                 |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/pages/`                   | Rotas top-level: `Home`, `News`, `Article`, `Auth/{Login,Register,ForgotPassword,ResetPassword}`, `Perfil`, `Admin/` (sidebar com 4 tabs), `CreatePost`.  |
| `src/components/`              | Componentes reutilizáveis: `layout/{Navbar,Footer,AuthLayout}`, `ui/{Button,Input,Modal,...}`, `article/{ArticleComments,ArticleShare,...}`, `feedback/`. |
| `src/services/`                | Wrappers axios por domínio (`authService`, `articleService`, `commentService`, etc.). Interceptor de refresh silencioso em 401.                           |
| `src/contexts/AuthContext.tsx` | User autenticado + role check; consumido por `AdminRoute`.                                                                                                |
| `src/router/`                  | `AppRouter` (rotas), `AdminRoute` (gate por role), `ScrollToHashOrTop` (UX).                                                                              |
| `src/styles/`                  | Tokens CSS globais (`global.css`) + tipografia editorial (`article-body.css`).                                                                            |
| `src/utils/`                   | Helpers puros (`categoryVariant`, `renderArticleBody`).                                                                                                   |

**Validação obrigatória de toda entrega frontend**: WCAG 2.2 AA + Core Web Vitals (WAVE + axe DevTools + Lighthouse). Atual: AIM Score 10/10 WAVE.

---

## 7. Observability

| Sinal                 | Onde                                                                                                                                                                                                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Logs estruturados** | LOGGING handler `console` com formatter `json` em prod (`base.py:286+`). Toda linha carrega `request_id` (UUID curto por request via `RequestIDMiddleware`) e `user_id` (contextvar via `RequestContextFilter`).                                                                   |
| **Error tracking**    | Sentry (apps/audit/sentry.py) — auto-init em prod se `SENTRY_DSN` setado; PII scrubbing; traces 10% sample. Releases via `GIT_SHA` env.                                                                                                                                            |
| **Audit trail**       | `apps.audit.models.AuditLog` registra mudanças sensíveis (login, ban, publish) com ator + IP + UA.                                                                                                                                                                                 |
| **Health check**      | `GET /healthz/` retorna `{status, db, cache}` em <50ms — UptimeRobot externo bate cada minuto, 4 testes formais em `test_health.py`.                                                                                                                                               |
| **Security headers**  | Django SecurityMiddleware injeta HSTS + X-Content-Type-Options + X-Frame-Options + Referrer-Policy + Cross-Origin-Opener-Policy. `apps.audit.security_headers_middleware` injeta Permissions-Policy + Content-Security-Policy (Report-Only baseline; flip via `CSP_ENFORCE=True`). |

---

## 8. Testes

10 tipos core + 13 de extensão futura. Política inegociável: cobertura **nunca desce** em PR; gate atual 40% (Sprint 1) → 80% pós-Sprint 4.

Detalhes completos: `docs/tests/testing-standards.md` (700 LOC) + reports em `docs/tests/reports/`. Stack: pytest 9 + pytest-django + pytest-cov + factory-boy + freezegun + pytest-mock (backend); Vitest + Testing Library + Playwright planejados (frontend).

Ver §6 do `AGENTS.md` (política dura) e `Improvement-system.md §12` (evolução de gate).

---

## 9. CI/CD

- **`.github/workflows/ci.yml`** — gate de merge. Jobs paralelos: backend (pytest + cov ≥40%), frontend (tsc + eslint + prettier + build).
- **`.github/workflows/security.yml`** — scans semanais + por PR: gitleaks (secrets), pip-audit (Python CVE), npm audit, bandit (Python SAST), semgrep (multi-lang SAST). Baseline em `continue-on-error` até primeira limpeza.
- **`.github/dependabot.yml`** — PRs semanais (segunda 06:00 BRT) para pip + npm + github-actions.
- **Deploy** — workflow `deploy.yml` **planejado** (`HOSTING-DEPLOY-PLAN.md §A.3`); por enquanto deploy é manual.

---

## 10. Onde procurar o quê

| Pergunta                                       | Documento                                                      |
| ---------------------------------------------- | -------------------------------------------------------------- |
| Como o time trabalha + skills + plugins ativos | `AGENTS.md` (=`CLAUDE.md` symlink)                             |
| Como rodar localmente (comandos uv + npm)      | `AGENTS.md §1` + `README.md`                                   |
| Roadmap mestre + ADRs + Sprint matrix          | `docs/planning/Improvement-system.md` (1578 LOC, 14 ADRs)      |
| Deploy + capacity + observability operacional  | `docs/planning/HOSTING-DEPLOY-PLAN.md`                         |
| Estratégia de sessão JWT detalhada             | `docs/planning/session-auth-strategy.md`                       |
| Como testamos (10+13 tipos + gates)            | `docs/tests/testing-standards.md`                              |
| Reorganização ativa do projeto (Fases A-E)     | `docs/planning/reorganization-proposal-2026-05-21.md`          |
| Runbooks operacionais                          | `docs/runbooks/` (stubs — preencher conforme incidentes reais) |
| Postmortems                                    | `docs/postmortems/` (TEMPLATE + 1 retroativo C1)               |
| Comportamento esperado das IAs                 | `AGENTS.md §0` + `docs/references/PDF Gabarito.pdf`            |
| Referências de UI/UX + dashboards              | `docs/references/` + `skills/`                                 |

---

_Este documento é atualizado em cada Sprint que altere stack, topologia ou contrato de auth. Última atualização: 2026-05-22._
