# STACK — Interpop

> Inventário do que o projeto USA hoje (não o que ele aspira a usar).
> Versões extraídas dos lockfiles (`package-lock.json`, `backend/uv.lock`) em
> 2026-06-09 — preferem o lock à faixa semver do manifest.
> Atualizar em cada Sprint que mude uma versão major.

---

## 1. Frontend (Node + Vite)

Manifest principal: [`/home/gabriel/Documentos/Projetos/interpop/package.json`](../../../package.json).
Lock: [`/home/gabriel/Documentos/Projetos/interpop/package-lock.json`](../../../package-lock.json).

### Runtime — `dependencies`

| Pacote                            | Versão (lock) | Range manifest | Propósito                                                                                                                                               |
| --------------------------------- | ------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `react`                           | 19.2.6        | `^19.2.6`      | UI library (`package.json:32`)                                                                                                                          |
| `react-dom`                       | 19.2.6        | `^19.2.6`      | DOM renderer (`package.json:33`)                                                                                                                        |
| `react-router-dom`                | 7.15.1        | `^7.15.1`      | Routing v7 (`package.json:35`)                                                                                                                          |
| `@tanstack/react-query`           | 5.101.0       | `^5.101.0`     | Server-state cache; configurado em `src/main.tsx:18-27` (`refetchOnWindowFocus:false`, `retry:1`, `staleTime` e `gcTime` importados do `searchService`) |
| `axios`                           | 1.16.1        | `^1.16.1`      | HTTP client com interceptor de refresh JWT (`src/services/`)                                                                                            |
| `mark.js`                         | 8.11.1        | `^8.11.1`      | Highlight de termos na busca editorial                                                                                                                  |
| `recharts`                        | 3.8.1         | `^3.8.1`       | Gráficos do dashboard admin                                                                                                                             |
| `react-error-boundary`            | 6.1.1         | `^6.1.1`       | Error boundary declarativo                                                                                                                              |
| `@fontsource-variable/inter`      | 5.2.8         | `^5.2.8`       | Self-host de fonte (P1 do HOSTING-DEPLOY-PLAN §17)                                                                                                      |
| `@fontsource-variable/montserrat` | 5.2.8         | `^5.2.8`       | Idem                                                                                                                                                    |
| `@fontsource-variable/newsreader` | 5.2.10        | `^5.2.10`      | Idem (tipografia editorial)                                                                                                                             |

### DevDependencies (selecionadas)

| Pacote                            | Versão (lock) | Propósito                                                                                |
| --------------------------------- | ------------- | ---------------------------------------------------------------------------------------- |
| `vite`                            | 8.0.14        | Build tool / dev server (`vite.config.ts`)                                               |
| `@vitejs/plugin-react`            | 6.0.2         | React fast refresh                                                                       |
| `typescript`                      | 6.0.3         | TS compiler (range `~6.0.2` no manifest)                                                 |
| `typescript-eslint`               | 8.59.4        | TS lint integration                                                                      |
| `eslint`                          | 10.4.0        | Linter (config flat em `eslint.config.js`)                                               |
| `@eslint/js`                      | 10.0.1        | Configs recommended                                                                      |
| `eslint-config-prettier`          | 10.1.8        | Desliga regras conflitantes com Prettier                                                 |
| `eslint-plugin-react-hooks`       | 7.1.1         | Hooks rules (regra `set-state-in-effect` rebaixada para `warn` em `eslint.config.js:29`) |
| `eslint-plugin-react-refresh`     | 0.5.2         | Vite fast-refresh guard (`only-export-components` rebaixada — ver `eslint.config.js:34`) |
| `prettier`                        | 3.8.3         | Formatter (`.prettierrc` — 2-space, single-quote, trailing-all, printWidth 80)           |
| `vitest`                          | 4.1.7         | Test runner                                                                              |
| `@vitest/coverage-v8`             | 4.1.7         | Coverage v8                                                                              |
| `@vitest/ui`                      | 4.1.7         | UI runner                                                                                |
| `jsdom`                           | 29.1.1        | DOM em testes                                                                            |
| `@testing-library/react`          | 16.3.2        | Testing helpers                                                                          |
| `@testing-library/jest-dom`       | 6.9.1         | Matchers DOM                                                                             |
| `@testing-library/user-event`     | 14.6.1        | Eventos simulados                                                                        |
| `vitest-axe`                      | 0.1.0         | A11y assertions em testes                                                                |
| `@axe-core/react`                 | 4.11.3        | A11y runtime (dev)                                                                       |
| `msw`                             | 2.14.6        | Mock Service Worker (dev-only — ver §INTEGRATIONS)                                       |
| `husky`                           | 9.1.7         | Git hooks (`.husky/`)                                                                    |
| `lint-staged`                     | 17.0.5        | Pre-commit (config em `package.json:71-82`)                                              |
| `@commitlint/cli`                 | 19.8.1        | Conventional commits (`.commitlintrc.json`)                                              |
| `@commitlint/config-conventional` | 19.8.1        | Preset                                                                                   |
| `concurrently`                    | 9.2.1         | `npm run dev:all` (FRONT + BACK)                                                         |
| `rollup-plugin-visualizer`        | 7.0.1         | Bundle size report no build                                                              |
| `@types/react`                    | 19.2.15       | Types                                                                                    |
| `@types/react-dom`                | 19.2.3        | Types                                                                                    |
| `@types/node`                     | 24.12.2       | Types                                                                                    |
| `@types/mark.js`                  | 8.11.12       | Types                                                                                    |
| `globals`                         | 17.6.0        | ESLint globals catalog                                                                   |

---

## 2. Backend (Python + uv)

Manifest: [`backend/pyproject.toml`](../../../backend/pyproject.toml).
Lock: [`backend/uv.lock`](../../../backend/uv.lock).

### Runtime — `[project.dependencies]`

| Pacote                          | Versão (lock) | Pin manifest | Propósito                                                                    |
| ------------------------------- | ------------- | ------------ | ---------------------------------------------------------------------------- |
| `django`                        | 5.1.4         | `==5.1.4`    | Framework principal (pin exato — upgrade gated em B16 do Improvement-system) |
| `djangorestframework`           | 3.17.1        | `==3.17.1`   | DRF / API REST                                                               |
| `djangorestframework-simplejwt` | 5.5.1         | `==5.5.1`    | JWT auth — usado em cookie httpOnly                                          |
| `django-cors-headers`           | 4.9.0         | `==4.9.0`    | CORS middleware                                                              |
| `django-axes`                   | 8.3.1         | `==8.3.1`    | Brute-force protection (5 fail / 30min)                                      |
| `django-filter`                 | 24.3          | `==24.3`     | Query filtering DRF (25+ exige Django 5.2 — ignored no Dependabot)           |
| `django-celery-beat`            | 2.9.0         | `>=2.9.0`    | Scheduler tipo cron (no INSTALLED_APPS)                                      |
| `celery[redis]`                 | 5.6.3         | `>=5.6.3`    | Background tasks (ADR-001 + ADR-009)                                         |
| `psycopg2-binary`               | 2.9.12        | `==2.9.12`   | Driver Postgres                                                              |
| `argon2-cffi`                   | 23.1.0        | `==23.1.0`   | Hash de senha Argon2                                                         |
| `python-decouple`               | 3.8           | `==3.8`      | Env vars (`config(...)` em settings)                                         |
| `python-json-logger`            | 4.1.0         | `>=4.1.0`    | Formatter JSON em LOGGING (`base.py`)                                        |
| `python-slugify`                | 8.0.4         | `==8.0.4`    | Slug generation                                                              |
| `pillow`                        | 12.2.0        | `==12.2.0`   | Imagens (capas de artigo)                                                    |
| `gunicorn`                      | 23.0.0        | `==23.0.0`   | WSGI server prod                                                             |
| `whitenoise`                    | 6.12.0        | `==6.12.0`   | Static serving (`MIDDLEWARE[1]` em `base.py`)                                |
| `sentry-sdk`                    | 2.60.0        | `>=2.60.0`   | Error tracking — init em `apps/audit/sentry.py`                              |

Transitives notáveis (do lock):

- `redis` 6.4.0 (cliente Python — broker + cache)
- `kombu` 5.6.2 (transport Celery)
- `cron-descriptor` 1.4.5 (pinned <2.0 por constraint do django-celery-beat — ver `.github/dependabot.yml:74-78`)

### Dev — `[dependency-groups].dev`

| Pacote          | Versão (lock) | Propósito             |
| --------------- | ------------- | --------------------- |
| `pytest`        | 9.0.3         | Test runner           |
| `pytest-django` | 4.12.0        | Django integration    |
| `pytest-cov`    | 7.1.0         | Coverage              |
| `pytest-mock`   | 3.15.1        | Mock fixtures         |
| `factory-boy`   | 3.3.3         | Factories             |
| `freezegun`     | 1.5.5         | Freeze time em testes |

Config pytest: [`backend/pytest.ini`](../../../backend/pytest.ini). Conftest: [`backend/conftest.py`](../../../backend/conftest.py).

---

## 3. Banco de dados

| Ambiente        | Engine                                                                                                       | Driver                                                        | Onde está configurado                                                                                                                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Produção        | **PostgreSQL 16** (alvo; `pg_dump` em [`HOSTING-DEPLOY-PLAN.md:518`](../../planning/HOSTING-DEPLOY-PLAN.md)) | `django.db.backends.postgresql` via `psycopg2-binary==2.9.12` | [`backend/config/settings/production.py:34-47`](../../../backend/config/settings/production.py) — env vars `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST` (default `localhost`), `DB_PORT` (default `5432`), `CONN_MAX_AGE=60`, `OPTIONS.sslmode='require'` |
| Desenvolvimento | **SQLite 3** (`db.sqlite3` no `.gitignore`)                                                                  | `django.db.backends.sqlite3`                                  | [`backend/config/settings/development.py:27-31`](../../../backend/config/settings/development.py)                                                                                                                                                           |

Tunning Postgres alvo (em `HOSTING-DEPLOY-PLAN.md:301-310`): `shared_buffers=512MB`, `effective_cache_size=2GB`, `max_connections=50`, `random_page_cost=1.1` (SSD), `log_min_duration_statement=500`.

Cache + broker em prod: **Redis** local (`maxmemory 100mb`, `allkeys-lru`, `requirepass` — `HOSTING-DEPLOY-PLAN.md:314-329`). Em dev: `LocMemCache` + `CELERY_TASK_ALWAYS_EAGER=True`.

---

## 4. Tooling / CI

### Versões de runtime fixadas

| Onde        | Versão                     | Arquivo                                          |
| ----------- | -------------------------- | ------------------------------------------------ |
| Node        | **22** (linha única)       | [`.nvmrc`](../../../.nvmrc)                      |
| Node engine | `>=20.19 <21 \|\| >=22.12` | `package.json:6-8`                               |
| Python      | `>=3.12`                   | `backend/pyproject.toml:4`                       |
| uv          | `latest` em CI             | `.github/workflows/ci.yml:40`, `security.yml:60` |

### CI workflows (GitHub Actions)

| Workflow                                                        | Disparadores                                | Jobs                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`ci.yml`](../../../.github/workflows/ci.yml)                   | PR + push em `develop` e `main`             | `backend` (uv sync --frozen + `python manage.py check --deploy` + `pytest --cov-fail-under=40` + artifact `coverage.xml`); `frontend` (Node 22 + `npm ci` + `tsc --noEmit` + `eslint` + `prettier --check` + `vitest run --coverage` + `vite build` + artifact `dist/`)                                                             |
| [`security.yml`](../../../.github/workflows/security.yml)       | PR + push + cron domingo 06:00 UTC + manual | `gitleaks` (full history); `pip-audit` (`requirements.txt`, strict — `continue-on-error: true`); `npm audit` (omit dev, level moderate — `continue-on-error: true`); `bandit` (`apps/`, level low+ — `continue-on-error: true`); `semgrep` (`p/django`, `p/python`, `p/javascript`, `p/security-audit` — `continue-on-error: true`) |
| [`branch-gate.yml`](../../../.github/workflows/branch-gate.yml) | PR em `main`                                | Bloqueia PR cuja `head_ref` não seja `develop`                                                                                                                                                                                                                                                                                      |

Gate de cobertura ativo: **backend 40%** (sobe 10pp/sprint até 80% conforme `AGENTS.md §6.2`). Frontend roda `npm run test:cov` mas o gate atual de 30% citado no `ci.yml:89` é via vitest config — não há `--coverage-fail-under` no comando.

### Hooks de git

| Hook       | Ferramenta          | Ação                                                                                                       |
| ---------- | ------------------- | ---------------------------------------------------------------------------------------------------------- |
| pre-commit | husky + lint-staged | `.husky/` → roda `eslint --fix` + `prettier --write` nos arquivos staged (escopos em `package.json:71-82`) |
| commit-msg | commitlint          | `.commitlintrc.json` — Conventional Commits (`@commitlint/config-conventional`)                            |

### Dependabot

[`.github/dependabot.yml`](../../../.github/dependabot.yml): 3 ecossistemas (pip em `/backend`, npm em `/`, github-actions em `/`), semanal segunda 06:00 BRT, target `develop`. Ignores ativos: `django` major+minor (B16 do Improvement-system), `django-filter` major (exige Django 5.2), `cron-descriptor` major (parent django-celery-beat 2.9.0 pinned <2.0).

### Linters / Formatters

- **ESLint flat config** ([`eslint.config.js`](../../../eslint.config.js)) — ignora `dist`, `node_modules`, `backend`. Extends: `js.configs.recommended`, `tseslint.configs.recommended`, `react-hooks/flat.recommended`, `react-refresh/vite`, `eslint-config-prettier` (último para anular regras conflitantes).
- **Prettier** ([`.prettierrc`](../../../.prettierrc)) — `semi:true`, `singleQuote:true`, `trailingComma:'all'`, `printWidth:80`, `tabWidth:2`.
- **Backend SAST**: bandit + semgrep via `security.yml` (sem ruff/mypy configurados como gate hoje).

### Stubs ainda não implementados

[`scripts/`](../../../scripts/) contém 4 stubs com header `STATUS: STUB. NÃO IMPLEMENTADO.` e `exit 1` (proteção contra invocação acidental):

- `deploy.sh` — automação de deploy (spec em HOSTING-DEPLOY-PLAN §A.2)
- `backup-daily.sh` — `pg_dump` + sync para B2/R2
- `rotate-secrets.sh` — rotação trimestral de `SECRET_KEY`, `JWT_SIGNING_KEY`
- `weekly-capacity-report.sh` — relatório DORA + métricas semanais

O único script funcional é `md-to-pdf.sh` (gera reports de teste em `docs/tests/reports-pdf/`).

---

## 5. Hosting

| Item     | Especificação                                                                              |
| -------- | ------------------------------------------------------------------------------------------ |
| Provedor | **Hostinger KVM 1** (ADR-005)                                                              |
| vCPU     | 1                                                                                          |
| RAM      | 4 GB                                                                                       |
| Disco    | 50 GB SSD                                                                                  |
| IPv4     | Dedicado                                                                                   |
| Custo    | ~R$ 40/mês                                                                                 |
| OS alvo  | Ubuntu (kernel 6.x — derivado de `os.uname()` referenciado em `weekly-capacity-report.sh`) |

Componentes na mesma VM (HOSTING-DEPLOY-PLAN §"Stack definida"):

| Camada           | Como roda                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| Frontend         | Build estático Vite servido pelo Nginx (root `/var/www/interpop/dist`)                                                |
| Backend Django   | Gunicorn (3 workers, unix socket `/var/run/interpop/gunicorn.sock`) atrás de Nginx                                    |
| Banco            | PostgreSQL local                                                                                                      |
| Cache + broker   | Redis local                                                                                                           |
| Worker           | Celery worker (systemd unit)                                                                                          |
| Scheduler        | django-celery-beat (systemd unit)                                                                                     |
| Media            | `/var/www/interpop/media/` servido pelo Nginx (migração para B2/R2 + CDN em B12)                                      |
| HTTPS            | Let's Encrypt via `certbot --nginx`                                                                                   |
| Process manager  | systemd (gunicorn-interpop, celery-worker-interpop, celery-beat-interpop) — hardening em HOSTING-DEPLOY-PLAN §227-281 |
| WAF + CDN + DDoS | Cloudflare Free na frente (ADR-003)                                                                                   |

Capacity estimada (HOSTING-DEPLOY-PLAN §134-141): consumo nominal ~1,4 GB com folga de 2,6 GB. Upgrade para KVM 2 (8 GB) gated em ≥30k MAU sustentado (ADR-005) ou ≥80% RAM por 1h (HOSTING-DEPLOY-PLAN §867).

**Status real (2026-05-20, HOSTING-DEPLOY-PLAN §913-923)**: VPS escolhido, mas **nada deployado ainda**. Sem domínio registrado, sem Cloudflare, sem Postgres em uso (ainda SQLite local), sem Celery/Redis ativos, sem backups. Vários gates do go-live abertos (ver `Improvement-system.md` C1, S3, S4, ADR-009, A27, A28, A29).

---

## 6. Como rodar local (fast-path)

```bash
# Frontend
npm install
npm run dev                  # http://localhost:5173 — MSW intercepta /api/v1/search/articles/
                             # (use ?msw=off para apontar para Django local)

# Backend
cd backend
uv sync                      # respeita uv.lock; instala Python 3.12 se ausente
uv run python manage.py migrate
uv run python manage.py runserver   # http://127.0.0.1:8000

# Tudo junto
npm run dev:all              # FRONT + BACK via concurrently

# Testes
npm test                     # vitest run
cd backend && uv run pytest --cov=apps --cov-fail-under=40

# Qualidade
npx tsc --noEmit             # typecheck
npm run lint:check
npm run check-format
```

Comandos completos vivem em `AGENTS.md §1`.

---

## 7. Cross-references

- Visão arquitetural: [`docs/architecture/overview.md`](../../architecture/overview.md)
- Deploy / capacity / observability operacional: [`docs/planning/HOSTING-DEPLOY-PLAN.md`](../../planning/HOSTING-DEPLOY-PLAN.md)
- Roadmap mestre + 14 ADRs ativos: [`docs/planning/Improvement-system.md`](../../planning/Improvement-system.md)
- ADRs canônicos (relevantes ao stack):
  - [ADR-001](../../planning/adrs/ADR-001-celery-background-queue.md) — Celery + Redis
  - [ADR-005](../../planning/adrs/ADR-005-hostinger-kvm1.md) — Hostinger KVM 1
  - [ADR-009](../../planning/adrs/ADR-009-celery-gate-deploy.md) — Celery gate de deploy
  - [ADR-010](../../planning/adrs/ADR-010-api-v1-versioning.md) — `/api/v1/`
  - [ADR-013](../../planning/adrs/ADR-013-observability-gate.md) — Sentry + JSON LOGGING + `/healthz/`
- Política de testes: [`docs/tests/testing-standards.md`](../../tests/testing-standards.md)
- Integrações externas: [`INTEGRATIONS.md`](./INTEGRATIONS.md)

---

_Última atualização: 2026-06-09. Próxima revisão: ao subir Django para 5.2 (B16), ou ao deployar primeiro VPS (que ativa Redis/Postgres/Celery em prod)._
