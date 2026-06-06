"""
Base settings shared across all environments.
Security-first configuration — never run with DEBUG=True in production.
"""
from datetime import timedelta
from pathlib import Path

from decouple import Csv, config

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = config('SECRET_KEY')
DEBUG = False
ALLOWED_HOSTS: list[str] = []

# ── Applications ────────────────────────────────────────────────────────────────

DJANGO_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.sites',
    'django.contrib.sitemaps',
]

SITE_ID = 1

THIRD_PARTY_APPS = [
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'axes',
    'django_filters',
    'django_celery_beat',  # cron-like scheduler (Article auto-purge, etc.)
]

LOCAL_APPS = [
    'apps.users',
    'apps.articles',
    'apps.comments',
    'apps.moderation',
    'apps.audit',
    'apps.newsletter',
    'apps.search',  # Fase 1 da busca editorial (DESIGN §2.2, §6)
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# ── Middleware ───────────────────────────────────────────────────────────────────

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    # RequestID: gera UUID por request + popula contextvars (request_id,
    # user_id) lidos pelo RequestContextFilter em apps.audit.logging.
    # Roda APÓS Authentication (precisa ler request.user) e ANTES de
    # AuditLog (pra que AuditLog use o mesmo request.id).
    'apps.audit.middleware.RequestIDMiddleware',
    'axes.middleware.AxesMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'apps.audit.middleware.AuditLogMiddleware',
    # Headers de segurança adicionais (Permissions-Policy). Django
    # SecurityMiddleware cobre HSTS/COOP/Referrer/X-Frame nativamente.
    # S9 do Improvement-system §11.6.
    'apps.audit.security_headers_middleware.SecurityHeadersMiddleware',
    # Intercepta crawlers sociais (WhatsApp/Twitter/Facebook) em /noticia/<slug>
    # e devolve HTML com meta tags OG ricas. Outras requests passam intactas.
    'apps.articles.og_middleware.SocialOGMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# ── Authentication ───────────────────────────────────────────────────────────────

AUTH_USER_MODEL = 'users.User'

PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.Argon2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',
    'django.contrib.auth.hashers.BCryptSHA256PasswordHasher',
]

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 8},
    },
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
    # Complexidade (maiúscula + minúscula + dígito + especial) — espelha o
    # checklist do frontend; aplica a Register, troca de senha e reset (todos
    # passam por validate_password).
    {'NAME': 'apps.users.validators.PasswordComplexityValidator'},
]

AUTHENTICATION_BACKENDS = [
    'axes.backends.AxesStandaloneBackend',
    'django.contrib.auth.backends.ModelBackend',
]

# ── JWT / Cookie auth ────────────────────────────────────────────────────────────

SIMPLE_JWT = {
    # TTLs calibradas para perfil editorial — alinhadas com Substack/Medium/NYT.
    # Access curto (30min) limita blast radius de token vazado; rotation
    # silenciosa pelo interceptor axios deixa a UX invisível. Refresh longo
    # (30 dias) reduz fricção pro leitor que volta com cadência variável —
    # KPI editorial é retenção, não segurança bancária.
    # Anteriormente: 15min + 7d (herança de setup fintech-default,
    # conservador demais pro produto). Ajustado 2026-05-21.
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    # JWT_SIGNING_KEY env distinta de SECRET_KEY (defesa em profundidade).
    # Vazamento de uma não compromete a outra. Em produção: SETAR JWT_SIGNING_KEY
    # explicitamente no .env (chave aleatória ≥50 chars). Fallback p/ SECRET_KEY
    # mantém retrocompat em dev sem .env modificado. S4 do Improvement-system §11.6.
    'SIGNING_KEY': config('JWT_SIGNING_KEY', default=config('SECRET_KEY')),
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
    'AUTH_COOKIE': 'access_token',
    'AUTH_COOKIE_REFRESH': 'refresh_token',
    'AUTH_COOKIE_SECURE': True,
    'AUTH_COOKIE_HTTP_ONLY': True,
    'AUTH_COOKIE_PATH': '/',
    'AUTH_COOKIE_SAMESITE': 'Lax',
}

# ── DRF ─────────────────────────────────────────────────────────────────────────

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'apps.users.authentication.JWTCookieAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
        # Defense in depth: bloqueia banned authenticated em TODA request
        # (além do bloqueio no LoginSerializer). Endpoints públicos com
        # AllowAny no view sobrescrevem o default inteiro. S8 §11.6.
        'apps.users.permissions.IsNotBanned',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.MultiPartParser',
        'rest_framework.parsers.FormParser',
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/hour',
        'user': '1000/hour',
        'auth': '10/minute',
    },
}

# ── django-axes (brute-force protection) ─────────────────────────────────────────

AXES_FAILURE_LIMIT = 5
AXES_COOLOFF_TIME = timedelta(minutes=30)
AXES_LOCK_OUT_AT_FAILURE = True
AXES_RESET_ON_SUCCESS = True
AXES_LOCKOUT_PARAMETERS = ['ip_address', 'username']
AXES_ENABLE_ADMIN = True

# ── CORS ─────────────────────────────────────────────────────────────────────────

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    'accept', 'accept-encoding', 'authorization', 'content-type',
    'dnt', 'origin', 'user-agent', 'x-csrftoken', 'x-requested-with',
]

# ── CSRF ─────────────────────────────────────────────────────────────────────────

CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SECURE = True

# ── Email ────────────────────────────────────────────────────────────────────────

DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='noreply@interpop.com')
EMAIL_HOST         = config('EMAIL_HOST',         default='smtp.gmail.com')
EMAIL_PORT         = config('EMAIL_PORT',         default=587, cast=int)
EMAIL_HOST_USER    = config('EMAIL_HOST_USER',    default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
EMAIL_USE_TLS      = True

SITE_URL = config('SITE_URL', default='http://localhost:5173')

# ── Internationalisation ─────────────────────────────────────────────────────────

LANGUAGE_CODE = 'pt-br'
TIME_ZONE = 'America/Sao_Paulo'
USE_I18N = True
USE_TZ = True

# ── Static / Media ───────────────────────────────────────────────────────────────

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024

# ── Cache ──────────────────────────────────────────────────────────────────────
# LocMemCache é per-process: cada worker do gunicorn tem sua própria cópia.
# Adequado para dev e para anti-abuse leve (view_count bucket, og_middleware).
# Quando o Redis entrar como dependência operacional (A20 do Improvement-system
# §11.2 — setup Celery+Redis), `production.py` deve fazer override para
# `django_redis.cache.RedisCache` com LOCATION apontando para o broker local.
CACHES = {
    'default': {
        'BACKEND':  'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'interpop-locmem',
        'TIMEOUT':  300,  # 5 min default
    },
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ── Security headers (production) ────────────────────────────────────────────────

SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'
# Cross-Origin-Opener-Policy: isola a janela do site de janelas abertas
# por outras origens (mitiga XS-Leaks). Django 4.2+ injeta automaticamente
# via SecurityMiddleware. S9 do Improvement-system §11.6.
SECURE_CROSS_ORIGIN_OPENER_POLICY = 'same-origin'

# ── Content-Security-Policy (S3 do Improvement-system §11.6) ─────────────────
# CSP entra em modo Report-Only por default — coleta violations no console
# do browser (e POST em CSP_REPORT_URI se setado) sem bloquear nada por
# 1 semana. Depois do baseline limpo, virar CSP_ENFORCE=True no .env de prod
# pra browsers bloquearem violations de fato.
#
# Endpoint de report: pode ser criado interno em /api/v1/security/csp-report/
# (handler simples logando + Sentry) OU usar Sentry CSP endpoint
# (https://docs.sentry.io/product/security-policy-reporting/).
#
# Cobertura: aplicado a TODA resposta do Django via SecurityHeadersMiddleware.
# SPA frontend é servido pelo nginx — CSP do nginx é configurada separado
# (HOSTING-DEPLOY-PLAN.md — item a entrar pós-baseline).
CSP_ENFORCE = config('CSP_ENFORCE', default=False, cast=bool)
CSP_REPORT_URI = config('CSP_REPORT_URI', default='')

# ── Logging (A27 do Improvement-system §11.2) ────────────────────────────────────
# Em dev: formato legível tipo `[2026-05-21 00:35] INFO interpop.foo [req=abc123
# user=42]: mensagem`. Em prod: JSON único por linha pra Loki/journald/Sentry
# parsearem sem ambiguidade. Toda linha carrega request_id e user_id injetados
# pelo RequestContextFilter (lê contextvars do RequestIDMiddleware).
#
# Roots:
# - root: INFO em prod, INFO em dev (DEBUG seria poluição em dev quando o
#   Django runserver mostra tudo no terminal).
# - django.request: WARNING+ — silencia o ruído de 200 OK rotineiro.
# - django.security: INFO+ — capturar tentativas de bruteforce, CSRF fail, etc.
# - interpop: app code com prefixo 'interpop.' usa DEBUG em dev, INFO em prod.
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'filters': {
        'request_context': {
            '()': 'apps.audit.logging.RequestContextFilter',
        },
    },
    'formatters': {
        'json': {
            '()': 'pythonjsonlogger.json.JsonFormatter',
            'fmt': '%(asctime)s %(levelname)s %(name)s %(message)s %(request_id)s %(user_id)s',
            'datefmt': '%Y-%m-%dT%H:%M:%S%z',
        },
        'verbose': {
            'format': '[{asctime}] {levelname} {name} [req={request_id} user={user_id}]: {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose' if DEBUG else 'json',
            'filters': ['request_context'],
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django.request':  {'level': 'WARNING', 'handlers': ['console'], 'propagate': False},
        'django.security': {'level': 'INFO',    'handlers': ['console'], 'propagate': False},
        'interpop':        {'level': 'DEBUG' if DEBUG else 'INFO', 'handlers': ['console'], 'propagate': False},
        'celery':          {'level': 'INFO',    'handlers': ['console'], 'propagate': False},
    },
}

# ── Celery (A20-A22 do Improvement-system §11.2) ─────────────────────────────────
# Broker: Redis local default. Em prod (production.py) deve apontar pro Redis
# do VPS via env REDIS_URL.
#
# Em dev sem Redis instalado: `CELERY_TASK_ALWAYS_EAGER=True` em
# development.py faz as tasks rodarem síncronas no request thread (mesmo
# efeito do código atual pre-Celery). Sem precisar de worker. Tests do
# pytest também rodam eagerly por padrão.
#
# Pra subir worker real local: `sudo apt install redis-server` + flip
# do flag pra False + `celery -A config worker -l info` em outro terminal.
CELERY_BROKER_URL = 'redis://localhost:6379/0'
CELERY_RESULT_BACKEND = None  # tasks são fire-and-forget (email, push)
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'America/Sao_Paulo'
CELERY_ENABLE_UTC = True
# Beat scheduler usando DB (django-celery-beat) — schedule via Django admin
# em vez de cron file. Permite ajuste dinâmico sem restart do beat.
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'
# Retry default: 3 tentativas com backoff exponencial. Email transiente
# (SMTP timeout) tem alta chance de funcionar no 2º try.
CELERY_TASK_ACKS_LATE = True
CELERY_TASK_REJECT_ON_WORKER_LOST = True
CELERY_TASK_DEFAULT_RETRY_DELAY = 60      # 1 min
CELERY_TASK_MAX_RETRIES = 3
# Hard timeout: tasks longas (>5min) são killed. send_article_notification
# (Celery task) pra 1000 subscribers leva ~30s em SendGrid; folga grande
# mesmo assim. NB: o helper síncrono interno é _dispatch_article_notification_sync.
CELERY_TASK_TIME_LIMIT = 300
CELERY_TASK_SOFT_TIME_LIMIT = 270

# ── Busca editorial (DESIGN §2.3 + algorithms-architect invariantes) ─────────
# Parametriza decisões críticas de ranking, throttling, tamanho de query e
# feature-flag para A/B test e fail-open / fail-close cirúrgico em incidente.
#
# Cada constante é referenciada por exatamente UMA invariante do algorithms
# specialist (_specialist-outputs/02-algorithms-architect.md §8); mudar valor
# aqui sem entender a invariante = bug semântico silencioso.

# Inv 10 — half-life em days (NÃO literal). exp(-Δt / 86400·DAYS) na CTE
# `scored`. 60 = editorial Substack/NYT (vs 21 do news-cycle Hacker News).
SEARCH_RECENCY_HALF_LIFE_DAYS = config(
    'SEARCH_RECENCY_HALF_LIFE_DAYS', default=60, cast=int,
)

# Inv 8 — cap de tokens significativos após strip stopwords. Excedeu → 400
# `query_too_complex` (defesa A2 do algorithms §5: 20 tokens repetidos
# inflam tsvector bitmap).
SEARCH_MAX_TOKENS = config('SEARCH_MAX_TOKENS', default=8, cast=int)

# 200 chars limite hard de input. 201+ → 400. Min 2 chars (CA-01).
SEARCH_MAX_Q_LENGTH = config('SEARCH_MAX_Q_LENGTH', default=200, cast=int)
SEARCH_MIN_Q_LENGTH = config('SEARCH_MIN_Q_LENGTH', default=2, cast=int)

# Inv 9 — cap de profundidade de paginação. Cursor carrega `depth`; >50 →
# 400 `refine_query` (defesa A3 do algorithms §5).
SEARCH_MAX_PAGINATION_DEPTH = config(
    'SEARCH_MAX_PAGINATION_DEPTH', default=50, cast=int,
)

# Paginação — DESIGN §2.4. Default 20 por página, máximo 50.
SEARCH_DEFAULT_PER_PAGE = config('SEARCH_DEFAULT_PER_PAGE', default=20, cast=int)
SEARCH_MAX_PER_PAGE = config('SEARCH_MAX_PER_PAGE', default=50, cast=int)

# M1 do algorithms §2.3 — CTE candidate-narrowing. LIMIT 500 corta 15k
# heap fetches para 500 na Zipf-head (defesa de p95).
SEARCH_CANDIDATES_LIMIT = config(
    'SEARCH_CANDIDATES_LIMIT', default=500, cast=int,
)

# Inv 12 — statement_timeout aplicado por TX no SearchService (defesa em
# profundidade independente do role Postgres — TX-15 / T30.4.X9).
SEARCH_STATEMENT_TIMEOUT_MS = config(
    'SEARCH_STATEMENT_TIMEOUT_MS', default=500, cast=int,
)

# Cache Redis (search:v1:*). TTL 5 min sob padrão (Cache-Control max-age=60
# no HTTP layer + Redis 300s separados).
SEARCH_CACHE_TTL_SECONDS = config(
    'SEARCH_CACHE_TTL_SECONDS', default=300, cast=int,
)

# Feature flag (TX-13 / T30.1.X4). Default False para permitir merge em prod
# sem ativar o endpoint até cutover deliberado. 503 + Retry-After quando off.
SEARCH_FEATURE_ENABLED = config(
    'SEARCH_FEATURE_ENABLED', default=False, cast=bool,
)

# HMAC secret para cursor de paginação. Em DEV fallback para SECRET_KEY
# é aceito (parecido com JWT_SIGNING_KEY). Em PROD `production.py` faz
# `raise ImproperlyConfigured` se vazio OU igual a SECRET_KEY — fecha
# F2-B-03 do REVIEW-PHASE-2 (leak de SECRET_KEY permite forjar cursor +
# bypass do cap de paginação A3).
SEARCH_CURSOR_HMAC_SECRET = config(
    'SEARCH_CURSOR_HMAC_SECRET', default=SECRET_KEY,
)

# ── Throttling do endpoint /api/v1/search/articles/ (ADR-024 + T30.4.1-4) ────
# Sobrescreve scopes anon/user/auth do DRF apenas para a busca. SearchView
# usa SearchAnonThrottle, SearchUserThrottle e SearchGlobalThrottle (ADR-036).
REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'].update({
    'search_anon': config('SEARCH_THROTTLE_ANON', default='30/min'),
    'search_user': config('SEARCH_THROTTLE_USER', default='60/min'),
    # ADR-036 — throttle global do endpoint para mitigar botnet distribuído
    # (vetor H-03 SECURITY-REVIEW). Soma à throttle por tier.
    'search_global': config('SEARCH_THROTTLE_GLOBAL', default='500/min'),
})
