"""Testes das constantes ``SEARCH_*`` em ``config/settings/base.py``.

Cada constante mapeia para uma invariante do algorithms specialist
(``_specialist-outputs/02-algorithms-architect.md §8``). Mudança silenciosa
no settings sem atualizar esta lista = mudança de invariante sem revisão.

Cobertura:
    - Inv 10: ``SEARCH_RECENCY_HALF_LIFE_DAYS = 60``
    - Inv 8:  ``SEARCH_MAX_TOKENS = 8``
    - Inv 9:  ``SEARCH_MAX_PAGINATION_DEPTH = 50``
    - Inv 12: ``SEARCH_STATEMENT_TIMEOUT_MS = 500``
    - DESIGN §2.4: paginação default 20 / max 50
    - TX-13: ``SEARCH_FEATURE_ENABLED`` default False
    - HMAC: ``SEARCH_CURSOR_HMAC_SECRET`` não vazio
    - ADR-024 + ADR-036: throttle scopes registrados
"""
from __future__ import annotations

from django.conf import settings


def test_recency_half_life_days() -> None:
    """Inv 10 — half-life em settings, não literal na SQL."""
    assert settings.SEARCH_RECENCY_HALF_LIFE_DAYS == 60


def test_max_tokens_cap() -> None:
    """Inv 8 — cap de 8 tokens significativos."""
    assert settings.SEARCH_MAX_TOKENS == 8


def test_q_length_bounds() -> None:
    """DESIGN §2.4 — 2 ≤ len(q) ≤ 200."""
    assert settings.SEARCH_MIN_Q_LENGTH == 2
    assert settings.SEARCH_MAX_Q_LENGTH == 200


def test_pagination_depth_cap() -> None:
    """Inv 9 — cap de profundidade 50 (cursor carrega depth)."""
    assert settings.SEARCH_MAX_PAGINATION_DEPTH == 50


def test_per_page_default_and_max() -> None:
    """DESIGN §2.4 — per_page default 20, max 50."""
    assert settings.SEARCH_DEFAULT_PER_PAGE == 20
    assert settings.SEARCH_MAX_PER_PAGE == 50


def test_candidates_limit() -> None:
    """M1 algorithms §2.3 — CTE candidate-narrowing LIMIT 500."""
    assert settings.SEARCH_CANDIDATES_LIMIT == 500


def test_statement_timeout_ms() -> None:
    """Inv 12 — statement_timeout aplicado por TX no service."""
    assert settings.SEARCH_STATEMENT_TIMEOUT_MS == 500


def test_feature_flag_default_off() -> None:
    """T30.1.X4 — flag off por default (cutover deliberado em prod)."""
    assert settings.SEARCH_FEATURE_ENABLED is False


def test_cursor_hmac_secret_non_empty() -> None:
    """Cursor HMAC secret não pode ser vazio (TX-01) — fail-hard se vazio."""
    assert settings.SEARCH_CURSOR_HMAC_SECRET
    assert len(settings.SEARCH_CURSOR_HMAC_SECRET) >= 16


def test_throttle_scopes_registered() -> None:
    """ADR-024 + ADR-036 — três scopes da busca em DEFAULT_THROTTLE_RATES.

    NB: ``development.py`` sobrescreve REST_FRAMEWORK inteiro (não merge),
    então este test apenas verifica presença das chaves — os valores
    são relaxados em dev (10000/hour) vs prod (30/min, 60/min, 500/min).
    Valores de prod estão em ``base.py`` e são lidos por env var.
    """
    rates = settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']
    assert 'search_anon' in rates, (
        'Scope search_anon ausente — adicionar tanto em base.py quanto em '
        'development.py / production.py (REST_FRAMEWORK é replaced, não merged).'
    )
    assert 'search_user' in rates
    assert 'search_global' in rates


def test_cache_ttl_seconds() -> None:
    """Redis cache TTL — 5 min default (alinha Cache-Control + Redis)."""
    assert settings.SEARCH_CACHE_TTL_SECONDS == 300
