"""Production settings guards (fixes F2-B-03 / REVIEW-PHASE-2).

Por que existe: `base.py` deixa `SEARCH_CURSOR_HMAC_SECRET` cair em
`SECRET_KEY` como fallback (conveniente em dev). `production.py` precisa
recusar essa configuração — leak de SECRET_KEY (via dump, traceback ou
dep comprometida) permite forjar cursor e bypassar o cap de 50 páginas
(A3 do specialist algorithms).

Estratégia de teste: importação dinâmica de `config.settings.production`
sob diferentes envs, capturando `ImproperlyConfigured`. Esta abordagem é
necessária porque settings já está carregado pela sessão atual de
pytest — `importlib.reload` quebra apps; usamos `subprocess` para
isolar o teste em um interpretador fresco.
"""
from __future__ import annotations

import os
import subprocess
import sys
import textwrap
from pathlib import Path


# Backend root = …/interpop/backend (contém manage.py + config/).
# Sobe de apps/search/tests/test_settings_production.py.
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
    """Env mínima para `production.py` carregar sem outros erros.

    Inclui `JWT_SIGNING_KEY` distinta de `SECRET_KEY` para não disparar o
    guard S-02 acidentalmente (cada arquivo testa SEU próprio guard).
    """
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
        'JWT_SIGNING_KEY': 'distinct-jwt-signing-key-not-secret-key-cafefeed',
    }


def test_production_settings_reject_hmac_equal_to_secret_key():
    """SEARCH_CURSOR_HMAC_SECRET == SECRET_KEY → ImproperlyConfigured (F2-B-03)."""
    env = _base_env()
    # NÃO setamos SEARCH_CURSOR_HMAC_SECRET → fallback para SECRET_KEY (default).
    env.pop('SEARCH_CURSOR_HMAC_SECRET', None)

    result = _run_settings_load(env)
    assert result.returncode == 2, (
        f"Esperado SystemExit(2) (ImproperlyConfigured). "
        f"Got rc={result.returncode}\nstdout={result.stdout}\nstderr={result.stderr}"
    )
    assert 'SEARCH_CURSOR_HMAC_SECRET' in result.stdout, (
        f'Mensagem de erro deve citar SEARCH_CURSOR_HMAC_SECRET. '
        f'stdout={result.stdout!r}'
    )
    assert 'F2-B-03' in result.stdout, (
        f'Mensagem de erro deve referenciar o achado F2-B-03 para rastreabilidade. '
        f'stdout={result.stdout!r}'
    )


def test_production_settings_reject_empty_hmac_secret():
    """SEARCH_CURSOR_HMAC_SECRET vazia → ImproperlyConfigured (F2-B-03)."""
    env = _base_env()
    env['SEARCH_CURSOR_HMAC_SECRET'] = ''

    result = _run_settings_load(env)
    # Vazio cai no `default=SECRET_KEY` do decouple; mesmo erro do anterior.
    assert result.returncode == 2, (
        f"Esperado ImproperlyConfigured para HMAC vazia. rc={result.returncode} "
        f"stdout={result.stdout}\nstderr={result.stderr}"
    )


def test_production_settings_accept_distinct_hmac_secret():
    """HMAC secret distinta de SECRET_KEY → load sucesso."""
    env = _base_env()
    env['SEARCH_CURSOR_HMAC_SECRET'] = (
        'distinct-prod-hmac-secret-not-same-as-secret-key-deadbeef'
    )

    result = _run_settings_load(env)
    assert result.returncode == 0, (
        f'Esperado rc=0 com HMAC válida distinta de SECRET_KEY. '
        f'rc={result.returncode} stdout={result.stdout}\nstderr={result.stderr}'
    )
    assert 'OK' in result.stdout
