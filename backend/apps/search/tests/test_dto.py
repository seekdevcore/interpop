"""Testes dos DTOs imutáveis de ``apps.search.dto``.

DTOs ``frozen=True`` reforçam a invariante #1 (determinismo): se a spec
não pode mudar depois de construída, o caller não consegue mutar input
e obter saída diferente "silenciosamente" — comportamento previsível
em testes property-based.
"""
from __future__ import annotations

import uuid
from dataclasses import FrozenInstanceError
from datetime import datetime, timezone

import pytest

from apps.search.dto import (
    CursorPayload,
    QuerySpec,
    ResultItem,
    SearchResultPage,
)


# ── QuerySpec ────────────────────────────────────────────────────────────────


def test_query_spec_minimum_required() -> None:
    spec = QuerySpec(q='kpop')
    assert spec.q == 'kpop'
    assert spec.author_id is None
    assert spec.category_id is None
    assert spec.cursor is None


def test_query_spec_full() -> None:
    aid = uuid.uuid4()
    de = datetime(2025, 1, 1, tzinfo=timezone.utc)
    spec = QuerySpec(
        q='soft power',
        author_id=aid,
        category_id=3,
        de=de,
        ate=None,
        cursor='abc.def',
        per_page=30,
    )
    assert spec.author_id == aid
    assert spec.category_id == 3
    assert spec.de == de
    assert spec.per_page == 30


def test_query_spec_is_frozen() -> None:
    """Imutabilidade — proteção contra mutação out-of-band."""
    spec = QuerySpec(q='kpop')
    with pytest.raises(FrozenInstanceError):
        spec.q = 'mudei'  # type: ignore[misc]


def test_query_spec_equality_value_based() -> None:
    """Dois specs com mesmos campos são iguais (=cache key estável)."""
    a = QuerySpec(q='kpop', per_page=20)
    b = QuerySpec(q='kpop', per_page=20)
    assert a == b
    assert hash(a) == hash(b)


# ── CursorPayload ────────────────────────────────────────────────────────────


def test_cursor_payload_round_trip_immutable() -> None:
    pub = datetime(2026, 5, 1, 12, 0, tzinfo=timezone.utc)
    aid = uuid.uuid4()
    cur = CursorPayload(score=0.123456, published_at=pub, article_id=aid, depth=1)
    assert cur.score == 0.123456
    assert cur.published_at == pub
    assert cur.article_id == aid
    assert cur.depth == 1


def test_cursor_payload_frozen() -> None:
    cur = CursorPayload(
        score=0.5,
        published_at=datetime.now(timezone.utc),
        article_id=uuid.uuid4(),
        depth=0,
    )
    with pytest.raises(FrozenInstanceError):
        cur.score = 0.9  # type: ignore[misc]


# ── ResultItem ───────────────────────────────────────────────────────────────


def test_result_item_minimum() -> None:
    pub = datetime(2026, 5, 1, tzinfo=timezone.utc)
    aid = uuid.uuid4()
    item = ResultItem(
        article_id=aid,
        title='Como o K-Pop reinventou o soft power',
        slug='como-o-k-pop-reinventou-o-soft-power',
        excerpt='Resumo curto',
        published_at=pub,
        author={'id': str(uuid.uuid4()), 'display_name': 'João', 'slug': 'joao'},
        category={'id': 3, 'name': 'Música', 'slug': 'musica'},
        cover_url=None,
        score=0.473128,
    )
    assert item.title.startswith('Como')


# ── SearchResultPage ─────────────────────────────────────────────────────────


def test_search_result_page_empty() -> None:
    page = SearchResultPage(
        results=(),
        next_cursor=None,
        total_estimate=0,
        query_terms_expanded=(),
        took_ms=12,
    )
    assert page.results == ()
    assert page.next_cursor is None
    assert page.total_estimate == 0


def test_search_result_page_tuple_not_list() -> None:
    """results e query_terms_expanded são tuples (imutáveis) — defesa contra
    mutação de output após retornar."""
    page = SearchResultPage(
        results=(),
        next_cursor=None,
        total_estimate=0,
        query_terms_expanded=('cantor', 'brasil'),
        took_ms=8,
    )
    assert isinstance(page.results, tuple)
    assert isinstance(page.query_terms_expanded, tuple)
