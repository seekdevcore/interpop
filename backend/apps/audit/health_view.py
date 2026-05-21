"""
Health check endpoint.

GET /healthz/ → JSON com status dos serviços críticos (DB, cache).
Resposta 200 se tudo ok, 503 se qualquer check falhar.

Usado por:
- Monitor externo (UptimeRobot, Better Stack) — bate 1x/minuto.
- Nginx upstream check (proxy_next_upstream).
- Smoke test do deploy.sh (rollback automático se /healthz falha após
  restart do gunicorn).

Sem auth, sem throttle, sem audit log — endpoint mais simples possível,
deve responder em <50ms p99 mesmo sob carga. Não use pra business
metrics (use /api/v1/admin/metrics/ que é autenticado).

A29 do Improvement-system §11.2.
"""
from __future__ import annotations

import os

from django.core.cache import cache
from django.db import connection
from django.http import JsonResponse


def _check_db() -> str:
    """SELECT 1 — fail-fast se Postgres ficou inacessível."""
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
            cursor.fetchone()
        return 'ok'
    except Exception as e:
        return f'error: {type(e).__name__}'


def _check_cache() -> str:
    """Roundtrip set+get no cache. Em dev é LocMemCache (sempre ok). Em
    prod vai detectar Redis fora do ar quando A20 entrar."""
    try:
        cache.set('healthz', 'ok', 5)
        return 'ok' if cache.get('healthz') == 'ok' else 'mismatch'
    except Exception as e:
        return f'error: {type(e).__name__}'


def healthz(request):
    db    = _check_db()
    cache_status = _check_cache()
    ok    = db == 'ok' and cache_status == 'ok'

    payload = {
        'status':  'ok' if ok else 'degraded',
        # Git SHA passada via env no deploy.sh (`GIT_SHA=$SHA ./deploy.sh`).
        # Em dev sem env: 'unknown'. Útil pra confirmar qual deploy está vivo.
        'version': os.environ.get('GIT_SHA', 'unknown')[:12],
        'db':      db,
        'cache':   cache_status,
    }
    return JsonResponse(
        payload,
        status=200 if ok else 503,
    )
