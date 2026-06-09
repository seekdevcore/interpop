"""Testes do cache helper de busca (T30.4.X4 / SECURITY-REVIEW H-04).

Cobre a invariante de **isolamento de cache por tier** (ADR-037):

    > Cache key inclui auth_tier ('anon' | 'user'). Resposta cacheada por
    > usuário anônimo NUNCA serve para usuário autenticado e vice-versa.

CWE-524 — sem essa separação, um campo personalizado adicionado em
release futura vaza entre tiers silenciosamente.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from apps.search.cache import build_cache_key, canonical_query_string
from apps.search.dto import QuerySpec


# ── canonical_query_string ───────────────────────────────────────────────────


def test_canonical_query_string_deterministic() -> None:
    """Mesmo spec → mesma string canônica (defesa cache key estável)."""
    aid = uuid.uuid4()
    a = QuerySpec(q='kpop', author_id=aid, per_page=20)
    b = QuerySpec(q='kpop', author_id=aid, per_page=20)
    assert canonical_query_string(a) == canonical_query_string(b)


def test_canonical_query_string_includes_q_normalized() -> None:
    """A string canônica usa o ``q`` normalizado (não cru) — defesa contra
    cache thrashing por variantes case/whitespace."""
    a = QuerySpec(q='KPOP')
    b = QuerySpec(q='kpop')
    # Não exigimos string idêntica char a char, mas SIM cache key igual.
    assert build_cache_key(a, auth_tier='anon') == build_cache_key(b, auth_tier='anon')


def test_canonical_query_string_includes_filters() -> None:
    a = QuerySpec(q='kpop', category_id=3)
    b = QuerySpec(q='kpop', category_id=5)
    assert canonical_query_string(a) != canonical_query_string(b)


def test_canonical_query_string_cursor_excluded() -> None:
    """Cursor NÃO entra na canonical — páginas 1/2/3 da mesma query devem
    invalidar/atualizar a mesma família. Mas como o cache hit é por página,
    o cursor entra na cache key separadamente (build_cache_key)."""
    a = QuerySpec(q='kpop', cursor=None)
    b = QuerySpec(q='kpop', cursor='abc.def')
    assert canonical_query_string(a) == canonical_query_string(b)


# ── build_cache_key — H-04 (auth_tier separation) ────────────────────────────


def test_cache_key_prefix() -> None:
    """Key deve começar com ``search:v1:`` para casar com delete_pattern do
    signal de invalidação."""
    key = build_cache_key(QuerySpec(q='kpop'), auth_tier='anon')
    assert key.startswith('search:v1:')


def test_cache_key_includes_auth_tier_explicitly() -> None:
    """H-04 — anon vs user produzem KEYS DIFERENTES para a mesma query.

    Sem isso, cache de anônimo pode servir autenticado (vazamento de
    metadata de tier). É o coração do achado.
    """
    spec = QuerySpec(q='kpop')
    anon = build_cache_key(spec, auth_tier='anon')
    user = build_cache_key(spec, auth_tier='user')
    assert anon != user
    assert ':anon:' in anon
    assert ':user:' in user


def test_cache_key_rejects_unknown_tier() -> None:
    """Defesa: tier desconhecido (typo) levanta erro em vez de cair em
    string vazia silenciosa (que viraria 1 cache pool comum)."""
    import pytest
    with pytest.raises(ValueError):
        build_cache_key(QuerySpec(q='kpop'), auth_tier='admin')  # type: ignore[arg-type]


def test_cache_key_includes_cursor_for_pagination() -> None:
    """Página 1 e página 2 da mesma query → cache keys distintas."""
    spec1 = QuerySpec(q='kpop', cursor=None)
    spec2 = QuerySpec(q='kpop', cursor='abc.def')
    k1 = build_cache_key(spec1, auth_tier='anon')
    k2 = build_cache_key(spec2, auth_tier='anon')
    assert k1 != k2


def test_cache_key_is_sha256_64_hex() -> None:
    """Key payload é SHA256 truncado para 64 hex (sem '/' problemático
    em Redis pattern delete)."""
    key = build_cache_key(QuerySpec(q='kpop'), auth_tier='anon')
    # search:v1:<tier>:<sha256_hex>
    _, _, tier, digest = key.split(':')
    assert tier in ('anon', 'user')
    # SHA256 = 64 hex chars
    assert len(digest) == 64
    assert all(c in '0123456789abcdef' for c in digest)


def test_cache_key_includes_per_page() -> None:
    """per_page=20 vs per_page=30 → keys distintas (paginação diferente,
    response shape diferente)."""
    a = build_cache_key(QuerySpec(q='kpop', per_page=20), auth_tier='anon')
    b = build_cache_key(QuerySpec(q='kpop', per_page=30), auth_tier='anon')
    assert a != b


def test_cache_key_includes_date_filters() -> None:
    de = datetime(2026, 1, 1, tzinfo=timezone.utc)
    a = build_cache_key(QuerySpec(q='kpop'), auth_tier='anon')
    b = build_cache_key(QuerySpec(q='kpop', de=de), auth_tier='anon')
    assert a != b
