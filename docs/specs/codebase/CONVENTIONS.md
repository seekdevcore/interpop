# CONVENTIONS — Interpop

> Convenções de código que regem todo trabalho no codebase. Backend Python + Django + DRF; Frontend React 19 + TS + Vite. Citações são reais.

---

## Backend — Python + Django + DRF

> Stack: Python 3.12 + Django 5.1.4 + DRF 3.17 + Postgres (prod) / SQLite (dev) + Celery 5.6 + Redis (prod) + JWT em cookie httpOnly. Gerenciamento: `uv` (NUNCA `pip`/`venv` — ver `backend/pyproject.toml`).

---

### Settings + env

- **Split em 3 arquivos** sob [`backend/config/settings/`](../../../backend/config/settings/):
  - [`base.py`](../../../backend/config/settings/base.py) — settings compartilhadas. `DEBUG = False` por default ([base.py:13](../../../backend/config/settings/base.py)). `SECRET_KEY` lida via `config('SECRET_KEY')` sem default — falha hard se ausente ([base.py:12](../../../backend/config/settings/base.py)).
  - [`development.py`](../../../backend/config/settings/development.py) — SQLite, `DEBUG=True`, cookies inseguros, throttles relaxados (`10000/hour`), `CELERY_TASK_ALWAYS_EAGER=True` ([development.py:54](../../../backend/config/settings/development.py)) — sem Redis necessário.
  - [`production.py`](../../../backend/config/settings/production.py) — Postgres, HSTS 1 ano, SSL redirect, `init_sentry()` no boot.
- **Env reader**: `decouple.config()` em todo lugar — nunca `os.environ.get()` direto em settings. `Csv()` cast para listas (ex.: `ALLOWED_HOSTS`).
- **Hard-fails em production.py** (config inválida → `raise ImproperlyConfigured` no boot, prefere quebrar deploy a rodar inseguro):
  1. `SEARCH_CURSOR_HMAC_SECRET` vazio OU igual a `SECRET_KEY` ([production.py:18-23](../../../backend/config/settings/production.py)) — fix F2-B-03/REVIEW-PHASE-2.
  2. `ALLOWED_HOSTS` sem default ([production.py:29](../../../backend/config/settings/production.py)) — `config('ALLOWED_HOSTS', cast=Csv())` estoura se vazio.
  3. `DB_NAME` / `DB_USER` / `DB_PASSWORD` sem default ([production.py:37-39](../../../backend/config/settings/production.py)).
- **JWT_SIGNING_KEY** distinta de `SECRET_KEY` por padrão (defesa em profundidade — S4 §11.6); fallback aceitável só em dev ([base.py:150](../../../backend/config/settings/base.py)).
- **DEFAULT_AUTO_FIELD = `BigAutoField`** ([base.py:267](../../../backend/config/settings/base.py)) — vale para qualquer model novo cujo PK não seja UUID explícito.

---

### Apps layout

Estrutura padrão por app em [`backend/apps/<app>/`](../../../backend/apps/) (7 apps registrados em [`base.py:41-49`](../../../backend/config/settings/base.py)):

```
apps/<app>/
├── __init__.py
├── apps.py             # AppConfig + ready() para wire signals + converters
├── models.py           # ORM models do domínio
├── serializers.py      # DRF serializers (validation + read/write split)
├── views.py            # Generics/APIView — finas, delegam pra services
├── urls.py             # path() entries; prefixo /api/v1/ injetado em config/urls.py
├── admin.py            # Django admin registration (opcional)
├── permissions.py      # Permission classes específicas (raro — usar apps.users.permissions canônico)
├── services.py         # Business logic transacional (admin pode chamar via shell)
├── signals.py          # post_save / pre_save handlers — só wiring, lógica em tasks/services
├── tasks.py            # @shared_task Celery — fire-and-forget, retry policy
├── managers.py         # Custom Managers (ex.: UserManager)
├── validators.py       # Validators reutilizáveis (ex.: PasswordComplexityValidator)
├── authentication.py   # Auth backends DRF (ex.: JWTCookieAuthentication)
├── throttles.py        # Custom throttle classes (ex.: SearchGlobalThrottle)
├── middleware.py       # Middleware classes (audit/)
├── migrations/
│   └── NNNN_*.py
├── tests/
│   ├── __init__.py
│   ├── conftest.py     # Fixtures locais ao app (opcional — globais ficam em backend/conftest.py)
│   └── test_*.py
└── management/commands/<cmd>.py   # CLI ops (opcional — só users e search hoje)
```

**Convenções de naming dos arquivos**:

- `models.py` é o canônico; arquivos como [`apps/users/managers.py`](../../../backend/apps/users/managers.py), [`apps/users/authentication.py`](../../../backend/apps/users/authentication.py), [`apps/search/throttles.py`](../../../backend/apps/search/throttles.py) ficam fora de `models.py` quando o conteúdo é estrutural (não modelo de dados).
- Arquivos especiais convivem soltos quando temáticos: [`apps/articles/og_middleware.py`](../../../backend/apps/articles/og_middleware.py), [`apps/articles/sitemaps.py`](../../../backend/apps/articles/sitemaps.py), [`apps/articles/robots_view.py`](../../../backend/apps/articles/robots_view.py), [`apps/articles/converters.py`](../../../backend/apps/articles/converters.py), [`apps/audit/health_view.py`](../../../backend/apps/audit/health_view.py), [`apps/audit/security_headers_middleware.py`](../../../backend/apps/audit/security_headers_middleware.py), [`apps/audit/sentry.py`](../../../backend/apps/audit/sentry.py), [`apps/audit/logging.py`](../../../backend/apps/audit/logging.py).
- App **search** é o único com 5 arquivos específicos (`cursors.py`, `cache.py`, `dto.py`, `utils.py`, `throttles.py`) — reflete maturidade do specialist algorithms (ADR-023 e seguintes).

**Apps sem `services.py`/`tasks.py`**: `articles`, `comments`, `audit` — lógica vive em views (`AdminMetricsView` é a maior). `users`, `moderation`, `newsletter`, `search` têm services dedicados.

**Wiring de signals**: feito em `apps.py:ready()`. Exemplos: [`articles/apps.py:9-17`](../../../backend/apps/articles/apps.py) (registra signals + converter `uslug`), [`moderation/apps.py:9-11`](../../../backend/apps/moderation/apps.py), [`search/apps.py:17-21`](../../../backend/apps/search/apps.py). Convenção: `from . import signals  # noqa: F401`.

---

### Models

- **`AbstractBaseUser` + `PermissionsMixin`, NÃO `AbstractUser`** — [`apps/users/models.py:12`](../../../backend/apps/users/models.py). Razão: `USERNAME_FIELD = 'email'` ([users/models.py:35](../../../backend/apps/users/models.py)), `username` ainda existe mas como handle público (case-preserved, unicidade `iexact` — ver [serializers.py:23](../../../backend/apps/users/serializers.py)).
- **PKs — UUID nos domínios de negócio, BIGINT nos auxiliares**:
  - **UUIDField**: `User`, `PasswordResetToken`, `Article`, `Comment`, `CommentLike`, `Ban`, `BanRequest`, `SearchIndex.article_id` — sempre `default=uuid.uuid4, editable=False`.
  - **BIGINT (`BigAutoField` implícito)**: `Category` ([articles/models.py:7](../../../backend/apps/articles/models.py)), `NewsletterSubscriber` ([newsletter/models.py:5](../../../backend/apps/newsletter/models.py)), `AuditLog` ([audit/models.py:5](../../../backend/apps/audit/models.py)), `SearchLog` ([search/models.py:71](../../../backend/apps/search/models.py)). Critério: PK auxiliar/leve não exposta em URL pública → BIGINT; PK que aparece em URL ou que precisa ser não-enumerável → UUID.
- **Sem BaseModel comum**. Cada model declara `created_at = auto_now_add=True`, `updated_at = auto_now=True` quando precisa. Padrão repetido, mas não promovido a mixin (decisão pragmática — sobreposição rara).
- **Soft-delete**: convenção `is_deleted = BooleanField(default=False, db_index=True)` + `deleted_at = DateTimeField(null=True)` + `deleted_by = ForeignKey(SET_NULL)`. Aplicado SÓ em `Comment` ([comments/models.py:29-37](../../../backend/apps/comments/models.py)). Implementado em [`CommentDestroyView.perform_destroy`](../../../backend/apps/comments/views.py) flipando os 3 campos com `update_fields=`. **Nenhum manager `objects_with_deleted` existe**; todo queryset que lê precisa filtrar explicitamente `is_deleted=False` (gotcha — bug histórico em `CommentDestroyView.queryset` faltando esse filtro).
- **Custom Manager**: só [`UserManager(BaseUserManager)`](../../../backend/apps/users/managers.py) — implementa `create_user` / `create_superuser` honrando email-as-username.
- **`db_table` explícita em TODO model** — sempre snake*case plural (`users`, `articles`, `comments`, `comment_likes`, `bans`, `ban_requests`, `audit_logs`, `newsletter_subscribers`, `password_reset_tokens`, `search_index`, `search_log`). Não confiar no nome auto-gerado (`<app>*<model>`).
- **`Meta.indexes` declara índices compostos no model** — [users/models.py:43-45](../../../backend/apps/users/models.py), [articles/models.py:66-69](../../../backend/apps/articles/models.py), [audit/models.py:27-31](../../../backend/apps/audit/models.py). Índices simples ficam inline via `db_index=True`. **Não há** índice partial Postgres no `Meta` — esses (`WHERE category_id IS NOT NULL`, GIN tsvector) vivem em `RunSQL` (ver §Migrations).
- **`Meta.managed = False`** apenas em `SearchIndex` e `SearchLog` ([search/models.py:62, 102](../../../backend/apps/search/models.py)) — schema controlado por migration SQL pura (extensions, trigger PL/pgSQL, GIN, configuration `pt_unaccent`). **ORM Django nunca escreve aqui**; trigger Postgres é a fonte de verdade (ADR-018).
- **TextChoices nos enums de role/status**: `User.Role` ([users/models.py:13-17](../../../backend/apps/users/models.py)), `Article.Status` ([articles/models.py:26-28](../../../backend/apps/articles/models.py)), `BanRequest.Status` ([moderation/models.py:17-20](../../../backend/apps/moderation/models.py)). Sempre com label legível pt-BR.
- **Properties de domínio no model** quando puramente derivadas: `User.is_admin`, `User.can_publish`, `User.is_immune_to_ban`, `User.can_be_banned_by(actor)` ([users/models.py:58-107](../../../backend/apps/users/models.py)). Mantém a hierarquia editorial concentrada — view/serializer só consultam.
- **Override de `save()`** quando há lógica adicional: `Article.save()` aplica slug único + featured-único transacional ([articles/models.py:78-92](../../../backend/apps/articles/models.py)); `Category.save()` faz `slugify(allow_unicode=True)`.

---

### Serializers DRF

- **Padrão de naming — `<Recurso><Papel>Serializer`**:
  - `UserPublicSerializer` (read genérico) vs `UserAdminSerializer` (estende com email + stats) — [users/serializers.py:33, 47](../../../backend/apps/users/serializers.py).
  - `ArticleListSerializer` (sem `body`) vs `ArticleDetailSerializer` (estende com `body, cover_caption, updated_at`) vs `ArticleWriteSerializer` (campos de input + `category_id`) — [articles/serializers.py:12, 27, 33](../../../backend/apps/articles/serializers.py).
  - Auth-flow: `LoginSerializer`, `RegisterSerializer`, `ChangePasswordSerializer`, `UpdateProfileSerializer`, `PasswordResetRequestSerializer`, `PasswordResetConfirmSerializer` — todos em [users/serializers.py](../../../backend/apps/users/serializers.py).
- **Read/Write split**: view decide com `get_serializer_class()` baseado em `self.request.method`. Ex.: [`ArticleListView.get_serializer_class`](../../../backend/apps/articles/views.py) devolve `ArticleWriteSerializer` em POST, `ArticleListSerializer` em GET.
- **Validation customizada** vive no próprio serializer:
  - `validate_<campo>(self, value)` para campo único — ex.: `validate_email` lowercase + uniqueness ([users/serializers.py:85-88](../../../backend/apps/users/serializers.py)).
  - `validate(self, attrs)` para cross-field — ex.: `password != password2` ([users/serializers.py:93-100](../../../backend/apps/users/serializers.py)), `cover_image obrigatória na criação` ([articles/serializers.py:55-64](../../../backend/apps/articles/serializers.py)).
  - Helper module-level reusável quando o mesmo regex/regra aparece em múltiplos serializers — ex.: `_validate_username` em [users/serializers.py:15-28](../../../backend/apps/users/serializers.py) (compartilhado entre Register e UpdateProfile).
- **Nested writes — evitar**. Padrão: ID-only via `PrimaryKeyRelatedField(source=...)`. Ex.: `category_id` em [`ArticleWriteSerializer`](../../../backend/apps/articles/serializers.py:34-36). O write NÃO cria a entidade relacionada — POST de Article com Category inline NÃO é suportado; o frontend cria Category separadamente (ou a categoria já existe via seed).
- **Author/owner em create**: serializer puxa do `context['request'].user` em `create()` ([articles/serializers.py:66-68](../../../backend/apps/articles/serializers.py), [comments/serializers.py:52-58](../../../backend/apps/comments/serializers.py)). Nunca aceitar `author_id` no payload.
- **`read_only_fields`** lista explícita em campos derivados — ex.: `ReplySerializer.Meta.read_only_fields = fields` ([comments/serializers.py:14](../../../backend/apps/comments/serializers.py)) faz o reply ser puramente read.
- **Campos derivados do queryset annotate** declarados como `IntegerField(read_only=True, default=0)` — ex.: `comment_count`, `likes_count`, `is_liked` ([comments/serializers.py:19-20](../../../backend/apps/comments/serializers.py), [articles/serializers.py:16](../../../backend/apps/articles/serializers.py)). Sem isso o serializer rejeita o atributo annotated.
- **`save()` com `update_fields=`** sempre que possível em serializers que escrevem direto: [`UpdateProfileSerializer.update`](../../../backend/apps/users/serializers.py:142-146), [`ChangePasswordSerializer.save`](../../../backend/apps/users/serializers.py:123-127). Evita writes desnecessárias e reduz superficie de race-condition.

---

### Views DRF

- **Padrão dominante: `generics.<Mixin>APIView`** + `APIView` para casos custom.
  - `ListCreateAPIView`: [`ArticleListView`](../../../backend/apps/articles/views.py:30), [`BanListCreateView`](../../../backend/apps/moderation/views.py:18), [`BanRequestListCreateView`](../../../backend/apps/moderation/views.py:55), [`CommentListCreateView`](../../../backend/apps/comments/views.py:25).
  - `RetrieveUpdateDestroyAPIView`: [`ArticleDetailView`](../../../backend/apps/articles/views.py:68).
  - `RetrieveDestroyAPIView`: [`BanDestroyView`](../../../backend/apps/moderation/views.py:39).
  - `ListAPIView`: [`UserListView`](../../../backend/apps/users/views.py:168), [`CategoryListView`](../../../backend/apps/articles/views.py:24).
  - `APIView` puro: endpoints com lógica não-CRUD ou body custom — [`LoginView`](../../../backend/apps/users/views.py:30), [`ArticleViewCountView`](../../../backend/apps/articles/views.py:91), [`SearchArticlesView`](../../../backend/apps/search/views.py:68), [`AdminMetricsView`](../../../backend/apps/audit/views.py:132), [`BanRequestDecideView`](../../../backend/apps/moderation/views.py:76).
- **ViewSets NÃO são usados** — preferência por explicitness, cada endpoint = 1 classe. Vale a regra mesmo em CRUD repetitivo.
- **Permission classes canônicas** vivem em [`apps/users/permissions.py`](../../../backend/apps/users/permissions.py) (single source of truth — C14 da reorganização):
  - `IsAdminUser` — aceita roles `admin` E `dev` (via `User.is_admin` property — [permissions.py:6](../../../backend/apps/users/permissions.py)).
  - `IsAdminOrReadOnly` — anon lê, admin escreve.
  - `IsPublisherOrReadOnly` — anon lê, `can_publish` (dev/admin/editor) escreve. Usada em artigos.
  - `IsOwnerOrAdmin` — object-level: `obj.author_id == user.pk` OR admin.
  - `IsNotBanned` — bloqueia authenticated banned, deixa anon passar. Aplicada como `DEFAULT_PERMISSION_CLASSES` em [base.py:172](../../../backend/config/settings/base.py) (defesa em profundidade — S8 §11.6).
  - `IsEditorOrAdmin` — auth obrigatória, POST exige `can_publish`. Para BanRequest.
- **Stack de permissões em view** é uma LISTA, AND lógico — ex.: `[IsAdminUser, IsNotBanned]` ([moderation/views.py:19](../../../backend/apps/moderation/views.py)), `[IsPublisherOrReadOnly, IsOwnerOrAdmin]` ([articles/views.py:73](../../../backend/apps/articles/views.py)).
- **`permission_classes` em VIEW sobrescreve TODO o DEFAULT** (gotcha DRF) — quando você quer manter o `IsNotBanned` do default, precisa repetí-lo na lista da view. Quase todas as views protegidas o fazem.
- **`get_permissions()` quando depende de método** — [`CommentListCreateView.get_permissions`](../../../backend/apps/comments/views.py:28-31): GET é `[AllowAny()]`, POST é `[IsAuthenticated(), IsNotBanned()]`.
- **Throttle por endpoint sensível** via `ScopedRateThrottle` + `throttle_scope`:
  - Login/Register/PasswordReset: `throttle_scope = 'auth'` (10/min) — [users/views.py:33, 59, 125](../../../backend/apps/users/views.py).
  - Search: throttle classes custom (`SearchAnonThrottle`, `SearchUserThrottle`, `SearchGlobalThrottle` — 3 camadas, ADR-036) — [search/throttles.py](../../../backend/apps/search/throttles.py), [search/views.py:77-81](../../../backend/apps/search/views.py).
- **`select_related` / `prefetch_related` SEMPRE em list views** — N+1 é alvo de regressão. Padrão `select_related('author', 'category')` em Article, `prefetch_related(Prefetch('replies', queryset=_reply_qs(user)))` em Comment ([comments/views.py:36-46](../../../backend/apps/comments/views.py)).
- **Annotate com `filter=Q(...)` + `distinct=True`** quando há JOIN cartesiano (comments × likes) — ex.: [audit/views.py:152-166](../../../backend/apps/audit/views.py) (per_article com `like_count` filtrado por `comments__is_deleted=False`).
- **`order_by()` explícito após `.annotate(Count(...))`** — DRF paginator estoura `UnorderedObjectListWarning` quando GROUP BY entra ([articles/views.py:42-46](../../../backend/apps/articles/views.py) — comentário documenta).

---

### URLs

- **Versionamento `/api/v1/`** desde dia 1 (ADR-010) — registrado em [`config/urls.py:32-41`](../../../backend/config/urls.py). Nunca criar `/api/v2/` antes de deprecar `/api/v1/` com `Sunset` header + 90 dias de aviso.
- **Inclusão per-app** com `include('apps.<app>.urls')`. Prefixos:
  - `/api/v1/auth/` → users (apenas este tem prefixo no `include()`)
  - `/api/v1/` → articles, comments, moderation, newsletter, audit
  - `/api/v1/search/` → search (com `app_name = 'search'` em [search/urls.py:16](../../../backend/apps/search/urls.py))
- **Endpoints fora de `/api/v1/`** (sem versioning porque são integrações externas):
  - `/sitemap.xml`, `/robots.txt` — SEO crawlers.
  - `/healthz/` + alias `/healthz` sem trailing slash — monitor externo (UptimeRobot) e nginx upstream check.
  - `/django-admin/` — admin (não `/admin` para não conflitar com SPA).
- **`name=` SEMPRE** em todo `path()` — convenção: `<recurso>-<acao>` ou `<recurso>-<verbo-curto>`. Exemplos: `auth-login`, `article-list`, `article-detail`, `comment-delete`, `ban-request-decide`, `admin-metrics`, `healthz`, `sitemap-xml`. Permite `reverse('article-detail', kwargs={...})` cross-app.
- **`app_name` em urls.py per-app NÃO é a regra** — só `search` usa (`app_name = 'search'` → `reverse('search:articles')`). Demais apps deixam global. Decisão pragmática — ambivalência aceita.
- **Converters custom**: `<uslug:slug>` (slug unicode com acentos/cedilha) registrado UMA vez em [`apps/articles/converters.py:31`](../../../backend/apps/articles/converters.py) e importado via [`articles/apps.py:17`](../../../backend/apps/articles/apps.py). Antes era registrado em `articles/urls.py` + `comments/urls.py` → `RemovedInDjango60Warning`. Lição: converters são GLOBAIS, registro em `apps.py:ready()`.
- **Trailing slash obrigatório** em todos os endpoints (Django default `APPEND_SLASH=True`). Healthz tem alias sem slash por convenção de monitor.

---

### Migrations

- **Numeração: `NNNN_descricao_snake.py`** — 4 dígitos zero-padded, descrição curta. Exemplos: `0003_seed_pop_culture_categories.py`, `0004_user_role_editor_label.py`, `0002_search_indexes.py`, `0003_search_triggers.py`, `0005_trigger_enable_always.py`. Geradas por `uv run python manage.py makemigrations` ou escritas à mão para data migrations.
- **`atomic = False` é caso real e DOCUMENTADO** — não use por reflexo, só quando o DDL Postgres exige:
  - [`search/migrations/0002_search_indexes.py:99`](../../../backend/apps/search/migrations/0002_search_indexes.py) — `atomic = False` porque `CREATE INDEX CONCURRENTLY` é REJEITADO dentro de transação pelo Postgres. Comentário de cabeçalho explica + alerta para resume manual em falha parcial (ADR-030-DB).
  - Mesma regra em `0004_search_vacuum_tuning.py` (provavelmente — segue o padrão).
- **RunSQL com `reverse_sql` honesto** — não usar `migrations.RunSQL.noop` em forward destrutivo. Padrão: 4 statements forward = 4 statements reverse em ordem inversa ([search/migrations/0002:64-69](../../../backend/apps/search/migrations/0002_search_indexes.py)). Quando o reverse é genuinamente complexo (DROP de extension afetando outros apps), comentar explicitamente — ex.: [search/migrations/0001:88](../../../backend/apps/search/migrations/0001_initial.py) preserva a extension `unaccent` no rollback porque outros apps podem depender.
- **RunPython com `forward` + `backward` simétricos** — padrão em data migrations: [articles/migrations/0003:69-74](../../../backend/apps/articles/migrations/0003_seed_pop_culture_categories.py) (`_sync(additions, removals)` aplicado em ambas direções com listas trocadas). Idempotente via `get_or_create`.
- **Migration SQL pura para schemas com extension/trigger/configuration** — quando ORM Django não consegue expressar (DDL Postgres específico): `Meta.managed = False` no model + RunSQL no migration. Caso vivo: `search_index` ([search/migrations/0001](../../../backend/apps/search/migrations/0001_initial.py) cria extension `unaccent` + função `immutable_unaccent` + configuration `pt_unaccent` + função `articles_search_config`; [search/migrations/0003](../../../backend/apps/search/migrations/0003_search_triggers.py) cria a trigger PL/pgSQL).
- **Fallback SQLite-dev** em migrations Postgres-only: `if schema_editor.connection.vendor != 'postgresql': return` antes de executar SQL específica ([search/migrations/0002:73-75](../../../backend/apps/search/migrations/0002_search_indexes.py)). SearchService bifurca com `__icontains` no Python (ADR-020) — dev não precisa de Postgres real.

---

### Logging

- **Structured JSON em prod, verbose em dev** ([base.py:307-343](../../../backend/config/settings/base.py)). Formatter `verbose` em dev (`[2026-05-21 00:35] INFO interpop.foo [req=abc user=42]: msg`), `json` em prod (via `pythonjsonlogger.json.JsonFormatter` — uma linha por log, parseável por journald/Loki/Sentry).
- **`request_id` + `user_id` em TODA linha** via [`RequestContextFilter`](../../../backend/apps/audit/logging.py:30) lendo `ContextVar`s populadas por [`RequestIDMiddleware`](../../../backend/apps/audit/middleware.py:24-54). Default `'-'` (não `None` nem `''`) — diferencia "sem contexto" de "valor vazio" em filtros JSON.
- **Logger naming**:
  - Módulos core: `logging.getLogger(__name__)` — vira `apps.users.services`, `apps.moderation.tasks` etc.
  - App search adota namespace explícito `interpop.search.<modulo>` ([search/views.py:43](../../../backend/apps/search/views.py), [search/services.py:54](../../../backend/apps/search/services.py)). Convenção emergente — não retroaplicar em apps antigos.
- **Levels per logger** ([base.py:337-342](../../../backend/config/settings/base.py)):
  - `root`: INFO
  - `django.request`: WARNING (silencia 200 OK ruidoso)
  - `django.security`: INFO (bruteforce, CSRF fail)
  - `interpop.*`: DEBUG em dev / INFO em prod
  - `celery`: INFO
- **`logger.exception(...)` em handlers de erro** — sempre que o except captura para fazer fail-safe (ex.: [moderation/signals.py:33-34](../../../backend/apps/moderation/signals.py), [audit/middleware.py:84-85](../../../backend/apps/audit/middleware.py)). NÃO usar `except: pass` silencioso — bug histórico documentado em [users/services.py:80-82](../../../backend/apps/users/services.py).

---

### Tests (pytest)

- **Marker dominante: `@pytest.mark.django_db`** (transação SAVEPOINT por test, rollback automático — sem flag). `transaction=True` reservado para tests que dependem de comportamento real de commit (raros — usado em tests de signal que precisam ver state DEPOIS do commit).
- **Markers customizados registrados em [`pytest.ini:16-20`](../../../backend/pytest.ini)**: `slow`, `integration`, `unit`, `requires_postgres`. Convenção: `requires_postgres` em qualquer test que dependa de FTS/extensions/GIN — pula em SQLite-dev (ADR-020). `--strict-markers` em [pytest.ini:7](../../../backend/pytest.ini) força registro prévio.
- **Fixtures globais** em [`backend/conftest.py`](../../../backend/conftest.py):
  - `reader_user`, `editor_user`, `admin_user`, `dev_user` — 1 user por role com password fixa `SenhaForte!2026` (passa o `PasswordComplexityValidator`).
  - `api_client` (`APIClient` sem auth) e `authed_client_factory(user)` (force_authenticate).
- **Fixtures locais em `apps/<app>/tests/conftest.py`** quando são de domínio do app — ex.: [`comments/tests/conftest.py`](../../../backend/apps/comments/tests/conftest.py) tem `category`, `make_article`, `article`. **Não promover para global** se acopla outros apps desnecessariamente — princípio documentado no header desse arquivo.
- **Factories factory-boy disponíveis nas deps mas NÃO usadas em produção atual** — pyproject.toml inclui `factory-boy>=3.3.3`, mas tests usam factories inline em fixture (`make_article` factory closure) ou `User.objects.create_user(...)` direto. **Não há `factories.py` em nenhum app** — convenção aberta; quando o setup ficar repetitivo demais, criar `apps/<app>/tests/factories.py`.
- **Tests por arquivo, agrupados por aspecto** — `test_views.py`, `test_services.py`, `test_models.py`, `test_permissions.py`, `test_ban_hierarchy.py`, `test_serializers.py`, `test_tasks.py`. Padrão `test_<aspecto>.py`, nunca `test_<nome_da_classe>.py`.
- **Função `def test_<comportamento_em_inglês_humano>(fixtures...)`** — não classes (raras), não `Test<Nome>` (apesar de `python_classes = Test` em [pytest.ini:4](../../../backend/pytest.ini)). Doc-string explica a regressão coberta.
- **Coverage gate: 40%** ([ci.yml:54](../../../.github/workflows/ci.yml)) — `uv run pytest --cov=apps --cov-report=xml --cov-report=term --cov-fail-under=40`. Política dura: PR não merge se cobertura DESCE (regra de testing-standards.md §6).
- **`--reuse-db`** ([pytest.ini:9](../../../backend/pytest.ini)) — DB recriado só com `--create-db` explícito; suite local em segundos.
- **`override_settings` em test FUNÇÃO, não em fixture compartilhada** — ex.: `@override_settings(SEARCH_FEATURE_ENABLED=True)` em cada test de [search/tests/test_views.py](../../../backend/apps/search/tests/test_views.py). Compartilhar `@override_settings` via autouse-fixture causa flakiness silenciosa.

---

### Naming conventions

- **Python `snake_case`** em variáveis, funções, módulos, fields.
- **`PascalCase`** em classes (models, views, serializers, throttles, permissions).
- **`UPPER_SNAKE_CASE`** em constantes module-level — ex.: `PER_ARTICLE_LIMIT`, `PERIOD_DELTAS`, `_PT_BR_STOPWORDS` ([search/services.py:61](../../../backend/apps/search/services.py)), `BUCKET_TTL` ([articles/views.py:109](../../../backend/apps/articles/views.py)). Constantes private prefixadas com `_`.
- **Migrations: `NNNN_underscore_separated.py`** zero-padded em 4 dígitos.
- **URL names: `<recurso>-<acao>` kebab-case** — `article-list`, `comment-delete`, `ban-request-decide`.
- **Settings keys: `<DOMINIO>_<CHAVE>`** UPPER_SNAKE — `SEARCH_RECENCY_HALF_LIFE_DAYS`, `JWT_SIGNING_KEY`, `AXES_FAILURE_LIMIT`. Domínio sempre como prefixo (search, jwt, axes, celery) para grep limpo.
- **Task IDs de spec (T30.4.X9, F2-B-01, S8, A20, ADR-018) viram comentários** referenciando código que implementa o fix — ex.: [base.py:439-441](../../../backend/config/settings/base.py) cita F2-B-03, [search/services.py:218-235](../../../backend/apps/search/services.py) cita F2-B-01. Convenção: prefixo do work-item (T = task, F = fix REVIEW-PHASE, S = security/Improvement-system, A = adoption, ADR = decision).
- **DB tables: snake_case plural** — `users`, `articles`, `comments`, `ban_requests` etc. Sempre explícita via `Meta.db_table` (nunca confiar no `<app>_<model>` auto).
- **Cookie names: snake_case** — `access_token`, `refresh_token` ([base.py:153-154](../../../backend/config/settings/base.py)).
- **HTTP header customizado: `X-<Coisa>` PascalCase com hyphen** — `X-Request-ID`, `X-Cache`, `X-Robots-Tag`, `X-Forwarded-For` (lido). Vary lista nomes de header em CSV ([search/views.py:65](../../../backend/apps/search/views.py)).

---

### Anti-patterns BANIDOS

1. **`.extra(where=...)`** — SQL string-interpolation explícita. Vetor de SQLi. Comment-lock M-01 do SECURITY-REVIEW está em [search/views.py:17-18](../../../backend/apps/search/views.py) e [search/services.py:30-31](../../../backend/apps/search/services.py). Único uso aceito de SQL bruto é `cursor.execute(sql, params)` com parametrização posicional/nomeada (`%(key)s`).
2. **`RawSQL()`** — mesma razão. Banido.
3. **`raw()` (QuerySet.raw)** — banido em service code; tolerado em migration RunSQL com parametrização. Atualmente: zero uso fora de migrations.
4. **`force_authenticate` em production code** — só vive em [`conftest.py:91`](../../../backend/conftest.py) (fixture de teste). Usar em view = bug.
5. **`@override_settings` em fixture compartilhada** — fonte de flaky tests por ordem de execução. Aplicar por test/função.
6. **`except Exception: pass` silencioso** — bug histórico documentado em [users/services.py:80-82](../../../backend/apps/users/services.py) (rotate_refresh_token mascarava AttributeError em `.user`, sessão expirava em 15min). Substituir por `logger.exception(...)` + retorno explícito. Exceção MUITO controlada: handler de EXPLAIN best-effort em [search/services.py:398](../../../backend/apps/search/services.py) (documenta `# noqa: BLE001`).
7. **Email síncrono em request thread em produção** — ADR-009 hard-gate. Todo email passa por `apps.<app>.tasks` (`@shared_task`) e é enfileirado com `.delay()`. Em dev, `CELERY_TASK_ALWAYS_EAGER=True` roda síncrono — comportamento idêntico ao production worker.
8. **Hardcoded `'http://localhost:5173'` direto em código não-settings** — usar sempre `getattr(settings, 'SITE_URL', 'http://localhost:5173')`. Fallback localhost só para dev sem `.env`. (Bug histórico — observabilidade aponta 6 ocorrências do fallback em [sitemaps.py:22](../../../backend/apps/articles/sitemaps.py), [robots_view.py:9](../../../backend/apps/articles/robots_view.py), [newsletter/services.py:25](../../../backend/apps/newsletter/services.py), [users/tasks.py:41](../../../backend/apps/users/tasks.py), [og_middleware.py:51](../../../backend/apps/articles/og_middleware.py), [moderation/tasks.py:59](../../../backend/apps/moderation/tasks.py) — não retirar fallback, mas hard-fail em produção é caminho via env-required.)
9. **Mexer em `search_index` direto via ORM** — schema é managed=False, trigger Postgres é fonte de verdade (ADR-018). Qualquer write Python na tabela é violação do ADR.
10. **`signals.py` com lógica pesada** — signals só fazem WIRING (enqueue de task). Lógica vive em `tasks.py` ou `services.py`. Razão: signal roda dentro do request thread; bloquear lá derrota o propósito do Celery.

---

### ADRs e referências cruzadas

- **ADR-009** — Celery para email assíncrono ([newsletter/views.py:21](../../../backend/apps/newsletter/views.py), [users/views.py:133-141](../../../backend/apps/users/views.py)).
- **ADR-010** — `/api/v1/` versionado ([config/urls.py:24-31](../../../backend/config/urls.py)).
- **ADR-012** — `@transaction.atomic` em services com ≥2 writes ([moderation/services.py:1-12](../../../backend/apps/moderation/services.py), [users/serializers.py:192-195](../../../backend/apps/users/serializers.py)).
- **ADR-016 / ADR-018 / ADR-019 / ADR-020** — busca editorial: schema/trigger/configuration/SQLite-fallback ([search/models.py](../../../backend/apps/search/models.py), [search/migrations/0001-0005](../../../backend/apps/search/migrations/)).
- **ADR-023 / ADR-024 / ADR-036 / ADR-037** — busca editorial: URL, throttles, throttle global, cache key ([search/views.py](../../../backend/apps/search/views.py), [search/throttles.py](../../../backend/apps/search/throttles.py)).
- **ADR-025** — `total_estimate` via EXPLAIN ROWS + floor ([search/services.py:75-93](../../../backend/apps/search/services.py)).
- **ADR-030-DB** — índices Postgres compostos parciais + covering ([search/migrations/0002](../../../backend/apps/search/migrations/0002_search_indexes.py)).
- **REVIEW-PHASE-2** — fixes F2-B-01 (atomic em `_query_postgres`), F2-B-02 (Cache-Control private para autenticado), F2-B-03 (hard-fail HMAC secret ≠ SECRET_KEY).
- **§11.6 do Improvement-system.md** — S3 (CSP), S4 (JWT_SIGNING_KEY), S7 (blacklist_all_user_tokens em troca/reset de senha), S8 (IsNotBanned no DEFAULT), S9 (Permissions-Policy + COOP).
- **§11.2 do Improvement-system.md** — A20 (Celery+Redis), A27 (logging JSON), A28 (Sentry), A29 (healthz).

---

## Frontend — React + TS + Vite

> **Escopo**: convenções vigentes em `src/`. Stack: **React 19.2** + **TypeScript ~6.0** + **Vite 8** + **React Router 7.15** + **TanStack Query 5.101** + **axios 1.16**. Build tool e dev server unificados (`npm run dev` em :5173). Tudo client-side hoje (CSR puro, ADR-026); SSR/Next.js NÃO está no escopo do MVP.

---

### Stack de testing

| Lib                           | Versão (lockfile) | Uso                                                                        |
| ----------------------------- | ----------------- | -------------------------------------------------------------------------- |
| `vitest`                      | 4.1.7             | runner + assertion                                                         |
| `@vitest/coverage-v8`         | 4.1.7             | coverage v8 provider                                                       |
| `jsdom`                       | 29.1.1            | DOM env                                                                    |
| `@testing-library/react`      | 16.3.2            | render hooks/components                                                    |
| `@testing-library/user-event` | 14.6.1            | simular input do usuário                                                   |
| `@testing-library/jest-dom`   | 6.9.1             | matchers (`toBeInTheDocument`, etc.) carregados em setup                   |
| `vitest-axe`                  | 0.1.0             | `axe()` + `toHaveNoViolations` (a11y E2E em CI — fix BLOQUEIO-2 / ADR-045) |
| `msw`                         | 2.14.6            | mock HTTP via Service Worker (DEV + tests)                                 |

- **Setup file**: `src/test/setup.ts` — carrega `@testing-library/jest-dom/vitest` matchers + `cleanup()` em `afterEach`.
- **Padrão obrigatório**: `describe()` + `it()` (NUNCA `test()` para casos novos; o codebase tem 148 ocorrências de `describe/it` e zero `test(` para suites — o `test:` que aparece em `passwordRules.ts:22` é nome de campo, não Vitest).
- **Imports explícitos** de `vitest`: `import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'` — `globals: false` em `vitest.config.ts:23` força isso (mais legível em CI + evita typings poluídos).
- **Include glob**: `src/**/*.{test,spec}.{ts,tsx}` (`vitest.config.ts:25`).
- **Coverage gate atual**: `lines/functions/branches/statements: 30%` (`vitest.config.ts:31-36`). Exclusos: `main.tsx`, `vite-env.d.ts`, `**/*.css`, `src/test/**`. Subindo 10pp/sprint até 80% (política §6.2 do AGENTS.md).
- **Reporters**: `text`, `html`, `lcov`.
- **`vitest-axe` quirk** (`a11y.test.tsx:27-40`): a versão 0.1.0 NÃO auto-extende `expect` ao importar `extend-expect` (esse arquivo só declara o tipo no namespace `Vi` e Vitest 4 usa o módulo `vitest` direto). Padrão obrigatório:
  ```ts
  import { toHaveNoViolations } from 'vitest-axe/dist/matchers.js';
  declare module 'vitest' {
    interface Assertion<T = any> {
      toHaveNoViolations(): T;
    }
  }
  expect.extend({ toHaveNoViolations });
  ```
- **`@axe-core/react`** (4.11.3) está em `devDependencies` mas **não é importado em runtime** — usar `vitest-axe` para testes; reservar `@axe-core/react` para futuro dev-time overlay (não obrigatório).

---

### TypeScript

- **`strict: true`**: implícito via `tseslint.configs.recommended`. O `tsconfig.app.json` (linhas 1-31) habilita explicitamente:
  - `noUnusedLocals: true`
  - `noUnusedParameters: true`
  - `noFallthroughCasesInSwitch: true`
  - `verbatimModuleSyntax: true` → **obrigatório `import type { ... }`** para imports só-de-tipo (não cumprir quebra o build).
  - `erasableSyntaxOnly: true` → bane `enum`, `namespace`, parameter properties.
  - `moduleResolution: "bundler"` + `allowImportingTsExtensions: true` + `moduleDetection: "force"`.
- **`noImplicitAny` e `noUncheckedIndexedAccess`**: não declarados explicitamente; valem por herança do `strict: true` para o primeiro (✅ ligado) e ficam **desligados** para `noUncheckedIndexedAccess` (não setado). Resultado prático: indexing de array (`arr[0]`) devolve `T`, não `T | undefined`. Cuidado em handlers de paginação.
- **Alias `@/`**: SSOT do mapeamento é o pareamento de TRÊS arquivos — `tsconfig.app.json:27` (`"@/*": ["./src/*"]`), `vite.config.ts:13-15`, `vitest.config.ts:17-19`. Qualquer alias novo precisa ser adicionado nos três.
- **Tipos vs interfaces** (padrão observado em ≥10 arquivos):
  - `interface` para **shapes de objeto** (Props, payloads, entidades API). Ex.: `Button.tsx:7 ButtonProps`, `articleService.ts:9 ApiArticle`.
  - `type` para **uniões / aliases discriminados**. Ex.: `Button.tsx:4 type Variant = 'primary' | 'outline' | 'ghost'`, `Admin/index.tsx:25 type Tab = 'usuarios' | 'publicacoes' | 'banimentos' | 'metricas'`.
  - Entidades vindas do backend recebem prefixo `Api*`: `ApiUser`, `ApiArticle`, `ApiBan`, `ApiCategory`, `ApiComment`, `AdminMetricsResponse`. Convenção rígida — facilita grep "tipo da rede".
- **Como tipos vêm do backend** (DESIGN-v3 §3.1 / `types.ts:1-9`): declarados **manualmente** hoje, espelhando o que cada DRF Serializer emite. Cada mudança no backend serializer exige PR também no arquivo TS. **Geração automática via `openapi-typescript`** (TX-07 do roadmap) está prevista mas NÃO implementada — quando entrar, `src/pages/Buscar/types.ts` passa a ser GERADO. **Zod**: NÃO usado (zero ocorrências em `src/`).

---

### Componentes

- **Padrão funcional puro**: `export function Comp({ a, b }: Props) { ... }`. Confirmado em 100% dos componentes lidos (Home, Article, Buscar, Navbar, Button, Input, ResultCard, SearchInput).
- **Props**: declaradas como `interface XxxProps` no topo do arquivo (Button, Input, NewsCard, Modal, ResultCard, SearchInputProps). Extender props HTML nativas via `extends ButtonHTMLAttributes<HTMLButtonElement>` (Button.tsx:7) ou `extends InputHTMLAttributes<HTMLInputElement>` (Input.tsx:4) — preserva spread de props sem reinventar.
- **Default props**: via **destructuring com default value** no parâmetro. Ex.: `Button.tsx:14-21` (`variant = 'primary', size = 'md', fullWidth = false, className = ''`). NÃO usar `defaultProps` (depreciado no React 19).
- **Children typing**: `ReactNode` para conteúdo opaco (`AdminRoute.tsx:6`); `children: ReactNode` na interface (`Button.tsx:10`).
- **`forwardRef`**: **NÃO USADO** em nenhum componente do projeto (zero ocorrências em `src/`). Quando precisar de ref, passar via prop tipada (`SearchInput.tsx:27 inputRef = useRef<HTMLInputElement>(null)` permanece local). React 19 não exige `forwardRef` para function components (ref já é prop normal a partir de 19).
- **Side effects são responsabilidade do componente que renderiza** — não há HOCs nem container/presenter split.

---

### Hooks

- **Naming**: `use<PascalCase>` rígido (`useAuth`, `useSearch`, `useDebouncedValue`, `useSearchParamsState`).
- **Localidade dual** (convenção descoberta — NÃO óbvia):
  - **Hook local de feature** → vive em `src/pages/<Page>/hooks/`. Único caso atual: `src/pages/Buscar/hooks/{useSearch.ts,useDebouncedValue.ts,useSearchParamsState.ts}`.
  - **Hook compartilhado** → **NÃO há diretório `src/hooks/` global** ainda. Hooks reusáveis estão **inline em `src/contexts/AuthContext.tsx:110 useAuth`** ou nos `src/utils/` (que abriga apenas helpers puros, não hooks).
  - **Convenção**: se um hook serve mais de uma feature, promover para `src/hooks/` (a criar) — NÃO duplicar nem reaproveitar via `src/utils/`.
- **Export de internals para testes**: padrão `_internals` com underscore (`useSearch.ts:116`):
  ```ts
  export const _internals = { getNextPageParam, shouldRetry, canonicalKey };
  ```
  Permite unit tests sem expor API pública. Importar como `import { _internals } from '../useSearch'` (visto em `useSearch.test.tsx:16`).

---

### State management

- **Server state**: **TanStack Query 5.101**. `QueryClient` único é montado em `src/main.tsx:18-27` com defaults globais:
  ```ts
  staleTime: SEARCH_STALE_TIME (60_000ms)   // casa com max-age=60 do backend (ADR-023)
  gcTime: SEARCH_GC_TIME (5 * 60_000ms)     // casa com stale-while-revalidate=300
  refetchOnWindowFocus: false                // busca editorial não é "live"
  retry: 1                                   // hook pode override (useSearch desativa 4xx)
  ```

  - **Constantes de cache vivem em `src/pages/Buscar/services/searchService.ts:31-32` como SSOT** — `main.tsx` importa de lá (fix H-02 do REVIEW-PHASE-3 — anti-drift).
  - `useInfiniteQuery` é o padrão para listas paginadas via cursor (ver `useSearch.ts:80-103`).
- **Server state legacy (pré-TanStack)**: páginas Home, Article, Admin, ArticleComments ainda usam padrão antigo `useState + useEffect + service.then` (ver `Home.tsx:25-49`, `Article.tsx:45-77`). Migração para TanStack Query está em backlog (Sprint 4). **Em features NOVAS, usar TanStack Query**.
- **Client state**:
  - **Auth global** → React Context (`src/contexts/AuthContext.tsx`). Único Context global do app. Tipo: `AuthContextValue` com `currentUser`, `isAdmin`, `isDev`, `canPublish`, `isLoading`, `login`, `logout`, `refreshUser`. Hook consumer: `useAuth()` que lança `throw` se chamado fora do `<AuthProvider>`.
  - **Estado ephemeral de página** → `useState` local. Padrão para tabs, modais, forms (ver `Admin/index.tsx:55-89`, `Navbar.tsx:21 menuOpen`).
  - **Cache de categorias** → módulo singleton dentro de `articleService.ts:58-65` (`_categoriesCache`, `_categoriesPromise`). NÃO migrar isto para TanStack até refactor da camada de service.
- **URL como SSOT** (ADR-027, busca editorial): `useSearchParamsState` (`src/pages/Buscar/hooks/useSearchParamsState.ts`) é a fachada padrão sobre `useSearchParams` de RR7. Convenções obrigatórias:
  - Default `replace: true` ao digitar (não entupir histórico).
  - `opts.push: true` apenas em commit do usuário (Enter, click em "Buscar").
  - Apagar param quando valor vazio (cleaner URLs: `/buscar` em vez de `/buscar?q=`).
  - Estender este pattern para futuros filtros (Sprint 5: popovers de categoria/autor).
- **Form state**: NÃO há React Hook Form, NÃO há TanStack Form. Forms usam `useState` controlado direto (ver `Admin/index.tsx`, `Login.tsx`, `CreatePost`). Validação client é manual (regex em `src/utils/passwordRules.ts`).
- **Persisted state**: zero usos de `localStorage`/`sessionStorage` em `src/`. Auth persiste via **httpOnly JWT cookie** + CSRF via `csrftoken` cookie (ver `api.ts:18-24`). Refresh é silencioso pelo interceptor.
- **NÃO há Redux. NÃO há Zustand. NÃO há Jotai. NÃO há Recoil.** Confirmado por `package.json` (zero deps relacionadas). Não introduzir sem ADR.

---

### Routing

- **React Router 7.15** com `<BrowserRouter>` em `src/router/AppRouter.tsx:57-134`.
- **Estrutura**: todas as rotas vivem em `AppRouter.tsx` (rota declarativa, NÃO data routers). Routes flat, sem layout routes — `<PageLayout>` é importado em cada página manualmente. Não há `useLoaderData`/`useActionData`.
- **Lazy loading obrigatório para chunks pesados**:
  ```ts
  const Admin = lazy(() =>
    import('../pages/Admin').then((m) => ({ default: m.Admin })),
  );
  const CreatePost = lazy(() =>
    import('../pages/CreatePost').then((m) => ({ default: m.CreatePost })),
  );
  const EditPost = lazy(() =>
    import('../pages/CreatePost').then((m) => ({ default: m.EditPost })),
  );
  const Buscar = lazy(() => import('../pages/Buscar'));
  ```
  Page com named export → unwrap via `.then(m => ({ default: m.X }))`. Page com `index.tsx` barrel exportando `default` → import direto (caso Buscar, `index.tsx:5`).
- **Suspense fallback obrigatório** para toda rota lazy: `<RouteLoader />` (componente local em `AppRouter.tsx:40-55`) é o spinner mínimo padrão.
- **`AdminRoute` (`src/router/AdminRoute.tsx`)**: gate por role. Permite passagem se `canPublish === true` (admin OU dev OU editor — ver `AuthContext.tsx:90`). Trata o caso "auth ainda carregando" com guarda explícita (`isLoading` → mostra "Carregando…", não redireciona). Não usar `<Navigate>` direto em route guard sem este guard de loading — quebra reload em `/admin`.
- **Auth gate em página individual**: `/perfil` faz check dentro de `Perfil.tsx` (não usa `AdminRoute`) — qualquer usuário autenticado pode editar próprio perfil.
- **`ScrollToHashOrTop` (`src/router/ScrollToHashOrTop.tsx`)**: helper obrigatório para a app, montado dentro de `<BrowserRouter>`. RR7 NÃO restaura scroll automático. Implementa scroll-to-top em cross-page navigation + scroll-to-hash com re-scroll em checkpoints (rAF, 80ms, 250ms, 600ms) para absorver layout shifts assíncronos. Sempre respeita `prefers-reduced-motion` (WCAG 2.3.3).
- **ErrorBoundary global**: `react-error-boundary` v6.1 envolve toda `<Routes>` (`AppRouter.tsx:65`) com `<ErrorFallback>` (`src/components/ErrorFallback.tsx`). Sub-tree de busca tem `<ErrorBoundary>` interno próprio (`Buscar.tsx:44-57`, ADR-030-FE).
- **404 catch-all** com voz editorial: `<Route path="*" element={<NotFound />} />` (`NotFound.tsx`) — F16. Não usar "Oops" genérico.

---

### Styling

- **Pure CSS por componente — SEM Tailwind, SEM CSS Modules, SEM CSS-in-JS, SEM Sass.** Confirmado: zero deps no `package.json`. **Não introduzir** sem ADR.
- **Convenção de localidade**:
  - **Estilo de página** → `src/pages/<Page>/<Page>.css` (ou `src/pages/<Page>.css` para páginas flat). Sempre `import './Page.css'` no topo do componente.
  - **Estilo de componente** → arquivo irmão: `Button.tsx` + `Button.css`. Import obrigatório.
  - **Estilo global** → `src/styles/global.css` (reset, tokens, helpers como `.container`, `.container-sm`, `.btn`, classes utilitárias) + `src/styles/article-body.css` (estilos do markdown renderizado).
- **Tokens em `:root`** (`src/styles/global.css:17-152`):
  - Brand: `--clr-primary`, `--clr-primary-dark`, `--clr-primary-light`, `--clr-primary-50`, `--clr-primary-100`.
  - Acentos editoriais: `--clr-accent` (#f8b046), `--clr-accent-soft`, `--clr-neutral-2`.
  - **Categorias** (5 fixas — Música, Moda, Cinema, Literatura, Cultura Digital): pares `--clr-cat-<slug>` + `--clr-cat-<slug>-bg`. Todos validados WCAG AA (≥4.5:1 sobre branco). Aplicar via `data-variant="<slug>"` no wrapper do componente (ver `ResultCard.tsx:51`).
  - Tipografia: `--font-sans` (Inter Variable), `--font-display` (Montserrat Variable), `--font-serif` (Newsreader Variable). **Self-host obrigatório** via `@fontsource-variable/*` em vez de Google Fonts CDN (P1/C6 — elimina FOIT/waterfall que mordia 300-600ms de LCP).
  - Escala tipográfica: `--text-xs` a `--text-5xl` (escala 1.125 + escolhidas manualmente).
  - Spacing (8-pt grid): `--sp-1` (0.25rem) a `--sp-20` (5rem).
  - Radius: `--radius-sm/md/lg/xl/full`.
  - Shadows: `--shadow-sm/md/lg`.
  - **Z-index scale** (`global.css:42-53`) — usar tokens (`--z-modal`, `--z-toast`, etc.), nunca números mágicos.
  - **Tokens da busca** (`global.css:139-151`, ADR-029): `--clr-highlight-bg`, `--clr-highlight-on`, `--clr-highlight-ring`, `--clr-chip-bg`, `--clr-skeleton`, etc.
- **Naming CSS**: **BEM modificado** — bloco `.result-card`, elemento `.result-card__title`, modificador `.result-card--featured` ou via `data-variant`. Confirmado em `result-card`, `home-hero`, `home-news`, `navbar`, `search-input`, `buscar-page`. Não há `@apply` ou utilitários gerados.
- **Dark mode** (`global.css:154-169`, ADR-029): toggle via classe `html.dark` no `<html>`. Tokens semânticos sobrescritos (highlight, chip, skeleton). Pendente toggle UI no Navbar (backlog).
- **Reduced motion**: respeitar `(prefers-reduced-motion: reduce)` (já feito em `ScrollToHashOrTop.tsx:38-42`).

---

### Acessibilidade

- **WCAG 2.2 AA é gate de entrega** (§4 do AGENTS.md). Toda mudança visual exige pass em axe + WAVE manual antes de PR.
- **Semantic shell obrigatório**:
  - Formulários de busca: `<form role="search">` + `<input type="search">` (ver `SearchInput.tsx:45-52,77`).
  - Datas legíveis por screen reader: `<time dateTime="ISO-8601">` (ver `Article.tsx:189`, `ResultCard.tsx:99`).
  - Landmarks únicos: 1 `<header>` (Navbar), 1 `<main>` (PageLayout/page wrapper), 1 `<footer>` (Footer). Páginas como Buscar abrem `<main className="container buscar-page">` próprio.
  - `<nav aria-label="...">` para toda nav que não seja a principal.
  - Imagem dentro de `<Link aria-label="...">` deve ter `alt=""` (decorativa) — evita WAVE "Redundant alt" (ver `Navbar.tsx:47`, `ResultCard.tsx:57`).
- **`aria-live` para mudanças assíncronas sem mover foco**: `aria-live="polite"` em headers que atualizam contagem (ver `SearchResults.tsx:100`). `role="status"` para loadings (ver `Home.tsx:122`, `Article.tsx:92`).
- **`role="progressbar"`** para a barra de leitura do artigo, com `aria-valuenow/min/max + aria-label` (`Article.tsx:137-141`).
- **Anti-CLS**: `<img width="X" height="Y">` declarados como atributos HTML (não só CSS) — browser reserva caixa antes do download. Ver `Article.tsx:216-217` (1600×900 hero) e `ResultCard.tsx:60-61` (120×80 thumb).
- **Image priority hints**: `loading="eager" fetchPriority="high"` para LCP candidate (hero), `loading="lazy" decoding="async"` para below-fold (`ResultCard.tsx:58-59`).
- **axe-core gate**: `vitest-axe` em `src/pages/Buscar/__tests__/a11y.test.tsx` cobre 5 estados + componentes-chave + integração da página. **Padrão a replicar em features novas críticas**. NVDA/VoiceOver manual e Playwright visual regression (5 estados × light/dark × mobile) estão no roadmap (TX-20 / ADR-042).
- **Foco visível**: nunca remover `:focus-visible` no CSS. Skip-link para `#main` (PageLayout) — confirmar antes de tocar em PageLayout.css.

---

### Naming conventions

| Tipo                                | Padrão                                                                                        | Exemplo                                                       |
| ----------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Variáveis / funções                 | `camelCase`                                                                                   | `currentUser`, `fetchSearch`, `canonicalKey`                  |
| Componentes React                   | `PascalCase`                                                                                  | `ResultCard`, `SearchInput`, `AdminRoute`                     |
| Tipos / interfaces                  | `PascalCase`                                                                                  | `SearchResultItem`, `ButtonProps`, `ApiUser`                  |
| Prefixo de entidade do backend      | `Api*`                                                                                        | `ApiUser`, `ApiArticle`, `ApiBan`, `ApiComment`               |
| Arquivos `.tsx`/`.ts` de componente | `PascalCase.tsx`                                                                              | `ResultCard.tsx`, `Button.tsx`                                |
| Arquivos `.tsx`/`.ts` de página     | `PascalCase.tsx` flat OU `PascalCase/index.tsx` barrel                                        | `Home.tsx` (flat) · `Buscar/index.tsx` (barrel)               |
| Arquivos de hook                    | `camelCase.ts` com prefixo `use`                                                              | `useSearch.ts`, `useDebouncedValue.ts`                        |
| Arquivos de utilitário              | `camelCase.ts` ou `camelCase.tsx`                                                             | `formatDate.ts`, `renderArticleBody.tsx`                      |
| Arquivos de service                 | `camelCase` terminando em `Service.ts`                                                        | `authService.ts`, `searchService.ts`                          |
| Arquivos CSS                        | **Pareados** com componente: `Component.css` (NÃO `component.css` nem `Component.module.css`) | `Button.css`, `ResultCard.css`, `Buscar.css`                  |
| Diretórios de página com sub-pastas | `PascalCase`                                                                                  | `pages/Buscar/`, `pages/Admin/`, `pages/Auth/`                |
| Diretórios de componente categoria  | `lowercase` (categoria semântica)                                                             | `components/ui/`, `components/layout/`, `components/article/` |
| Constantes módulo-level             | `UPPER_SNAKE_CASE`                                                                            | `SEARCH_STALE_TIME`, `MIN_QUERY_LENGTH`, `DEBOUNCE_MS`        |
| Internals para teste                | `_internals` com underscore                                                                   | `useSearch.ts:116`                                            |
| Subdiretórios de teste              | `__tests__/` ao lado do código                                                                | `src/utils/__tests__/`, `src/pages/Buscar/__tests__/`         |
| Arquivo de teste                    | `Component.test.tsx` ou `name.test.ts`                                                        | `Buscar.test.tsx`, `formatDate.test.ts`                       |

- **Páginas flat vs pasta**: usar **pasta `<Page>/`** quando a página tem sub-componentes, hooks ou services próprios. Usar **arquivo flat `Page.tsx`** quando é monolítica e simples. Hoje só `Buscar/` segue o padrão "feature module"; `Admin/` tem pasta mas é monolítica (1218 LOC TSX + 1801 CSS — refactor em backlog).
- **Padrão de barrel `index.tsx`**: quando a pasta de página existe, criar barrel que re-exporta `default` e named (ver `Buscar/index.tsx:5`). Isso permite `lazy(() => import('./pages/Buscar'))` simples no Router.

---

### Testes vitest

- **Imports explícitos**: `import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'`. `vitest.config.ts:23` força `globals: false`.
- **MSW para mock HTTP**:
  - Service Worker em `src/mocks/browser.ts` (registrado em `main.tsx:33-42` SÓ em DEV — tree-shake em PROD).
  - Handlers em `src/mocks/handlers/<dominio>.ts`, exportados em `src/mocks/handlers/index.ts`.
  - `?msw=off` na URL desliga o worker em DEV (útil pra apontar pro Django local).
  - Em testes, usar `vi.spyOn(searchService, 'fetchSearch')` para mocks unit; MSW é para integração browser.
- **Wrapper pattern obrigatório** (testes que renderizam componentes que consomem hooks):
  ```tsx
  function wrap(node: ReactNode, url = '/buscar') {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return (
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[url]}>{node}</MemoryRouter>
      </QueryClientProvider>
    );
  }
  ```
  Ver `Buscar.test.tsx:19-28`, `a11y.test.tsx:54-63`. **Novo QueryClient por teste** (não compartilhar — caches vazam entre suites). `retry: false` em testes é mandatório (senão suites com 4xx ficam lentas).
- **Hooks**: usar `renderHook` do `@testing-library/react` 16. Wrapper de providers explicitamente como `wrapper` parameter (ver `useSearch.test.tsx:20-31`).
- **`vi.useFakeTimers()`** para testar debounce/setTimeout — ver `useDebouncedValue.test.tsx`.
- **Naming de describes/its**: em **PT-BR**, frases curtas explicando comportamento, com referências a ADRs/Bugs quando aplicável: `describe('A11y axe-core — 5 estados + componentes-chave (ADR-045)', () => { it('EmptyState: zero violações', ...) })`.
- **Coverage exclusões**: `main.tsx`, `vite-env.d.ts`, `**/*.css`, `src/test/**` (ver `vitest.config.ts:37-44`). NÃO excluir mais nada sem ADR.

---

### Anti-patterns BANIDOS no projeto

| Anti-pattern                                                                   | Origem da proibição                                   | Razão                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------ | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dangerouslySetInnerHTML`                                                      | ADR-022 / ADR-038                                     | Já confirmado zero ocorrências em `src/`. Highlight de busca usa `mark.js` que opera em nó de TEXTO (`Range.splitText`), nunca em `innerHTML`. Markdown do artigo usa parser próprio que devolve `ReactNode[]` (`renderArticleBody.tsx`).                   |
| `role="combobox"` em SearchInput                                               | ADR-028 / Bug 5 da busca                              | Combobox APG exige listbox controlado com `aria-activedescendant`. Busca editorial é "input + lista in-page", não overlay com sugestões. Usar `role="search"` no form + `type="search"` no input. Test guard em `Buscar.test.tsx:58-62`.                    |
| Redefinir `--clr-primary`, `--font-serif`, `--clr-accent` em página/componente | ADR-029                                               | Quebra o brand DNA. Páginas como Buscar declaram **NOVOS** tokens semânticos (`--clr-highlight-*`, `--clr-chip-*`, `--clr-skeleton`) que **derivam** dos tokens brand. Override nunca.                                                                      |
| `useDeferredValue` sem `useDebouncedValue` antes                               | Bug 4 do REVIEW-PHASE-3 / `useDebouncedValue.ts:7-15` | `useDeferredValue` adia render, NÃO debounce. Em search-as-you-type, 5 keystrokes em 200ms disparam 5 requests — comem rate limit de 30/min. Pilha obrigatória: `inputQ → useDebouncedValue(250ms) → debouncedQ → useDeferredValue → deferredQ → queryKey`. |
| Hook compartilhado em `src/utils/`                                             | Convenção atual                                       | `src/utils/` é só para helpers puros. Hook compartilhado precisa de `src/hooks/` global (a criar). Hoje só `useAuth` vive em `src/contexts/AuthContext.tsx`.                                                                                                |
| Servir fontes de Google Fonts CDN                                              | P1/C6 / `global.css:1-14`                             | `@import url(fonts.googleapis.com)` bloqueia parse do CSS + waterfall sequencial (~12 requests). Self-host obrigatório via `@fontsource-variable/*` (3 requests paralelos, mesmo origin).                                                                   |
| `enum`, `namespace`, parameter properties                                      | `tsconfig.app.json:21 erasableSyntaxOnly: true`       | Erro de build. Usar `type Foo = 'a' \| 'b'` para enums-like.                                                                                                                                                                                                |
| `import { Foo } from '...'` quando Foo é só tipo                               | `tsconfig.app.json:13 verbatimModuleSyntax: true`     | Erro de build. Sempre `import type { Foo } from '...'`.                                                                                                                                                                                                     |
| Z-index com número mágico (`z-index: 9999`)                                    | `global.css:42-53`                                    | Usar tokens (`--z-modal`, `--z-toast`, etc.).                                                                                                                                                                                                               |
| Compartilhar `QueryClient` entre testes                                        | Padrão dos testes Buscar                              | Cache vaza entre suites; instanciar novo por teste.                                                                                                                                                                                                         |
| `defaultProps` em componente funcional                                         | React 19 deprecation                                  | Usar default value no destructuring de parâmetro.                                                                                                                                                                                                           |

---

### ADRs frontend citados

- **ADR-011** — Dark mode via classe `html.dark` no `<html>`, tokens overridados em `:root` vs `html.dark`.
- **ADR-022 / ADR-038** — Highlight de busca via `mark.js` (sem `dangerouslySetInnerHTML`).
- **ADR-023** — Contrato `/api/v1/search/articles/` + headers `Cache-Control: max-age=60, stale-while-revalidate=300`.
- **ADR-024** — Rate limit 30/min do endpoint de busca.
- **ADR-026** — CSR no MVP; SSR/Next.js fora de escopo até medirmos LCP baseline em prod.
- **ADR-027** — URL como SSOT da busca (`useSearchParamsState`).
- **ADR-028** — Proibir `role="combobox"` em SearchInput.
- **ADR-029** — Tokens novos da busca em vez de redefinir brand; lista de tokens proibidos de override.
- **ADR-030-FE** — `<ErrorBoundary>` interno com `resetKeys={[deferredQ]}` para sub-tree de resultados.
- **ADR-030-UI** — Thumb-left 120×80, anti-CLS via `width`/`height` HTML.
- **ADR-042** — Playwright visual regression para 5 estados × light/dark × mobile (roadmap).
- **ADR-045** — `vitest-axe` em CI (a11y E2E em 5 estados + componentes-chave + integração).
- **F12 / F16** — `<Link>` estilizado em vez de `<button><Link>`; voz editorial em 404.
- **P1/C6** — Self-host de fontes via `@fontsource-variable/*`.
- **Bug 4** — Pilha obrigatória `useDebouncedValue` antes de `useDeferredValue`.
- **Bug 5** — Proibido `role="combobox"`.
- **Bug 6** — `getNextPageParam` → `?? undefined` (TanStack trata `null` como cursor válido).
- **Fix H-02** — SSOT de `STALE_TIME`/`GC_TIME` em `searchService.ts`.
- **Fix H-03** — Cleanup explícito do `mark.js` (anti `<mark>` aninhado).
- **Fix H-04** — `data-variant` no wrapper para colorir thumb placeholder + badge.
- **BLOQUEIO-1** — MSW worker (`src/mocks/`).
- **BLOQUEIO-2** — `vitest-axe` em CI.

---

## Cross-references

- [STACK.md](STACK.md) — versões reais das libs citadas
- [ARCHITECTURE.md](ARCHITECTURE.md) — onde essas convenções vivem
- [TESTING.md](TESTING.md) — convenções específicas de teste
- [CONCERNS.md](CONCERNS.md) — anti-patterns banidos e gotchas
- [docs/backlog/README.md](../../backlog/README.md) — convenções de naming pt-BR para Epic/Feature/CA/US/Task
