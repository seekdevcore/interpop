"""Production settings guards para `users-auth` (fix S-02 do CONCERNS).

Por que existe: `base.py:150` deixa `SIGNING_KEY` cair em `SECRET_KEY`
como fallback (conveniente em dev). `production.py` precisa recusar essa
configuração — leak de `SECRET_KEY` (via dump, traceback ou dependência
comprometida) compromete sessão **e** JWT simultaneamente, permitindo
forja de access token e impersonação total.

Réplica do padrão F2-B-03 (`apps.search.tests.test_settings_production`)
que já endureceu `SEARCH_CURSOR_HMAC_SECRET`. Mesmo vetor, mesma
mitigação.

Estratégia de teste: importação dinâmica de `config.settings.production`
em subprocess isolado, capturando `ImproperlyConfigured`. Necessário
porque settings já está carregado pela sessão pytest atual e
`importlib.reload` quebra apps.
"""
from __future__ import annotations

import os
import subprocess
import sys
import textwrap
from pathlib import Path


# Backend root = …/interpop/backend (contém manage.py + config/).
_BACKEND_ROOT = Path(__file__).resolve().parents[3]


def _run_settings_load(env: dict[str, str]) -> subprocess.CompletedProcess:
    """Carrega `config.settings.production` num Python isolado."""
    script = textwrap.dedent(
        """
        import os, django
        from django.core.exceptions import ImproperlyConfigured
        os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings.production'
        try:
            django.setup()
        except ImproperlyConfigured as exc:
            print('IMPROPER:' + str(exc))
            raise SystemExit(2)
        except Exception as exc:  # noqa: BLE001
            print('OTHER:' + repr(exc))
            raise SystemExit(3)
        print('OK')
        """
    )
    return subprocess.run(
        [sys.executable, '-c', script],
        capture_output=True,
        text=True,
        env=env,
        cwd=str(_BACKEND_ROOT),
        timeout=30,
    )


def _base_env() -> dict[str, str]:
    """Env mínima para `production.py` carregar — inclui HMAC secret válida
    (testes do JWT não devem disparar o guard do F2-B-03 acidentalmente)."""
    return {
        **os.environ,
        'DJANGO_SETTINGS_MODULE': 'config.settings.production',
        'SECRET_KEY': 'test-secret-key-not-real-prod',
        'ALLOWED_HOSTS': 'interpop.com',
        'CORS_ALLOWED_ORIGINS': 'https://interpop.com',
        'CSRF_TRUSTED_ORIGINS': 'https://interpop.com',
        'DB_NAME': 'interpop',
        'DB_USER': 'interpop',
        'DB_PASSWORD': 'x',
        'EMAIL_HOST': 'smtp.example.com',
        'EMAIL_HOST_USER': 'u',
        'EMAIL_HOST_PASSWORD': 'p',
        'SEARCH_CURSOR_HMAC_SECRET': 'distinct-hmac-secret-not-secret-key-deadbeef',
    }


def test_production_settings_reject_jwt_signing_key_equal_to_secret_key():
    """JWT_SIGNING_KEY == SECRET_KEY → ImproperlyConfigured (S-02)."""
    env = _base_env()
    # NÃO setamos JWT_SIGNING_KEY → fallback p/ SECRET_KEY (default em base.py:150).
    env.pop('JWT_SIGNING_KEY', None)

    result = _run_settings_load(env)
    assert result.returncode == 2, (
        f"Esperado SystemExit(2) (ImproperlyConfigured). "
        f"Got rc={result.returncode}\nstdout={result.stdout}\nstderr={result.stderr}"
    )
    assert 'JWT_SIGNING_KEY' in result.stdout, (
        f'Mensagem de erro deve citar JWT_SIGNING_KEY. stdout={result.stdout!r}'
    )
    assert 'S-02' in result.stdout, (
        f'Mensagem de erro deve referenciar o achado S-02 para rastreabilidade. '
        f'stdout={result.stdout!r}'
    )


def test_production_settings_reject_empty_jwt_signing_key():
    """JWT_SIGNING_KEY vazio → ImproperlyConfigured (cai no default=SECRET_KEY)."""
    env = _base_env()
    env['JWT_SIGNING_KEY'] = ''

    result = _run_settings_load(env)
    assert result.returncode == 2, (
        f"Esperado ImproperlyConfigured para JWT_SIGNING_KEY vazia. "
        f"rc={result.returncode}\nstdout={result.stdout}\nstderr={result.stderr}"
    )


def test_production_settings_accept_distinct_jwt_signing_key():
    """JWT_SIGNING_KEY distinta de SECRET_KEY → load sucesso."""
    env = _base_env()
    env['JWT_SIGNING_KEY'] = (
        'distinct-prod-jwt-signing-key-not-same-as-secret-key-cafefeed'
    )

    result = _run_settings_load(env)
    assert result.returncode == 0, (
        f'Esperado rc=0 com JWT_SIGNING_KEY válida distinta de SECRET_KEY. '
        f'rc={result.returncode}\nstdout={result.stdout}\nstderr={result.stderr}'
    )
    assert 'OK' in result.stdout
