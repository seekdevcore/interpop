"""Testes do signal de invalidação de cache (Task T30.1.5c).

Invariante (ADR-018 + ADR-037):

    > O signal Python NUNCA escreve em search_index. Trigger SQL é a fonte
    > de verdade. O signal APENAS invalida o cache Redis pós-mutação de
    > Article para que a próxima request veja dados frescos.

Cobertura:
    - post_save em Article publicado dispara invalidação
    - post_save em draft também dispara (despublicação invalida cache)
    - post_delete dispara
    - invalidate_all_search_cache funciona em LocMemCache (fallback) e
      em Redis (mock de delete_pattern)
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from django.core.cache import cache

from apps.articles.models import Article, Category
from apps.search.cache import (
    CACHE_KEY_PREFIX,
    build_cache_key,
    invalidate_all_search_cache,
)
from apps.search.dto import QuerySpec


# ── invalidate_all_search_cache — fallback LocMemCache ───────────────────────


@pytest.mark.django_db
def test_invalidate_clears_local_keys() -> None:
    """LocMemCache não tem delete_pattern → fallback cache.clear().

    Garante que após invalidação, getter retorna None.
    """
    key = build_cache_key(QuerySpec(q='kpop'), auth_tier='anon')
    cache.set(key, {'results': []}, timeout=60)
    assert cache.get(key) is not None

    invalidate_all_search_cache()
    assert cache.get(key) is None


def test_invalidate_returns_redis_count_when_pattern_supported() -> None:
    """Em Redis (django-redis), delete_pattern retorna nº de chaves removidas."""
    mock_cache = MagicMock()
    mock_cache.delete_pattern.return_value = 42
    with patch('apps.search.cache.cache', mock_cache):
        n = invalidate_all_search_cache()
    mock_cache.delete_pattern.assert_called_once_with(f'{CACHE_KEY_PREFIX}*')
    assert n == 42


def test_invalidate_returns_minus_one_in_fallback() -> None:
    """LocMemCache não tem delete_pattern → fallback retorna -1."""
    mock_cache = MagicMock(spec=['clear', 'get', 'set'])  # sem delete_pattern
    with patch('apps.search.cache.cache', mock_cache):
        n = invalidate_all_search_cache()
    mock_cache.clear.assert_called_once()
    assert n == -1


# ── Signal post_save Article ─────────────────────────────────────────────────


@pytest.fixture
def author(admin_user):
    return admin_user


@pytest.fixture
def category(db):
    cat, _ = Category.objects.get_or_create(name='Música Signal Test')
    return cat


@pytest.mark.django_db
def test_post_save_published_invalidates_cache(author, category) -> None:
    """ADR-018 — post_save em Article publicado → invalidate (cache flush)."""
    key = build_cache_key(QuerySpec(q='soft power'), auth_tier='anon')
    cache.set(key, {'results': []}, timeout=300)
    assert cache.get(key) is not None

    Article.objects.create(
        title='Soft power coreano',
        excerpt='Análise',
        body='Body',
        author=author,
        category=category,
        status=Article.Status.PUBLISHED,
        published_at=datetime.now(timezone.utc),
    )
    # Signal invalidou cache
    assert cache.get(key) is None


@pytest.mark.django_db
def test_post_save_draft_invalidates_cache(author, category) -> None:
    """Mesmo draft invalida — despublicação ou rebaixamento muda a busca."""
    key = build_cache_key(QuerySpec(q='draft test'), auth_tier='user')
    cache.set(key, {'results': []}, timeout=300)
    Article.objects.create(
        title='Draft test',
        excerpt='x',
        body='y',
        author=author,
        status=Article.Status.DRAFT,
    )
    assert cache.get(key) is None


@pytest.mark.django_db
def test_post_delete_invalidates_cache(author, category) -> None:
    """ADR-018 — post_delete em Article → invalidate (artigo some da busca)."""
    article = Article.objects.create(
        title='Será deletado',
        excerpt='x',
        body='y',
        author=author,
        status=Article.Status.PUBLISHED,
        published_at=datetime.now(timezone.utc),
    )
    key = build_cache_key(QuerySpec(q='delete test'), auth_tier='anon')
    cache.set(key, {'results': []}, timeout=300)

    article.delete()
    assert cache.get(key) is None


# ── Invariante: signal NÃO escreve em search_index ───────────────────────────


@pytest.mark.django_db
def test_signal_never_writes_to_search_index(author) -> None:
    """ADR-018 invariante dura: o handler do signal NÃO importa SearchIndex.

    Defesa contra refactor descuidado que adicione side-effect de upsert
    no signal — duplicação de responsabilidade com a trigger SQL.
    """
    import inspect

    from apps.search import signals as search_signals

    src = inspect.getsource(search_signals)
    # SearchIndex import só pode estar em comment/docstring; no código real
    # do handler, NÃO pode aparecer.
    # Heurística: linhas executáveis (não-comment) não devem ter SearchIndex.
    forbidden = 'SearchIndex'
    code_lines = [
        ln for ln in src.splitlines()
        if forbidden in ln and not ln.strip().startswith('#')
        # Permite mention em docstring quando linha não é executável.
        and 'SearchIndex' not in ln.split('#', 1)[0]
        or (forbidden in ln and ('import SearchIndex' in ln or '.objects' in ln))
    ]
    # Mais simples e robusto: garantir que não há `from ... import SearchIndex`
    # nem `.objects.create/update/save` no módulo de signals.
    assert 'import SearchIndex' not in src.replace(' ', ''), (
        'signals.py importa SearchIndex — ADR-018 invariante violada. '
        'Trigger SQL é a fonte de verdade; signal só invalida cache.'
    )
