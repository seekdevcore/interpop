"""Development settings — SQLite, DEBUG on, insecure cookies."""
from decouple import Csv, config

from .base import *  # noqa: F401, F403

DEBUG = True

ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1', cast=Csv())

CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:5173,http://127.0.0.1:5173',
    cast=Csv(),
)

CSRF_TRUSTED_ORIGINS = config(
    'CSRF_TRUSTED_ORIGINS',
    default='http://localhost:5173,http://127.0.0.1:5173',
    cast=Csv(),
)

# Disable HTTPS requirements for local dev
SIMPLE_JWT['AUTH_COOKIE_SECURE'] = False  # noqa: F405
CSRF_COOKIE_SECURE = False
SESSION_COOKIE_SECURE = False

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',  # noqa: F405
    }
}

# Email — defaults to console (prints to runserver terminal) so devs don't
# accidentally spam real inboxes.  Set USE_REAL_EMAIL=True in .env to use the
# SMTP backend configured in base.py (Gmail SMTP via EMAIL_HOST_PASSWORD).
if config('USE_REAL_EMAIL', default=False, cast=bool):
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
else:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# Relax axes for local testing
AXES_FAILURE_LIMIT = 20

# Celery em modo síncrono — não precisa de Redis instalado pra desenvolver.
# Tasks rodam no request thread (mesmo comportamento do código pré-Celery,
# mas no shape correto de `@shared_task` que vai pra prod).
#
# Pra subir worker real local:
#   1. sudo apt install -y redis-server
#   2. CELERY_TASK_ALWAYS_EAGER=False neste arquivo (ou via env)
#   3. celery -A config worker -l info        (em terminal separado)
#   4. celery -A config beat -l info          (se precisar de scheduled)
CELERY_TASK_ALWAYS_EAGER = config('CELERY_TASK_ALWAYS_EAGER', default=True, cast=bool)
# Em eager mode, propaga exceptions pro caller (em vez de virar resultado
# da task) — falhas em dev ficam visíveis no terminal do runserver.
CELERY_TASK_EAGER_PROPAGATES = True

# Relax DRF throttle rates for local testing — the production values (100/h
# anon, 1000/h user) bite hard during interactive dev (browser autoloads,
# hot reloads, manual smoke tests).
REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # noqa: F405 — inherited from base.py
    'DEFAULT_THROTTLE_RATES': {
        'anon': '10000/hour',
        'user': '10000/hour',
        'auth': '100/minute',
    },
}
