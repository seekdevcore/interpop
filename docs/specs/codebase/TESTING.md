# TESTING — Interpop

> Resumo executivo consultivo da política de testes do projeto + matriz de "qual tipo aplicar quando" usada pela SDD ao especificar Features. Não duplica a política canônica detalhada: para rationale completo, gates evolutivos, templates de report e os 13 tipos de extensão, ver [`docs/tests/testing-standards.md`](../../tests/testing-standards.md).

## Stack atual

### Backend (Python — `backend/`)

- `pytest 9` + `pytest-django 4.12` + `pytest-cov 7` + `pytest-mock 3.15` (devDeps em `backend/pyproject.toml` → `[dependency-groups].dev`).
- `factory-boy ≥3.3.3` declarado em devDeps mas **ainda sem `factories.py` materializado em nenhum app** — fixtures vivem em [`backend/conftest.py`](../../../backend/conftest.py) (1 fixture por role: `reader_user`, `editor_user`, `admin_user`, `dev_user` + `api_client` + `authed_client_factory`). Gap registrado adiante.
- `freezegun 1.5.5` para NOW determinístico (rotina TDD: congelar antes de testar expiração de JWT/cursor).
- Markers (declarados em [`backend/pytest.ini`](../../../backend/pytest.ini)):
  - `slow` — testes lentos (rodar com `-m slow`).
  - `integration` — exige DB + Redis reais.
  - `unit` — puramente em memória.
  - `requires_postgres` — exige Postgres real (FTS pt-BR, `unaccent`, `pg_trgm`, GIN, `session_replication_role`); **pula silenciosamente em SQLite-dev** conforme ADR-020. Usado hoje em `apps/search/tests/test_service.py`, `test_migrations_0001.py`, `test_migrations_0004.py`, `test_statement_timeout_tx.py`.
- **Estado pós-US30.1 (2026-06-09)**: `352 tests collected` (`uv run pytest --collect-only -q`). Gate ativo: `--cov-fail-under=40` em [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml). Documento canônico §6.2 reporta 82% efetivo no momento da última auditoria — gate evolutivo (sobe 10pp/sprint até 80%).

### Frontend (Node — raiz)

- `vitest 4.1.7` + `@vitest/coverage-v8` + `@testing-library/react 16.3` + `@testing-library/jest-dom 6.9` + `@testing-library/user-event 14.6` + `vitest-axe 0.1` (devDeps em [`package.json`](../../../package.json)).
- `msw 2.14.6` para mocks HTTP em testes E2E-leves de página + smoke do dev server (handler em [`src/mocks/handlers/search.ts`](../../../src/mocks/handlers/search.ts)).
- `jsdom 29.1` como ambiente; setup global em [`src/test/setup.ts`](../../../src/test/setup.ts) (carrega jest-dom matchers, faz `cleanup()` em `afterEach`).
- `globals: false` em [`vitest.config.ts`](../../../vitest.config.ts) — import explícito de `describe/it/expect` (decisão deliberada para legibilidade em CI).
- **`@axe-core/react 4.11`** (axe browser) + `vitest-axe` (axe em jsdom). Sem Playwright instalado hoje — o pacote `playwright` **não consta em devDeps**.
- **Estado pós-US30.1 (2026-06-09)**: `118 tests passed (16 files)` (`npx vitest run`). Gate ativo: `lines / functions / branches / statements: 30` em `vitest.config.ts → test.coverage.thresholds` (baseline; sobe 10pp/sprint).

### Integração / planejado Sprint 5

- **E2E (Playwright)**: ⏳ planejado (ADR-042, ADR-045). Pacote ainda não instalado.
- **Visual regression (Playwright `toHaveScreenshot`)**: ⏳ ADR-042 — 5 estados × 2 temas.
- **Mutation testing**: ⏳ ADR-043 — `mutmut` no backend (busca: `SearchService`), `Stryker` no frontend (`useSearch`).
- **Property-based**: ⏳ ADR-040 — `Hypothesis` no backend (invariantes de domínio da busca), `fast-check` no frontend para utils puros.
- **Contract testing**: ⏳ ADR-041 — `schemathesis` contra OpenAPI + `openapi-typescript` codegen.
- **Load test**: ⏳ ADR-044 — `k6` com seed Zipfiano reproduzível.

## Matriz "qual teste aplicar quando" (consultiva pela SDD)

| Mudança proposta na Feature    | Tipo mínimo (gate de merge)                          | Tipo desejável (roadmap)                 | Onde fica                                                                  |
| ------------------------------ | ---------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------- |
| Função pura / util             | Unit (1+ por branch lógico)                          | Property-based (Hypothesis / fast-check) | `backend/apps/<app>/tests/test_<modulo>.py` · `src/**/__tests__/*.test.ts` |
| Novo endpoint DRF              | Integration: 200 + 400 + 401 + 403 + 429             | Contract (schemathesis vs OpenAPI)       | `apps/<app>/tests/test_views.py`                                           |
| Nova migration (DDL / data)    | Migration test (apply → assert schema) + smoke       | n/a                                      | `apps/<app>/tests/test_migrations_NNNN.py`                                 |
| Novo signal Django             | Integration: triggered + idempotência                | n/a                                      | `apps/<app>/tests/test_signals.py`                                         |
| Mudança em método de ORM model | Unit do método + integration cobrindo callers        | Mutation                                 | per-app                                                                    |
| Novo hook React                | Unit `renderHook` + integration com componente       | Property-based (se for puro)             | `src/**/hooks/__tests__/*.test.tsx`                                        |
| Novo componente React          | Unit (render + interaction) + a11y (`vitest-axe`)    | Visual regression (Playwright Sprint 5)  | `src/**/components/__tests__/*.test.tsx`                                   |
| Novo contexto / state global   | Unit do reducer + integration com Provider           | n/a                                      | `src/**/contexts/__tests__/`                                               |
| Feature flag novo              | Off → 503/200 · On → fluxo feliz                     | n/a                                      | view tests (cf. `test_feature_flag_off_returns_503`)                       |
| Nova permission DRF            | Unit (`has_permission`) + integration por role       | n/a                                      | `apps/<app>/tests/test_permissions.py`                                     |
| Nova task Celery               | Unit (`task.run(...)`) + integration c/ Redis        | n/a                                      | `apps/<app>/tests/test_tasks.py`                                           |
| Mudança de UX visual           | A11y (`vitest-axe`) + smoke manual                   | Visual regression                        | `__tests__/a11y.test.tsx`                                                  |
| Throttle / rate-limit novo     | Integration: respeita limit + 429 com `Retry-After`  | k6 com seed Zipfiano (ADR-044)           | `apps/<app>/tests/test_throttles.py`                                       |
| FTS / extensão Postgres        | Marker `requires_postgres` + plano de skip em SQLite | n/a                                      | `apps/<app>/tests/test_service.py`                                         |

## Gates de PR (hoje — `2026-06-09`)

CI bloqueia merge se:

- **`backend` job** ([`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml#L21)):
  - `uv sync --frozen --dev` falha → falha (deps drift detectado).
  - `uv run pytest --cov=apps --cov-report=xml --cov-report=term --cov-fail-under=40` retorna ≠ 0 → falha (qualquer teste vermelho **ou** cobertura backend < 40%).
  - `uv run python manage.py check --deploy --fail-level WARNING || true` — **não bloqueia hoje** (settings dev tem `SECURE_SSL_REDIRECT=False`); promovido a hard-gate quando production.py virar baseline.
- **`frontend` job**:
  - `npx tsc --noEmit` retorna ≠ 0 → falha (typecheck quebrado).
  - `npm run lint:check` (eslint) ≠ 0 → falha.
  - `npm run check-format` (prettier) ≠ 0 → falha.
  - `npm run test:cov` (vitest c/ thresholds em `vitest.config.ts`: `lines/functions/branches/statements: 30`) ≠ 0 → falha.
  - `npm run build` (`tsc -b && vite build`) ≠ 0 → falha.
- **`security` workflow** ([`.github/workflows/security.yml`](../../../.github/workflows/security.yml)):
  - `gitleaks` — **hard-gate hoje** (sem `continue-on-error`). Push com secret bloqueia merge.
  - `pip-audit` / `npm-audit` / `bandit` / `semgrep` — **baseline com `continue-on-error: true`**. Não bloqueiam hoje; viram hard-gate após primeira limpeza (S15/S16 do Improvement-system §11.6).
- **`branch-gate` workflow** ([`.github/workflows/branch-gate.yml`](../../../.github/workflows/branch-gate.yml)):
  - PR para `main` exige `head_ref == develop`. PR de feature direto pra `main` → bloqueado.

Cobertura **não pode descer** (regra dura §6.2 do `testing-standards.md`). Política: PR sobe ou estabiliza.

## Padrões de fixtures

### Backend — fixtures de role (sem factory-boy ainda)

Em [`backend/conftest.py`](../../../backend/conftest.py) — disponíveis automaticamente em qualquer `test_*.py`:

- `reader_user` — role `USER`. Comenta + curte.
- `editor_user` — role `EDITOR`. Publica + solicita ban.
- `admin_user` — role `ADMIN`. Tudo + bane. Imune a ban.
- `dev_user` — role `DEV`. Dono. Imune absoluto.
- `api_client` — DRF `APIClient` sem auth (hits anônimos).
- `authed_client_factory` — fábrica de clients autenticados via `force_authenticate` (pula login flow; **não usar** se o que se testa é o login em si — usar request real contra `/api/v1/auth/login/`).

**Pendência arquitetural**: `factory-boy` em devDeps sem materialização (zero arquivos `apps/*/tests/factories.py`). Fluxos que precisam de N artigos / N comentários hoje usam `Model.objects.create(...)` ad hoc, sem isolamento entre testes (gera ruído de seed e fragilidade em `assert count`).

### Frontend — MSW handlers cross-origin

Em [`src/mocks/handlers/search.ts`](../../../src/mocks/handlers/search.ts):

- **Pattern matching cross-origin** obrigatório: `'*/api/v1/search/articles/'` (não `/api/...`). Axios usa `baseURL=http://localhost:8000`; sem o `*//`, MSW deixa passar pro backend real (bug descoberto no smoke da Fase 3 da US30.1).
- **Latência artificial** `await delay(300)` antes da resposta — permite visualizar `Skeleton` no dev server.
- **Cenários nomeados via `q`**:
  - `q=kpop` → 142 hits com `query_terms_expanded` para highlight casar plurais pt-BR (ADR-022).
  - `q=qzxzqzx` (sem matches) → 0 hits → EmptyState.
  - `q=flood` → `429` com `retry_after: 23` no body **e** no header `Retry-After` (espelha throttle real, ADR-024).
  - default → 10 hits genéricos.
- Index central em [`src/mocks/handlers/index.ts`](../../../src/mocks/handlers/index.ts) — adicionar recurso = adicionar `<recurso>Handlers` lá.

## Convenções de naming

- **Backend** (real, de `apps/search/tests/test_views.py`):
  - `test_feature_flag_off_returns_503`
  - `test_q_missing_returns_400`
  - `test_q_too_short_returns_400`
  - `test_cursor_invalid_returns_400`
  - `test_date_range_inverted_returns_400`
  - Padrão: `test_<unidade>_<condição>_<resultado_esperado>`. Verbo passado/presente; código HTTP cru quando aplicável.
- **Frontend** (real, de `pages/Buscar/__tests__/Buscar.test.tsx`):
  - `it('renderiza h1 "Buscar" (landmark editorial)')`
  - `it('renderiza form role="search" com input type="search"')`
  - `it('NAO renderiza nenhum role="combobox" (ADR-028)')`
  - Padrão: **`it` em pt-BR**, voz ativa, cita ADR quando o teste é regression de decisão.
- **Arquivos**: `test_*.py` (backend, conforme `pytest.ini` → `python_files`), `*.test.tsx` ou `*.test.ts` (frontend, conforme `vitest.config.ts → test.include`).

## Skip strategy

- **`pytest.mark.requires_postgres`** — único marker de skip semanticamente aceito. Usado em testes que exigem FTS pt-BR, `pg_trigger`, `session_replication_role`, GIN. Pula em SQLite-dev (ADR-020); roda no CI (Postgres em container) e na suite local quando dev liga `DATABASE_URL=postgresql://...`.
- **`pytest.mark.skip`** — proibido sem justificativa **e** Task no backlog para fix. `skip` permanente quebra a §6.2.
- **`it.skip` no frontend**: zero ocorrências no codebase hoje (`grep` em `src/` retorna vazio). Manter assim.

## Como rodar local (fast-path)

```bash
# Backend — todos os testes
cd backend && uv run pytest

# Backend — só uma app
cd backend && uv run pytest apps/search/

# Backend — por nome / substring
cd backend && uv run pytest -k cursor_invalid

# Backend — só Postgres-only (precisa DATABASE_URL postgres)
cd backend && uv run pytest -m requires_postgres

# Backend — pular Postgres-only (default em SQLite)
cd backend && uv run pytest -m "not requires_postgres"

# Backend — cobertura local
cd backend && uv run pytest --cov=apps --cov-report=term-missing

# Frontend — todos
npm test

# Frontend — watch
npm run test:watch

# Frontend — UI
npm run test:ui

# Frontend — cobertura local com gate 30%
npm run test:cov

# Frontend — filtrar por nome
npx vitest -t "renderiza form role"
```

## ADRs de testes que regem o projeto

Todas em [`docs/specs/busca-editorial/adrs/`](../busca-editorial/adrs/):

- **ADR-020** — SQLite-dev fallback com `icontains` + marker `requires_postgres` (fundação do skip strategy).
- **ADR-040** — Property-based via Hypothesis (invariantes de domínio da busca).
- **ADR-041** — Contract testing via `schemathesis` + `openapi-typescript` codegen.
- **ADR-042** — Visual regression via Playwright (`toHaveScreenshot`) — 5 estados × 2 temas.
- **ADR-043** — Mutation testing nightly (`mutmut` backend / `Stryker` frontend) sobre `SearchService` + `useSearch`.
- **ADR-044** — k6 load test com seed Zipfiano reproduzível.
- **ADR-045** — A11y E2E via `axe-playwright` + smoke manual NVDA / VoiceOver.

## Cross-references

- [`docs/tests/testing-standards.md`](../../tests/testing-standards.md) — política canônica detalhada (10 tipos core + 13 tipos extensão + protocolo formal para tipo novo + gates evolutivos + templates de report).
- [`docs/tests/reports/`](../../tests/reports/) — execuções históricas (Markdown, timestamp ISO 8601 UTC-3).
- [`docs/tests/reports-pdf/`](../../tests/reports-pdf/) — PDFs com resumo simples + análise técnica (§6.2).
- [`docs/backlog/README.md`](../../backlog/README.md) — DoD de Feature inclui gate de cobertura.
- [`backend/pytest.ini`](../../../backend/pytest.ini) · [`backend/conftest.py`](../../../backend/conftest.py) · [`vitest.config.ts`](../../../vitest.config.ts) · [`src/test/setup.ts`](../../../src/test/setup.ts) — single sources of truth de config.
- [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml) · [`.github/workflows/security.yml`](../../../.github/workflows/security.yml) · [`.github/workflows/branch-gate.yml`](../../../.github/workflows/branch-gate.yml) — gates de merge.

---

_Atualizado em 2026-06-09 — pós-US30.1: 352 backend tests + 118 frontend tests; gates 40% / 30% confirmados em CI; 7 ADRs Sprint 5 listados; gap `factories.py` registrado._
