"""
Testes do wrapper de Sentry — A28 do Improvement-system §11.2.

Cobertura: init é no-op sem DSN; _scrub remove PII; _before_send
filtra /healthz. NÃO testamos o init real com DSN (exigiria
mockar sentry_sdk pesadamente; cobertura básica já garante que
o caminho não levanta).
"""
from __future__ import annotations

from apps.audit.sentry import _before_send, _scrub, init_sentry


# ── _scrub: filtragem de PII ─────────────────────────────────────────────────

def test_scrub_filters_password_field():
    data = {'username': 'gabriel', 'password': 'SenhaForte!2026'}
    out  = _scrub(data)
    assert out['username'] == 'gabriel'
    assert out['password'] == '[Filtered]'


def test_scrub_filters_token_fields():
    data = {
        'access_token':  'eyJxxx',
        'refresh_token': 'eyJyyy',
        'csrf_token':    'abc',
    }
    out = _scrub(data)
    for k in data:
        assert out[k] == '[Filtered]'


def test_scrub_is_case_insensitive():
    data = {'Authorization': 'Bearer xyz', 'COOKIE': 'session=abc'}
    out  = _scrub(data)
    assert out['Authorization'] == '[Filtered]'
    assert out['COOKIE'] == '[Filtered]'


def test_scrub_recurses_into_nested_dicts():
    data = {'request': {'headers': {'Authorization': 'Bearer xyz'}}}
    out  = _scrub(data)
    assert out['request']['headers']['Authorization'] == '[Filtered]'


def test_scrub_recurses_into_lists():
    data = {'cookies': [{'name': 'session', 'value': 'x'},
                        {'token': 'secret'}]}
    out = _scrub(data)
    assert out['cookies'][1]['token'] == '[Filtered]'


def test_scrub_preserves_non_pii_values():
    data = {'status': 'ok', 'count': 42, 'tags': ['a', 'b']}
    assert _scrub(data) == data


def test_scrub_handles_cyclic_via_depth_cap():
    """Não deve estourar RecursionError em estrutura profunda."""
    deep = {'a': {'b': {'c': {'d': {'e': {'f': {'g': {'password': 'x'}}}}}}}}
    out  = _scrub(deep)
    # Cap em 6 níveis — passa sem levantar
    assert isinstance(out, dict)


# ── _before_send: drop de /healthz ───────────────────────────────────────────

def test_before_send_drops_healthz_events():
    event = {'request': {'url': 'https://interpop.cc/healthz/'}}
    assert _before_send(event, {}) is None


def test_before_send_drops_healthz_without_trailing_slash():
    event = {'request': {'url': 'https://interpop.cc/healthz'}}
    assert _before_send(event, {}) is None


def test_before_send_keeps_real_events_with_scrub():
    event = {
        'request': {
            'url':  'https://interpop.cc/api/v1/auth/login/',
            'data': {'email': 'user@test.com', 'password': 'secret'},
        },
    }
    out = _before_send(event, {})
    assert out is not None
    assert out['request']['data']['password'] == '[Filtered]'
    assert out['request']['data']['email']    == '[Filtered]'


# ── init_sentry: idempotência sem DSN ────────────────────────────────────────

def test_init_sentry_noop_without_dsn(monkeypatch):
    """Sem SENTRY_DSN no env, init retorna False e NÃO levanta."""
    monkeypatch.delenv('SENTRY_DSN', raising=False)
    assert init_sentry(environment='test') is False


def test_init_sentry_noop_with_empty_dsn(monkeypatch):
    """DSN string vazia conta como 'sem DSN' (config error comum)."""
    monkeypatch.setenv('SENTRY_DSN', '')
    assert init_sentry(environment='test') is False


def test_init_sentry_noop_with_whitespace_dsn(monkeypatch):
    monkeypatch.setenv('SENTRY_DSN', '   ')
    assert init_sentry(environment='test') is False
