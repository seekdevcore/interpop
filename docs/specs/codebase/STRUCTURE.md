# STRUCTURE — Interpop

> Onde vive o quê. Use este doc como mapa antes de adicionar arquivo novo.

---

## Backend tree

```
backend/
├── apps/
│   ├── users/        # Auth (JWT cookie httpOnly), roles dev/admin/editor/user, reset/change senha
│   ├── articles/     # Article + Category, slug unicode, sitemap.xml, robots.txt, OG crawler middleware
│   ├── comments/     # Comment (threaded 1 nível) + CommentLike, soft-delete
│   ├── moderation/   # Ban direto (admin) + BanRequest (editor solicita → admin decide), email assíncrono
│   ├── newsletter/   # NewsletterSubscriber + welcome/article-notification emails, templates HTML/TXT
│   ├── audit/        # Middlewares (RequestID, AuditLog, SecurityHeaders), /healthz, AdminMetrics, Sentry init
│   └── search/       # ✱ Recém-criada (US30.1) — FTS pt-BR Postgres, cursor HMAC, throttles 3 camadas, ADR-016..037
├── config/
│   ├── settings/
│   │   ├── __init__.py
│   │   ├── base.py             # shared (DEBUG=False default, JWT, DRF, Celery, logging)
│   │   ├── development.py      # SQLite, DEBUG=True, CELERY_TASK_ALWAYS_EAGER=True
│   │   └── production.py       # Postgres, HSTS, hard-fails (SEARCH_CURSOR_HMAC_SECRET), Sentry init
│   ├── __init__.py
│   ├── celery.py               # Celery('interpop') + autodiscover_tasks() (apps/<app>/tasks.py)
│   ├── urls.py                 # Root URLConf — /api/v1/ + /healthz/ + /sitemap.xml + /robots.txt + /django-admin/
│   └── wsgi.py                 # gunicorn entrypoint (sem asgi.py — projeto é WSGI-only)
├── media/                      # ImageField uploads (avatars/, covers/) — gitignored
├── templates/                  # Django templates (newsletter usa, demais NÃO)
├── conftest.py                 # Fixtures globais pytest (reader/editor/admin/dev_user, api_client)
├── pytest.ini                  # DJANGO_SETTINGS_MODULE=development, --reuse-db, markers customizados
├── pyproject.toml              # Deps via uv (Django 5.1.4, DRF 3.17, Celery 5.6, pytest 9, factory-boy)
├── uv.lock                     # Lockfile reproduzível (uv sync --frozen em CI/prod)
├── manage.py                   # Django CLI entrypoint
├── seed_test_articles.py       # Script standalone (NÃO management command) — gera artigos seed dev
└── db.sqlite3                  # ⛔ gitignored (dev local)
```

**Sem `asgi.py`**: projeto WSGI-only (gunicorn + systemd). Channels/websockets não fazem parte da stack atual.

**Sem `scripts/` dir**: scripts operacionais vivem em [`management/commands/`](../../../backend/apps/users/management/commands/) (Django CLI) — só `users` e `search` têm pasta `management/` montada hoje. O único standalone soltinho é [`seed_test_articles.py`](../../../backend/seed_test_articles.py) (root do backend).

---

## Onde vive o quê

| Tipo de arquivo                     | Localização canônica                                                                                                                                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modelos do domínio                  | `backend/apps/<app>/models.py`                                                                                                                                                                |
| Serializers DRF                     | `backend/apps/<app>/serializers.py`                                                                                                                                                           |
| Views DRF                           | `backend/apps/<app>/views.py` (+ arquivos temáticos: `health_view.py`, `robots_view.py`)                                                                                                      |
| URLs per-app                        | `backend/apps/<app>/urls.py`                                                                                                                                                                  |
| URLConf raiz                        | [`backend/config/urls.py`](../../../backend/config/urls.py)                                                                                                                                   |
| Permissions canônicas               | [`backend/apps/users/permissions.py`](../../../backend/apps/users/permissions.py) — single source of truth (IsAdminUser, IsPublisherOrReadOnly, IsOwnerOrAdmin, IsNotBanned, IsEditorOrAdmin) |
| Permissions per-app específicas     | (raro — nenhum hoje. Quando aparecer: `apps/<app>/permissions.py`)                                                                                                                            |
| Signals                             | `backend/apps/<app>/signals.py` (com wiring em `apps.py:ready()`)                                                                                                                             |
| AppConfig + signal wiring           | `backend/apps/<app>/apps.py:ready()`                                                                                                                                                          |
| Migrations                          | `backend/apps/<app>/migrations/NNNN_descricao_snake.py`                                                                                                                                       |
| Tests                               | `backend/apps/<app>/tests/test_*.py`                                                                                                                                                          |
| Test fixtures globais               | [`backend/conftest.py`](../../../backend/conftest.py) (4 users por role + api_client + authed_client_factory)                                                                                 |
| Test fixtures locais ao app         | `backend/apps/<app>/tests/conftest.py` (só `comments/tests/conftest.py` hoje)                                                                                                                 |
| Factories factory-boy               | (nenhuma promovida ainda — convenção futura: `apps/<app>/tests/factories.py`)                                                                                                                 |
| Management commands                 | `backend/apps/<app>/management/commands/<cmd>.py` (hoje só `seed_team_users`)                                                                                                                 |
| Tasks Celery                        | `backend/apps/<app>/tasks.py` (`@shared_task`, autodiscover via [`config/celery.py:31`](../../../backend/config/celery.py))                                                                   |
| Service layer                       | `backend/apps/<app>/services.py` — só `users`, `moderation`, `newsletter`, `search` têm                                                                                                       |
| Custom Managers                     | `backend/apps/<app>/managers.py` — só [`users/managers.py`](../../../backend/apps/users/managers.py) (UserManager)                                                                            |
| Auth backends DRF                   | [`backend/apps/users/authentication.py`](../../../backend/apps/users/authentication.py) (JWTCookieAuthentication)                                                                             |
| Custom validators                   | [`backend/apps/users/validators.py`](../../../backend/apps/users/validators.py) (PasswordComplexityValidator)                                                                                 |
| Throttles custom                    | [`backend/apps/search/throttles.py`](../../../backend/apps/search/throttles.py) (3 classes)                                                                                                   |
| URL converters                      | [`backend/apps/articles/converters.py`](../../../backend/apps/articles/converters.py) (`uslug` unicode slug) — registrado UMA vez em `articles/apps.py:ready()`                               |
| Middlewares globais                 | `backend/apps/audit/middleware.py` (RequestID + AuditLog), `apps/audit/security_headers_middleware.py` (Permissions-Policy + CSP), `apps/articles/og_middleware.py` (crawlers sociais)        |
| Health check                        | [`backend/apps/audit/health_view.py:healthz`](../../../backend/apps/audit/health_view.py) — montado em [config/urls.py:21-22](../../../backend/config/urls.py)                                |
| Logging filter (request_id/user_id) | [`backend/apps/audit/logging.py`](../../../backend/apps/audit/logging.py) (RequestContextFilter + ContextVars)                                                                                |
| Sentry init helper                  | [`backend/apps/audit/sentry.py`](../../../backend/apps/audit/sentry.py) — chamado em `production.py:27`                                                                                       |
| Utils compartilhados                | [`backend/apps/audit/utils.py`](../../../backend/apps/audit/utils.py) (`get_client_ip` — X-Forwarded-For aware)                                                                               |
| Email templates                     | [`backend/apps/newsletter/templates/newsletter/emails/`](../../../backend/apps/newsletter/templates/) (welcome.html/txt, article_notification.html/txt) — único app com `templates/` populado |
| Admin metrics dashboard             | [`backend/apps/audit/views.py:AdminMetricsView`](../../../backend/apps/audit/views.py) — endpoint único, não tem app `dashboard/`                                                             |
| SEO public endpoints                | `backend/apps/articles/sitemaps.py:sitemap_xml`, `backend/apps/articles/robots_view.py:robots_txt` — funções soltas, sem APIView                                                              |
| OG meta tags para crawlers sociais  | `backend/apps/articles/og_middleware.py:SocialOGMiddleware` (intercepta /noticia/<slug> com User-Agent de WhatsApp/Twitter/etc.)                                                              |
| Search FTS support                  | `backend/apps/search/{dto,cursors,cache,utils,services,signals}.py` + 5 migrations com RunSQL Postgres-only                                                                                   |

---

## Convenções não óbvias (descobertas durante a leitura)

1. **Schema da busca é controlado por SQL puro, não pelo ORM** — `SearchIndex` e `SearchLog` têm `Meta.managed = False` ([search/models.py:62, 102](../../../backend/apps/search/models.py)). Toda DDL (extension `unaccent`, configuration `pt_unaccent`, função `articles_search_config` IMMUTABLE, trigger PL/pgSQL `trg_articles_sync_search`, índices GIN/composite-parcial/covering) vive em [migrations 0001-0005](../../../backend/apps/search/migrations/). A trigger Postgres é a **fonte de verdade da sincronia** com `articles` — Python NUNCA escreve em `search_index` (ADR-018). Razão técnica: bulk_update, raw SQL, fixture loaddata, pg_restore parcial — todos cenários onde signal Python falharia.

2. **`CREATE INDEX CONCURRENTLY` força `atomic = False` na migration** — Postgres rejeita CONCURRENTLY dentro de transação, e Django wrap migrations em TX por default. Padrão documentado em [search/migrations/0002:13-17](../../../backend/apps/search/migrations/0002_search_indexes.py) e [:91-98](../../../backend/apps/search/migrations/0002_search_indexes.py). **Consequência operacional**: falha parcial nos N statements não rola back automático — operador precisa verificar com `\d+ search_index` e resumir manualmente. Único caso documentado onde `atomic = False` é REQUISITO DURO, não preferência.

3. **`SET LOCAL statement_timeout` exige TX explícita — `with connection.cursor()` aninhado NÃO basta** — o método `_query_postgres` do `SearchService` está dentro de `@transaction.atomic` justamente para isso ([search/services.py:216-235](../../../backend/apps/search/services.py)). Em autocommit, cada `connection.cursor()` abriria sua própria TX implícita e o cap de 500ms morreria ao sair do `with` antes do main query rodar. Invariante #12 quebrava silenciosamente em runtime. Fix F2-B-01 do REVIEW-PHASE-2.

4. **Permissions canônicas concentradas em `users/permissions.py`, não per-app** — `IsEditorOrAdmin` migrou de `apps/moderation/views.py` para [users/permissions.py:65](../../../backend/apps/users/permissions.py) (C14 da reorganização). Razão: permission class refere conceito de role, que vive em `User.Role`. Per-app só ganharia `permissions.py` se a regra fosse genuinamente local (object-level baseado em campo do model do app). Nenhum app tem hoje.

5. **`DEFAULT_PERMISSION_CLASSES` inclui `IsNotBanned` como defesa em profundidade** — [base.py:172](../../../backend/config/settings/base.py). **Gotcha DRF**: quando view declara `permission_classes = [...]`, sobrescreve TODO o default. Para manter a defesa, views privadas DEVEM repetir `IsNotBanned` na lista ([moderation/views.py:19](../../../backend/apps/moderation/views.py), [comments/views.py:31](../../../backend/apps/comments/views.py)). Endpoints públicos (`AllowAny`) ficam OK porque `IsNotBanned` deixa anon passar ([users/permissions.py:60-62](../../../backend/apps/users/permissions.py)).

6. **URL converter custom (`uslug`) é registro GLOBAL, registrado em `apps.py:ready()` UMA vez** — [articles/converters.py:31](../../../backend/apps/articles/converters.py) + [articles/apps.py:17](../../../backend/apps/articles/apps.py). Antes era registrado em `articles/urls.py` + `comments/urls.py`, e a 2ª chamada disparava `RemovedInDjango60Warning` (override de converter já registrado). Lição genérica: converters Django são SINGLETONS no processo — registro em `urls.py` é antipattern para qualquer converter compartilhado.

7. **`RequestIDMiddleware` precisa rodar APÓS `AuthenticationMiddleware` e ANTES de `AuditLogMiddleware`** — ordem documentada em [base.py:62-79](../../../backend/config/settings/base.py). Razão: RequestID precisa ler `request.user` (já populado) e expor o mesmo `request.id` que `AuditLog` consumirá. Quebrar a ordem = audit_log com ID ≠ request_id no log → impossível correlacionar incidente.

8. **Celery autodiscover funciona via convenção `apps/<app>/tasks.py`** — [config/celery.py:31](../../../backend/config/celery.py) `app.autodiscover_tasks()` varre todos os apps em `INSTALLED_APPS` procurando `tasks` module. Nomear o arquivo de outra forma (`async_tasks.py`, `jobs.py`) quebra silenciosamente.

9. **Tasks Celery recebem ID, NÃO objeto Django** — convenção universal: [moderation/tasks.py:27](../../../backend/apps/moderation/tasks.py), [newsletter/tasks.py:27, 57](../../../backend/apps/newsletter/tasks.py), [users/tasks.py:31](../../../backend/apps/users/tasks.py). Razão técnica: Celery serializa argumentos via JSON (`CELERY_TASK_SERIALIZER = 'json'`), models Django não são JSON-serializáveis. Bônus: se o objeto mudar entre enqueue e exec (segundos depois), a task vê estado atualizado. Recarregar via `Model.objects.get(pk=id)` é overhead aceitável e robusto.

10. **Padrão helper `_dispatch_..._sync` para o body Celery** — [newsletter/services.py:62](../../../backend/apps/newsletter/services.py) tem `_dispatch_article_notification_sync(article, *, subscribers=None)` que a task `send_article_notification` wrapeia. Underscore prefix + `_sync` suffix = sinaliza "este helper BLOQUEIA; NUNCA chamar de view; só task pode". Convenção emergente do C11 (rename pós-Celery rollout).

11. **`@transaction.atomic` em service marca CONTRATO operacional** — não basta o helper estar dentro; o decorator (`@transaction.atomic` em [moderation/services.py:20, 54, 73](../../../backend/apps/moderation/services.py)) é PARTE DO CONTRATO público. Tests de regressão usam `mocker.spy(tx, 'atomic')` para garantir que ninguém remove ([moderation/tests/test_services.py:72-80](../../../backend/apps/moderation/tests/test_services.py) — `test_ban_user_uses_atomic_transaction`).

12. **Healthz tem alias sem trailing slash** — [config/urls.py:21-22](../../../backend/config/urls.py) mapeia `/healthz/` E `/healthz` para o mesmo handler. Razão: monitores externos (UptimeRobot, Better Stack) variam comportamento de slash, e o redirect 301 do Django falha o check em alguns deles. Único endpoint com esse padrão; demais respeitam `APPEND_SLASH=True`.

---

## Frontend tree

> **Snapshot**: 2026-06-09. Stack: React 19 + TypeScript ~6 + Vite 8. Entry: `src/main.tsx` → `src/App.tsx` → `src/router/AppRouter.tsx`. Tudo CSR puro (ADR-026); rotas pesadas com `React.lazy()`.

```
src/
├── main.tsx                       # Bootstrap: QueryClient + MSW (DEV) + AuthProvider + StrictMode
├── App.tsx                        # Trivial — só monta <AppRouter />
├── vite-env.d.ts                  # Types do Vite (import.meta.env)
│
├── pages/                         # Cada rota tem seu próprio módulo aqui
│   │
│   ├── Home.tsx + Home.css        # Página flat (sem sub-pastas) — manifesto + hero + carousel
│   ├── Article.tsx + Article.css  # Página flat — render do artigo + comments
│   ├── News.tsx + News.css        # Página flat — arquivo público de artigos
│   ├── Newsletter.tsx + Newsletter.css   # Página flat — inscrição
│   ├── Unsubscribe.tsx            # Cancelamento via token (sem CSS — usa global)
│   ├── Perfil.tsx + Perfil.css    # Perfil do usuário autenticado
│   ├── NotFound.tsx + NotFound.css # 404 com voz editorial (F16)
│   │
│   ├── Buscar/                    # (✱ recém-criada — US30.1, único módulo "feature" completo)
│   │   ├── index.tsx              # Barrel: `export { Buscar as default, Buscar }`
│   │   ├── Buscar.tsx             # Componente principal (página orquestradora)
│   │   ├── Buscar.css             # Estilo da página
│   │   ├── README.md              # Documentação do módulo (mapa + Sprint 5)
│   │   ├── types.ts               # Contrato da API `/api/v1/search/articles/` (espelha DRF)
│   │   ├── components/            # 9 componentes locais
│   │   │   ├── SearchInput.tsx + SearchInput.css
│   │   │   ├── FilterChips.tsx + FilterChips.css
│   │   │   ├── SearchResults.tsx
│   │   │   ├── ResultCard.tsx + ResultCard.css
│   │   │   ├── HighlightedText.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── EmptyResults.tsx
│   │   │   ├── RateLimitedState.tsx
│   │   │   ├── SearchErrorFallback.tsx
│   │   │   ├── Skeletons.tsx
│   │   │   ├── SearchStates.css
│   │   │   └── __tests__/         # ResultCard, HighlightedText, SearchInput, FilterChips, SearchStates
│   │   ├── hooks/                 # 3 hooks LOCAIS — não compartilhar fora de Buscar/
│   │   │   ├── useSearch.ts       # useInfiniteQuery + retry + canonicalKey + _internals
│   │   │   ├── useDebouncedValue.ts  # 15 LoC zero-dep
│   │   │   ├── useSearchParamsState.ts # SSOT da URL
│   │   │   └── __tests__/
│   │   ├── services/
│   │   │   └── searchService.ts   # SSOT de STALE_TIME/GC_TIME (fix H-02)
│   │   └── __tests__/
│   │       ├── Buscar.test.tsx    # smoke da página
│   │       ├── SearchResults.test.tsx
│   │       └── a11y.test.tsx      # vitest-axe — 5 estados + componentes + integração (ADR-045)
│   │
│   ├── Auth/
│   │   ├── Auth.css               # CSS COMPARTILHADO entre 4 telas de auth
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   ├── ForgotPassword.tsx
│   │   └── ResetPassword.tsx
│   │   # ↑ Padrão NÃO óbvio: 4 telas + 1 CSS (irregular vs. resto do projeto)
│   │
│   ├── Admin/                     # 1218 LOC TSX + 1801 LOC CSS — monolito (refactor em backlog)
│   │   ├── index.tsx              # Sidebar com 4 tabs (usuarios/publicacoes/banimentos/metricas)
│   │   ├── Admin.css
│   │   ├── AdminPosts.tsx         # Sub-componente já extraído
│   │   ├── MetricsDashboard.tsx   # Recharts (~50KB gz) — só carrega via /admin lazy
│   │   └── _metrics/              # Convenção `_prefix` para módulos internos (não-rota)
│   │       ├── HeroKpi.tsx
│   │       ├── SmallStat.tsx
│   │       └── ArticleRanking.tsx
│   │
│   ├── CreatePost/                # Export NAMED de Create + Edit (mesmo arquivo, dois named exports)
│   │   ├── index.tsx              # exporta { CreatePost, EditPost }
│   │   └── CreatePost.css
│   │
│   ├── Legal/                     # /termos e /privacidade compartilham parser
│   │   ├── Legal.css
│   │   ├── LegalContent.tsx
│   │   ├── Termos.tsx
│   │   └── Privacidade.tsx
│   │
│   └── About/                     # Mesmo padrão sub-módulo de Buscar (mais simples)
│       ├── index.tsx
│       ├── AboutContent.tsx
│       └── About.css
│
├── components/                    # Componentes compartilhados, agrupados por CATEGORIA semântica
│   ├── ErrorFallback.tsx + ErrorFallback.css  # ErrorBoundary global do app
│   │
│   ├── layout/                    # Shell da página (não-conteúdo)
│   │   ├── Navbar.tsx + Navbar.css
│   │   ├── NavbarUserMenu.tsx     # Sub-componente da Navbar (sem CSS próprio)
│   │   ├── Footer.tsx + Footer.css
│   │   ├── PageLayout.tsx + PageLayout.css  # Wrapper <main> + skip-link
│   │   └── AuthLayout.tsx + AuthLayout.css  # Wrapper das 4 telas Auth
│   │
│   ├── ui/                        # Primitives (poderia virar `components/ui` design system)
│   │   ├── Button.tsx + Button.css
│   │   ├── Input.tsx + Input.css
│   │   ├── Modal.tsx + Modal.css
│   │   ├── Badge.tsx + Badge.css
│   │   ├── Avatar.tsx + Avatar.css
│   │   ├── NewsCard.tsx + NewsCard.css
│   │   ├── NewsCarousel.tsx + NewsCarousel.css
│   │   ├── CommentItem.tsx + CommentItem.css
│   │   ├── PasswordChecklist.tsx + PasswordChecklist.css
│   │   ├── DevelopedBy.tsx + DevelopedBy.css
│   │   └── __tests__/             # Modal, CommentItem
│   │
│   ├── article/                   # Sub-componentes específicos da página Article
│   │   ├── ArticleShareBar.tsx
│   │   ├── ArticleComments.tsx
│   │   ├── ArticleAdminActions.tsx
│   │   └── __tests__/
│   │
│   └── (feedback/) — NÃO EXISTE   # Mencionado no template mas Toast nunca foi extraído
│
├── services/                      # 1 wrapper axios por domínio backend (REST)
│   ├── api.ts                     # Instância axios + interceptor de refresh JWT + CSRF
│   ├── articleService.ts          # + cache módulo-singleton de categorias
│   ├── authService.ts
│   ├── commentService.ts
│   ├── metricsService.ts
│   ├── moderationService.ts
│   └── newsletterService.ts
│
├── contexts/                      # ÚNICO contexto global do app
│   └── AuthContext.tsx            # AuthProvider + useAuth() — currentUser/isAdmin/isDev/canPublish
│
├── router/                        # 3 arquivos — sem sub-pastas
│   ├── AppRouter.tsx              # Todas as rotas + lazy + Suspense + ErrorBoundary global
│   ├── AdminRoute.tsx             # Gate `canPublish` com guarda de isLoading
│   └── ScrollToHashOrTop.tsx      # Helper de scroll restoration (RR7 não faz auto)
│
├── styles/                        # CSS GLOBAL (não pareado com componente)
│   ├── global.css                 # Reset + tokens + helpers (.container, .btn, .container-sm)
│   └── article-body.css           # Estilos do markdown renderizado em Article + CreatePost preview
│
├── utils/                         # Helpers puros (zero hooks, zero side-effect de React)
│   ├── categoryVariant.ts
│   ├── extractApiError.ts
│   ├── formatDate.ts              # formatDateLong, formatDateShort
│   ├── passwordRules.ts           # Regras + validate (compartilhado com PasswordChecklist)
│   ├── renderArticleBody.tsx      # Parser markdown leve → ReactNode[] (compartilhado Article + CreatePost)
│   └── __tests__/
│
├── mocks/                         # MSW DEV-only (✱ recém-criada — fix BLOQUEIO-1)
│   ├── browser.ts                 # setupWorker — carregado SÓ em import.meta.env.DEV
│   └── handlers/
│       ├── index.ts               # Re-export central
│       └── search.ts              # Handlers de /api/v1/search/articles/
│
├── test/                          # Setup do Vitest
│   └── setup.ts                   # jest-dom matchers + cleanup() em afterEach
│
└── assets/                        # Assets importáveis pelo bundler (não públicos)
    ├── interpop-logo.svg
    └── seek-white.svg

public/                            # Servido em /
├── interpop-icon.svg              # favicon SVG (fonte de todos os PNG/ICO abaixo)
├── favicon.ico                    # 16/32/48 px, para /favicon.ico e browsers antigos
├── favicon-96x96.png              # favicon PNG
├── apple-touch-icon.png           # 180 px, sem transparência (iOS)
├── web-app-manifest-192x192.png   # ícone PWA, purpose "any"
├── web-app-manifest-512x512.png   # ícone PWA, purpose "any"
├── web-app-manifest-maskable-512x512.png  # ícone PWA full-bleed, purpose "maskable"
├── site.webmanifest               # PWA manifest (theme-color #19144c)
└── mockServiceWorker.js           # Gerado via `npx msw init public/` — registrado em DEV
```

---

## Onde vive o quê

| Tipo                               | Localização canônica                                                   | Observação                                                                                                             |
| ---------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Página com rota                    | `src/pages/<Name>/index.tsx` (pasta) OU `src/pages/<Name>.tsx` (flat)  | Pasta quando há sub-componentes/hooks; flat quando é monolítica.                                                       |
| Sub-componente exclusivo de página | `src/pages/<Page>/components/`                                         | **Apenas `Buscar/` segue isso hoje**. Resto inlinou ou usou `src/components/article/`.                                 |
| Hook local de página               | `src/pages/<Page>/hooks/`                                              | **Apenas `Buscar/` hoje**. Padrão a replicar em features novas.                                                        |
| Hook compartilhado entre páginas   | `src/hooks/` (**A CRIAR**) — não existe ainda                          | `useAuth` vive em `src/contexts/AuthContext.tsx` (consumer do Context). Outros hooks compartilhados ainda não existem. |
| Service axios                      | `src/services/<dominio>Service.ts`                                     | 1 arquivo por domínio backend. Exceção: `Buscar/` mantém service LOCAL (`services/searchService.ts`).                  |
| Tipos compartilhados               | Inline em `src/services/<dominio>Service.ts` (`export interface Api*`) | NÃO há `src/types/` global. Tipos vivem com o service que os consome.                                                  |
| Tipos da rede (busca)              | `src/pages/Buscar/types.ts`                                            | Espelha DRF serializer; quando `openapi-typescript` (TX-07) entrar, este vira GERADO.                                  |
| Componente compartilhado           | `src/components/<categoria>/`                                          | Categorias semânticas: `layout/`, `ui/`, `article/`. NUNCA por tipo (`atoms/molecules/`).                              |
| Componente fallback global         | `src/components/ErrorFallback.tsx`                                     | Único componente sem categoria — fica solto em `components/`.                                                          |
| Contexto global                    | `src/contexts/`                                                        | Só `AuthContext.tsx` hoje.                                                                                             |
| Estilo global / tokens             | `src/styles/global.css`                                                | Único arquivo de tokens. `article-body.css` é estilo do markdown.                                                      |
| Estilo por componente              | Pareado: `Component.tsx` + `Component.css` (mesma pasta)               | Import explícito `import './Component.css'`. Sem CSS Modules, sem Tailwind.                                            |
| Estilo por página                  | `src/pages/<Page>/<Page>.css` ou `src/pages/<Page>.css`                | Mesmo arquivo para todas as telas de Auth (`Auth/Auth.css`).                                                           |
| Tests unit/integration             | `__tests__/` ao lado do código testado                                 | NÃO há `tests/` global. Naming: `Component.test.tsx`, `helper.test.ts`.                                                |
| Tests a11y                         | `src/pages/<Page>/__tests__/a11y.test.tsx`                             | Único exemplo: `Buscar/__tests__/a11y.test.tsx`. Padrão `vitest-axe` a replicar (ADR-045).                             |
| Tests E2E (futuro)                 | `e2e/` na raiz do repo (não criado)                                    | Playwright em Sprint 5+ (TX-20 / ADR-042).                                                                             |
| Mocks HTTP                         | `src/mocks/handlers/<dominio>.ts`                                      | Apenas `search.ts` hoje. Carregado SÓ em DEV (`?msw=off` desliga).                                                     |
| Asset estático importado           | `src/assets/`                                                          | Importável (`import logo from '@/assets/...'`) — vai pelo bundler com fingerprint.                                     |
| Asset estático servido direto      | `public/`                                                              | Servido em `/`. Para favicon, manifest, robots, MSW worker, OG images grandes.                                         |
| Setup de testes                    | `src/test/setup.ts`                                                    | Carregado por `vitest.config.ts:24 setupFiles: ['./src/test/setup.ts']`.                                               |

---

## Convenções NÃO óbvias descobertas (10 padrões)

1. **`src/pages/Buscar/` é o ÚNICO módulo "feature completo"** com sub-pastas internas (`components/`, `hooks/`, `services/`, `types.ts`, `__tests__/`, `README.md`). Padrão estabelecido pela US30.1 e a replicar em features novas não-triviais. `Admin/` tem pasta mas inlinou tudo num `index.tsx` de **1218 LOC** + `Admin.css` de **1801 LOC** — refactor em backlog (Sprint 4+).

2. **Convenção `_prefix` para módulos internos não-componentes-de-rota**: `src/pages/Admin/_metrics/` contém `HeroKpi`, `SmallStat`, `ArticleRanking` — sub-componentes que só Admin consome. O underscore sinaliza "interno, não-rota" e distingue de uma sub-feature como `Buscar/`.

3. **`src/hooks/` global NÃO existe**. Hooks compartilhados entre páginas ficam em pasta TBD; `useAuth` é o único hook global e vive em `src/contexts/AuthContext.tsx:110` (junto do Provider — viola `react-refresh/only-export-components`, rebaixado para `warn` no `eslint.config.js:29-34`). Hooks locais de feature vivem em `src/pages/<Page>/hooks/`.

4. **`src/utils/` é estritamente helpers puros** — zero hooks React, zero state. `formatDate.ts`, `passwordRules.ts`, `extractApiError.ts`, `categoryVariant.ts` são pure functions; `renderArticleBody.tsx` devolve `ReactNode[]` mas é função pura (não-hook). Hooks que parecem helpers devem ir para `src/hooks/` quando essa pasta for criada.

5. **MSW worker registrado em `main.tsx` antes do React montar** (`main.tsx:33-42`): chamada async aguardada antes de `createRoot().render()`. Em PROD não importa (tree-shake). `?msw=off` na URL desliga manualmente (útil pra apontar dev front pro Django local sem precisar editar código). Pré-requisito: rodar `npx msw init public/ --save` uma vez para gerar `public/mockServiceWorker.js`.

6. **Páginas legacy ainda usam `useState + useEffect + service.then`** (Home, Article, News, Admin, ArticleComments) — só `Buscar/` usa TanStack Query. Quando refatorar legacy para TanStack, criar pasta `<Page>/hooks/` e service local quando fizer sentido. **Em features NOVAS, sempre TanStack Query**.

7. **SSOT triplo do alias `@/`**: `tsconfig.app.json:27`, `vite.config.ts:13-15`, `vitest.config.ts:17-19`. Qualquer alias novo precisa ser adicionado nos TRÊS. Ainda há código importando via path relativo (`../../components/...`) — coexistência intencional durante migração.

8. **CSS global `src/styles/global.css` é a única fonte de tokens**. Tokens da busca (`--clr-highlight-bg`, `--clr-chip-*`, `--clr-skeleton`) foram **adicionados** lá (não em `Buscar.css`) — ADR-029 proíbe redefinir `--clr-primary`/`--font-serif`/`--clr-accent` em página específica. Dark mode no `html.dark` no mesmo arquivo (`global.css:154-169`).

9. **`Auth/` é o único caso de CSS compartilhado por múltiplas páginas-irmãs**: `Auth/Auth.css` serve Login, Register, ForgotPassword, ResetPassword. Quebra a convenção "1 CSS por página" — justificado pela paridade visual obrigatória entre as 4 telas. Não replicar sem necessidade clara.

10. **`CreatePost/index.tsx` exporta DOIS componentes named** (`CreatePost` e `EditPost`) compartilhando lógica de form. `AppRouter.tsx:28-33` faz lazy import do mesmo módulo duas vezes com `.then(m => ({ default: m.X }))`. Vite/Rollup deduplica em build. Não copy-paste o arquivo nem o split.

---

## Pontos de melhoria estrutural conhecidos (backlog)

- **`Admin/` refactor** — quebrar `index.tsx` (1218 LOC) em sub-componentes em `Admin/components/` e extrair fetchers para `Admin/hooks/useAdminUsers.ts`, `useAdminBans.ts`, `useAdminMetrics.ts` (migrando para TanStack Query no caminho).
- **`src/hooks/` global** — criar quando o primeiro hook precisar ser compartilhado entre duas páginas.
- **`src/components/feedback/`** — extrair Toast/Snackbar quando aparecer (já mencionado em template; ainda não existe).
- **`openapi-typescript` em CI** — `src/pages/Buscar/types.ts` (e outros tipos `Api*` em `services/`) passam a ser gerados a partir do OpenAPI do DRF (TX-07).
- **E2E `e2e/`** — Playwright + visual regression de 5 estados × light/dark × mobile (ADR-042).
- **Promover `src/components/ui/` a design system** com Storybook ou similar (mencionado nos roadmaps, sem data).

---

## Diretórios fora de backend/ e src/

```
docs/                    ver docs/specs/README.md
scripts/                 utilidades (md-to-pdf.sh funcional; outros stubs)
public/                  assets servidos pelo nginx (icons, manifests, mockServiceWorker.js)
.github/                 workflows CI + dependabot config
.husky/                  pre-commit hooks
skills/                  (vazio no projeto — skills são globais em ~/.claude/skills/)
```

## Cross-references

- [STACK.md](STACK.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [CONVENTIONS.md](CONVENTIONS.md)
