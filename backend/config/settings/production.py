"""Production settings — PostgreSQL, HTTPS, strict security headers."""
from django.core.exceptions import ImproperlyConfigured
from decouple import Csv, config

from .base import *  # noqa: F401, F403
from .base import SECRET_KEY, SEARCH_CURSOR_HMAC_SECRET, SIMPLE_JWT
from apps.audit.sentry import init_sentry

DEBUG = False

# ── Fix F2-B-03 (REVIEW-PHASE-2) — cursor HMAC secret hard-fail em prod ───────
# Em base.py o fallback do `SEARCH_CURSOR_HMAC_SECRET` é o `SECRET_KEY`
# (conveniente para dev). Em produção isso é dívida de segurança: leak do
# SECRET_KEY (via traceback, dump, dependência comprometida) permite forjar
# cursor — adversário manipula `depth` e bypassa o cap de 50 páginas (A3
# do specialist algorithms). Aqui falhamos cedo se o operador esquecer de
# setar a env var ou se ela coincidir com o SECRET_KEY.
if not SEARCH_CURSOR_HMAC_SECRET or SEARCH_CURSOR_HMAC_SECRET == SECRET_KEY:
    raise ImproperlyConfigured(
        'SEARCH_CURSOR_HMAC_SECRET deve estar setada em produção e ser '
        'distinta de SECRET_KEY (vetor F2-B-03 do REVIEW-PHASE-2). '
        'Gere com `python -c "import secrets; print(secrets.token_urlsafe(48))"`.'
    )

# ── Fix S-02 (CONCERNS / RF-005) — JWT signing key hard-fail em prod ─────────
# Mesma família que F2-B-03 acima: `base.py:150` deixa `SIGNING_KEY` cair em
# `SECRET_KEY` como fallback (conveniente em dev). Em produção isso é vetor
# crítico — leak de `SECRET_KEY` compromete sessão **e** JWT simultaneamente,
# permitindo forja de access token e impersonação total (incluindo de roles
# `dev`, que é imune a ban por design). Defesa em profundidade exige duas
# chaves distintas: comprometer uma não compromete a outra. Hard-fail força
# o operador a setar `JWT_SIGNING_KEY` distinta antes de subir produção.
_JWT_SIGNING_KEY = SIMPLE_JWT.get('SIGNING_KEY')
if not _JWT_SIGNING_KEY or _JWT_SIGNING_KEY == SECRET_KEY:
    raise ImproperlyConfigured(
        'JWT_SIGNING_KEY deve estar setada em produção e ser distinta de '
        'SECRET_KEY (vetor S-02 do CONCERNS). Comprometer uma chave não '
        'pode comprometer a outra — defesa em profundidade. Gere com '
        '`python -c "import secrets; print(secrets.token_urlsafe(50))"`.'
    )
del _JWT_SIGNING_KEY

# Sentry — no-op silencioso se SENTRY_DSN não estiver no env.
# Em prod real: DSN setado, traces 10%, releases taggadas via GIT_SHA.
init_sentry(environment='production')

ALLOWED_HOSTS = config('ALLOWED_HOSTS', cast=Csv())

CORS_ALLOWED_ORIGINS = config('CORS_ALLOWED_ORIGINS', cast=Csv())
CSRF_TRUSTED_ORIGINS = config('CSRF_TRUSTED_ORIGINS', cast=Csv())

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME'),
        'USER': config('DB_USER'),
        'PASSWORD': config('DB_PASSWORD'),
        'HOST': config('DB_HOST', default='localhost'),
        'PORT': config('DB_PORT', default='5432'),
        'CONN_MAX_AGE': 60,
        'OPTIONS': {
            'sslmode': 'require',
        },
    }
}

# Full HTTPS enforcement
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000          # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Email
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = config('EMAIL_HOST')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_HOST_USER = config('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD')
EMAIL_USE_TLS = True
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='noreply@interpop.com')
