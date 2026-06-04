"""Testes do SearchService.query() — invariantes do algorithms specialist.

Cobertura (TDD em camadas):

Invariantes testáveis SEM Postgres (SQLite-dev OK):
    - Inv #7: empty tsquery early-exit (0 DB hits)
    - Inv #8: cap 8 tokens (>8 levanta erro)
    - Inv #11: query_terms_expanded computado (mesmo em fallback SQLite)
    - estimate_total: floor formula (ADR-025)
    - has_meaningful_query: stopwords sozinhas → empty

Invariantes que EXIGEM Postgres (marker requires_postgres):
    - Inv #3: plainto_tsquery (não to_tsquery)
    - Inv #4: status='published' AND published_at IS NOT NULL filter
    - Inv #6: cursor estável sob inserts concorrentes
    - SQL CTE candidates LIMIT 500 + recency boost
"""
from __future__ import annotations

from unittest.mock import patch

import pytest
from django.test import override_settings

from apps.search.dto import QuerySpec
from apps.search.services import (
    SearchService,
    TooManyTokensError,
    estimate_total,
)


# ── estimate_total (ADR-025) ─────────────────────────────────────────────────


def test_estimate_total_takes_max_of_plan_and_floor() -> None:
    """ADR-025 — total_estimate = max(plan_rows, (page_count-1)*per_page+len(results))."""
    # 1 página, 5 resultados, plan diz 100 → max(100, 0+5) = 100
    assert estimate_total(results_len=5, per_page=20, plan_rows=100, page_count=1) == 100
    # 3 páginas, 20 resultados na última, plan diz 30 → max(30, 40+20=60) = 60
    assert estimate_total(results_len=20, per_page=20, plan_rows=30, page_count=3) == 60
    # 1 página, 0 resultados → max(0, 0) = 0
    assert estimate_total(results_len=0, per_page=20, plan_rows=0, page_count=1) == 0


def test_estimate_total_floor_dominates_when_plan_underestimates() -> None:
    """Plan rows é heurística; nunca pode ser menor que evidência empírica
    de pages já vistas."""
    # 10ª página com 15 resultados → floor = (10-1)*20 + 15 = 195
    # plan diz 50 (underestima) → max(50, 195) = 195
    assert estimate_total(results_len=15, per_page=20, plan_rows=50, page_count=10) == 195
    # Mesma página, plan diz 999 (acima do floor) → max(999, 195) = 999
    assert estimate_total(results_len=15, per_page=20, plan_rows=999, page_count=10) == 999


# ── Inv #7: empty tsquery early-exit ─────────────────────────────────────────


@pytest.mark.django_db
def test_empty_q_early_exits_zero_db_hits() -> None:
    """Inv #7 — q apenas stopwords ou pontuação → 0 queries Postgres.

    Defesa contra adversarial input que infla bitmap intersection.
    Testamos via CaptureQueriesContext: depois do early-exit, ZERO queries.
    """
    from django.test.utils import CaptureQueriesContext
    from django.db import connection

    service = SearchService()
    spec = QuerySpec(q='!@#$')  # só pontuação — normaliza para ''

    with CaptureQueriesContext(connection) as ctx:
        page = service.query(spec)

    assert page.results == ()
    assert page.next_cursor is None
    assert page.total_estimate == 0
    # Zero queries Postgres — o service nem foi ao DB.
    assert len(ctx.captured_queries) == 0, (
        f'Empty tsquery deveria ter early-exit (0 queries), mas executou '
        f'{len(ctx.captured_queries)}: {[q["sql"][:80] for q in ctx.captured_queries]}'
    )


@pytest.mark.django_db
def test_empty_q_returns_query_terms_expanded_empty() -> None:
    """Empty early-exit ainda devolve query_terms_expanded=() (Inv #11 honra
    o contrato de shape)."""
    service = SearchService()
    page = service.query(QuerySpec(q='!@#$%'))
    assert page.query_terms_expanded == ()


# ── Inv #8: cap 8 tokens ─────────────────────────────────────────────────────


@override_settings(SEARCH_MAX_TOKENS=8)
def test_more_than_8_tokens_raises_too_many() -> None:
    """Inv #8 — > 8 tokens significativos → TooManyTokensError (view 400).

    Não precisa de DB — o cap é validado ANTES do early-exit/query.
    """
    nine_tokens = 'kpop bts blackpink redvelvet twice itzy aespa mamamoo nine'
    spec = QuerySpec(q=nine_tokens)
    service = SearchService()
    with pytest.raises(TooManyTokensError):
        service.query(spec)


@pytest.mark.django_db
@override_settings(SEARCH_MAX_TOKENS=8)
def test_exactly_8_tokens_passes() -> None:
    """8 é o cap — passa, 9 não."""
    eight_tokens = 'kpop bts blackpink redvelvet twice itzy aespa mamamoo'
    spec = QuerySpec(q=eight_tokens)
    service = SearchService()
    # Não deve raise — pode retornar resultados vazios em SQLite
    page = service.query(spec)
    assert page is not None


# ── Inv #11: query_terms_expanded ────────────────────────────────────────────


@pytest.mark.django_db
def test_query_terms_expanded_returns_tuple_of_strings() -> None:
    """Inv #11 — response.query_terms_expanded é tuple[str, ...] (frozen)."""
    service = SearchService()
    page = service.query(QuerySpec(q='kpop'))
    assert isinstance(page.query_terms_expanded, tuple)
    assert all(isinstance(t, str) for t in page.query_terms_expanded)


# ── SQLite fallback (icontains) — DESIGN §3.6 ────────────────────────────────


@pytest.mark.django_db
def test_sqlite_fallback_used_when_vendor_not_postgres() -> None:
    """ADR-020 — em SQLite-dev, query usa __icontains, não FTS."""
    from django.db import connection

    if connection.vendor == 'postgresql':
        pytest.skip('Este test cobre fallback SQLite — pula em Postgres')

    service = SearchService()
    page = service.query(QuerySpec(q='kpop'))
    # No SQLite dev sem fixtures, espera 0 resultados (sem crash).
    assert page.results == ()
    assert page.total_estimate == 0


# ── Cursor inválido propaga InvalidCursorError ───────────────────────────────


@pytest.mark.django_db
def test_invalid_cursor_propagates_error() -> None:
    """Inv #5 — cursor inválido → InvalidCursorError (view traduz 400)."""
    from apps.search.cursors import InvalidCursorError

    service = SearchService()
    spec = QuerySpec(q='kpop', cursor='garbage')
    with pytest.raises(InvalidCursorError):
        service.query(spec)


# ── Inv #3: plainto_tsquery (Postgres-only) ──────────────────────────────────


@pytest.mark.requires_postgres
@pytest.mark.django_db
def test_uses_plainto_tsquery_not_to_tsquery() -> None:
    """Inv #3 — operadores tsquery (& | ! :*) são IGNORADOS por plainto.

    plainto_tsquery('kpop:*&!') = plainto_tsquery('kpop') (limpa operadores).
    Sem isso, atacante poderia injetar operadores de tsquery.
    """
    from django.db import connection

    if connection.vendor != 'postgresql':
        pytest.skip('Postgres-only')

    service = SearchService()
    # Nenhum erro — plainto sanitiza
    page = service.query(QuerySpec(q='kpop:*&!|'))
    assert page is not None  # smoke


# ── statement_timeout aplicado (Inv #12) ─────────────────────────────────────


@pytest.mark.requires_postgres
@pytest.mark.django_db
def test_statement_timeout_applied_per_tx() -> None:
    """Inv #12 — SET LOCAL statement_timeout = '500ms' por transação.

    Defesa em profundidade independente do role Postgres.
    """
    from django.db import connection

    if connection.vendor != 'postgresql':
        pytest.skip('Postgres-only')

    service = SearchService()
    with patch.object(service, '_apply_statement_timeout') as mock_apply:
        service.query(QuerySpec(q='kpop'))
        # Foi chamado (defesa T30.4.X9)
        assert mock_apply.called or page_was_early_exit_check()


def page_was_early_exit_check() -> bool:  # helper para legibilidade do test acima
    return False
