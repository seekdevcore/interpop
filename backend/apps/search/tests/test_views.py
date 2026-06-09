"""Testes do endpoint ``GET /api/v1/search/articles/``.

Cobertura por bloco:

    1. Feature flag: 503 + Retry-After quando off (T30.1.X4)
    2. Serializer validation: 400 em q vazio, > 200 chars, chars proibidos,
       per_page > 50, date range invertido
    3. Cursor inválido → 400 cursor_invalid (Inv #5)
    4. Token cap → 400 query_too_complex (Inv #8)
    5. 200 OK feliz (SQLite path, sem fixtures = results vazio)
    6. Headers: Cache-Control, Vary, X-Robots-Tag, X-Cache HIT/MISS
    7. H-04 cross-tier cache isolation: anon e user produzem cache keys
       distintas mesmo para mesma query
"""
from __future__ import annotations

import pytest
from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APIClient


URL = '/api/v1/search/articles/'


@pytest.fixture(autouse=True)
def _clear_cache():
    """Cada teste começa sem cache leftovers (relevante para hit/miss)."""
    cache.clear()
    yield
    cache.clear()


# ── 1. Feature flag (T30.1.X4) ───────────────────────────────────────────────


@override_settings(SEARCH_FEATURE_ENABLED=False)
def test_feature_flag_off_returns_503(api_client: APIClient) -> None:
    resp = api_client.get(f'{URL}?q=kpop')
    assert resp.status_code == 503
    assert resp.data['error'] == 'feature_disabled'
    assert resp['Retry-After'] == '60'


# ── 2. Serializer validation (400) ───────────────────────────────────────────


@override_settings(SEARCH_FEATURE_ENABLED=True)
def test_q_missing_returns_400(api_client: APIClient) -> None:
    resp = api_client.get(URL)
    assert resp.status_code == 400


@override_settings(SEARCH_FEATURE_ENABLED=True)
def test_q_too_short_returns_400(api_client: APIClient) -> None:
    resp = api_client.get(f'{URL}?q=a')
    assert resp.status_code == 400


@override_settings(SEARCH_FEATURE_ENABLED=True)
def test_q_too_long_returns_400(api_client: APIClient) -> None:
    long_q = 'k' * 201
    resp = api_client.get(f'{URL}?q={long_q}')
    assert resp.status_code == 400


@override_settings(SEARCH_FEATURE_ENABLED=True)
def test_q_with_html_chars_returns_400(api_client: APIClient) -> None:
    """H-01 — defesa serializer: chars HTML rejeitados antes de chegar ao DB."""
    resp = api_client.get(f'{URL}?q=<script>alert(1)</script>')
    assert resp.status_code == 400
    # Erro estrutural pode aparecer em resp.data['q'] (lista de erros DRF)
    # ou em outro shape — basta NÃO ter 200 e NÃO ter chamado o service.
    # Conferimos que o detail/code mostra invalid_chars (substring em qualquer
    # nível do JSON serializado).
    import json as _json
    payload = _json.dumps(resp.data)
    assert 'invalid_chars' in payload, (
        f'Esperado código `invalid_chars` na resposta 400, recebido: {payload}'
    )


@override_settings(SEARCH_FEATURE_ENABLED=True)
def test_per_page_over_max_returns_400(api_client: APIClient) -> None:
    resp = api_client.get(f'{URL}?q=kpop&per_page=51')
    assert resp.status_code == 400


@override_settings(SEARCH_FEATURE_ENABLED=True)
def test_date_range_inverted_returns_400(api_client: APIClient) -> None:
    resp = api_client.get(
        f'{URL}?q=kpop&de=2026-12-31T00:00:00Z&ate=2026-01-01T00:00:00Z'
    )
    assert resp.status_code == 400


# ── 3. Cursor / token errors ─────────────────────────────────────────────────


@override_settings(SEARCH_FEATURE_ENABLED=True)
@pytest.mark.django_db
def test_cursor_invalid_returns_400(api_client: APIClient) -> None:
    """Inv #5 — cursor flipped → 400, NÃO 500/200."""
    resp = api_client.get(f'{URL}?q=kpop&cursor=garbage')
    assert resp.status_code == 400
    assert resp.data['error'] == 'cursor_invalid'


@override_settings(SEARCH_FEATURE_ENABLED=True, SEARCH_MAX_TOKENS=8)
@pytest.mark.django_db
def test_too_many_tokens_returns_400(api_client: APIClient) -> None:
    """Inv #8 — > 8 tokens significativos → 400 query_too_complex."""
    nine = 'kpop bts blackpink redvelvet twice itzy aespa mamamoo nine'
    resp = api_client.get(f'{URL}?q={nine}')
    assert resp.status_code == 400
    assert resp.data['error'] == 'query_too_complex'


# ── 4. 200 OK feliz ──────────────────────────────────────────────────────────


@override_settings(SEARCH_FEATURE_ENABLED=True)
@pytest.mark.django_db
def test_happy_path_200(api_client: APIClient) -> None:
    """Sem fixtures = results vazio, mas estrutura completa (Inv #11)."""
    resp = api_client.get(f'{URL}?q=kpop')
    assert resp.status_code == 200
    assert 'results' in resp.data
    assert 'next_cursor' in resp.data
    assert 'total_estimate' in resp.data
    assert 'query_terms_expanded' in resp.data
    assert 'took_ms' in resp.data
    assert isinstance(resp.data['results'], list)


@override_settings(SEARCH_FEATURE_ENABLED=True)
@pytest.mark.django_db
def test_empty_q_stopwords_returns_200_empty(api_client: APIClient) -> None:
    """Inv #7 — stopwords-only retorna 200 com results=[] (não 400).

    `q='o de da'` passa validação serializer (3 chars cada, ok) mas o
    service faz early-exit antes do DB.
    """
    resp = api_client.get(f'{URL}?q=o de da')
    assert resp.status_code == 200
    assert resp.data['results'] == []
    assert resp.data['next_cursor'] is None


# ── 5. Cache headers (ADR-023 + T30.4.X11 + F2-B-02) ─────────────────────────


@override_settings(SEARCH_FEATURE_ENABLED=True)
@pytest.mark.django_db
def test_cache_control_header_anon_is_public(api_client: APIClient) -> None:
    """Anônimo recebe `public` — CDN compartilha entre sessões sem auth."""
    resp = api_client.get(f'{URL}?q=kpop')
    assert resp['Cache-Control'] == 'public, max-age=60, stale-while-revalidate=300'


@override_settings(SEARCH_FEATURE_ENABLED=True)
@pytest.mark.django_db
def test_cache_control_header_authenticated_is_private(
    authed_client_factory, reader_user
) -> None:
    """Fix F2-B-02 do REVIEW-PHASE-2: autenticado recebe `private`.

    Defesa em profundidade contra CDN mergir cache cross-user se a
    response virar non-pure no futuro (ex.: adicionarem campo `bookmarked`).
    Vary continua presente como segunda barreira.
    """
    client = authed_client_factory(reader_user)
    resp = client.get(f'{URL}?q=kpop')
    assert resp.status_code == 200
    cache_control = resp['Cache-Control']
    assert cache_control.startswith('private'), (
        f'autenticado deve receber Cache-Control: private. got: {cache_control!r}'
    )
    # private invalida `stale-while-revalidate` (CDN não revalida private).
    assert 'stale-while-revalidate' not in cache_control
    # Vary continua presente (defense-in-depth).
    assert 'Authorization' in resp['Vary']


@override_settings(SEARCH_FEATURE_ENABLED=True)
@pytest.mark.django_db
def test_vary_header(api_client: APIClient) -> None:
    """H-04 ADR-037 — Vary: Authorization separa cache anon/user em CDN."""
    resp = api_client.get(f'{URL}?q=kpop')
    vary = resp['Vary']
    assert 'Authorization' in vary
    assert 'Accept-Encoding' in vary


@override_settings(SEARCH_FEATURE_ENABLED=True)
@pytest.mark.django_db
def test_x_robots_noindex(api_client: APIClient) -> None:
    """T30.4.X11 — busca não é indexada por crawlers."""
    resp = api_client.get(f'{URL}?q=kpop')
    assert 'noindex' in resp['X-Robots-Tag']


@override_settings(SEARCH_FEATURE_ENABLED=True)
@pytest.mark.django_db
def test_cache_miss_then_hit(api_client: APIClient) -> None:
    """Primeira request MISS; segunda igual HIT (mesmo tier)."""
    r1 = api_client.get(f'{URL}?q=kpop')
    assert r1.status_code == 200
    assert r1['X-Cache'] == 'MISS'

    r2 = api_client.get(f'{URL}?q=kpop')
    assert r2.status_code == 200
    assert r2['X-Cache'] == 'HIT'


# ── 6. H-04 — cross-tier cache isolation ─────────────────────────────────────


@override_settings(SEARCH_FEATURE_ENABLED=True)
@pytest.mark.django_db
def test_anon_and_user_have_separate_caches(
    api_client: APIClient, authed_client_factory, reader_user,
) -> None:
    """H-04 / ADR-037 — anon cache NUNCA serve autenticado.

    Cada tier tem cache key separada. Mesmo após anon gravar em cache,
    user vê MISS na primeira request (própria cache key).
    """
    # Anon → MISS, depois HIT
    r_anon_1 = api_client.get(f'{URL}?q=kpop')
    assert r_anon_1['X-Cache'] == 'MISS'
    r_anon_2 = api_client.get(f'{URL}?q=kpop')
    assert r_anon_2['X-Cache'] == 'HIT'

    # User com a MESMA query → MISS (cache key distinto)
    user_client = authed_client_factory(reader_user)
    r_user_1 = user_client.get(f'{URL}?q=kpop')
    assert r_user_1['X-Cache'] == 'MISS', (
        'Cache leak entre tiers — H-04 reaberto. '
        'Esperado X-Cache=MISS para user (cache key separada).'
    )
