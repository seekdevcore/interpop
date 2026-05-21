"""
Testes do endpoint /healthz/ — A29 do Improvement-system §11.2.
"""
from __future__ import annotations

import json

import pytest


pytestmark = pytest.mark.django_db


def test_healthz_returns_200_when_all_ok(client):
    resp = client.get('/healthz/')
    assert resp.status_code == 200
    body = json.loads(resp.content)
    assert body['status'] == 'ok'
    assert body['db'] == 'ok'
    assert body['cache'] == 'ok'
    assert 'version' in body


def test_healthz_works_without_trailing_slash(client):
    """Monitor externo pode ser configurado sem trailing slash —
    aceita ambos pra evitar 301."""
    resp = client.get('/healthz')
    assert resp.status_code == 200


def test_healthz_no_auth_required(client):
    """Anon deve passar — endpoint é pra UptimeRobot/Better Stack
    que não tem credencial."""
    resp = client.get('/healthz/')
    assert resp.status_code == 200


def test_healthz_version_from_env_var(client, monkeypatch):
    """GIT_SHA do env (setado pelo deploy.sh) reflete no payload."""
    monkeypatch.setenv('GIT_SHA', 'abc12345xyz_long_sha_truncated')
    resp = client.get('/healthz/')
    body = json.loads(resp.content)
    assert body['version'] == 'abc12345xyz_'   # truncado em 12 chars
