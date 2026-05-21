"""
Sentry SDK init com filter de PII e configuração estável.

Setup condicional: sem `SENTRY_DSN` no env, init é no-op (não força
Sentry em dev local nem em ambientes que não querem telemetria
externa). Em produção, dispara stack trace, performance traces e
release tagging.

A28 do Improvement-system §11.2 — gating do go-live (A.13 do
HOSTING-DEPLOY-PLAN).
"""
from __future__ import annotations

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

# Chaves cujo VALOR deve sumir de qualquer event enviado ao Sentry.
# Conservador: incluir tudo que pode carregar PII ou credential.
_PII_KEYS = frozenset({
    'password', 'password2', 'old_password', 'new_password',
    'token', 'access_token', 'refresh_token', 'csrf_token',
    'authorization', 'cookie', 'set-cookie',
    'email', 'cpf', 'phone',
    'sendgrid_api_key', 'secret_key', 'jwt_signing_key',
})


def _scrub(value: Any, depth: int = 0) -> Any:
    """Recursively replace PII values with '[Filtered]'. Limit depth pra
    evitar stack overflow em estruturas cíclicas."""
    if depth > 6:
        return value
    if isinstance(value, dict):
        return {
            k: ('[Filtered]' if k.lower() in _PII_KEYS else _scrub(v, depth + 1))
            for k, v in value.items()
        }
    if isinstance(value, (list, tuple)):
        return type(value)(_scrub(v, depth + 1) for v in value)
    return value


def _before_send(event: dict, hint: dict) -> dict | None:
    """Hook do Sentry: filtra PII e dropa events de health check."""
    # Health check é ruído puro — não vai ajudar a debugar nada.
    request = event.get('request', {})
    if request.get('url', '').endswith('/healthz/') or request.get('url', '').endswith('/healthz'):
        return None

    return _scrub(event)


def init_sentry(*, environment: str = 'unknown') -> bool:
    """Inicializa o Sentry SDK SE houver SENTRY_DSN no env.
    Retorna True se conectou, False se foi no-op (sem DSN).

    Idempotente: chamar 2x não duplica handlers (Sentry SDK trata)."""
    dsn = os.environ.get('SENTRY_DSN', '').strip()
    if not dsn:
        logger.info('Sentry: SENTRY_DSN not set — telemetry disabled.')
        return False

    try:
        import sentry_sdk
        from sentry_sdk.integrations.django import DjangoIntegration
    except ImportError:
        logger.warning('Sentry: sentry-sdk not installed.')
        return False

    sentry_sdk.init(
        dsn=dsn,
        integrations=[DjangoIntegration(transaction_style='url')],
        # 10% de sample em traces (suficiente pra trends sem queimar quota).
        traces_sample_rate=float(os.environ.get('SENTRY_TRACES_SAMPLE_RATE', '0.1')),
        # 5% de profile (perfis de CPU em python — mais cara).
        profiles_sample_rate=float(os.environ.get('SENTRY_PROFILES_SAMPLE_RATE', '0.05')),
        # Nunca enviar PII automaticamente (cookies, headers, IPs).
        # Combinado com before_send=_scrub é defesa em profundidade.
        send_default_pii=False,
        before_send=_before_send,
        release=os.environ.get('GIT_SHA', 'unknown')[:12],
        environment=environment,
        server_name=os.environ.get('HOSTNAME', 'interpop'),
    )
    logger.info('Sentry: initialized for environment=%s, release=%s',
                environment, os.environ.get('GIT_SHA', 'unknown')[:12])
    return True
