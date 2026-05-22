"""
Fixtures locais para tests de apps/comments/.

Por que conftest.py local em vez de promover para backend/conftest.py:
make_article + category são fixtures de domínio articles/. Promover globalmente
acopla comments/newsletter ao schema de articles desnecessariamente. Cada app
que precisa de um Article cria seu próprio em scope local.
"""
from __future__ import annotations

import pytest

from apps.articles.models import Article, Category


@pytest.fixture
def category(db):
    obj, _ = Category.objects.get_or_create(
        slug='test-comments', defaults={'name': 'Test Comments'},
    )
    return obj


@pytest.fixture
def make_article(db, category):
    def _make(author, status=Article.Status.PUBLISHED, title='Comments Test Article', **kw):
        return Article.objects.create(
            author=author,
            category=category,
            title=title,
            slug=kw.pop('slug', None) or f"{title.lower().replace(' ', '-')}-{author.pk.hex[:6]}",
            excerpt=kw.pop('excerpt', 'Excerpt for comment tests.'),
            body=kw.pop('body', 'Body content suficiente para o serializer aceitar.'),
            status=status,
            **kw,
        )
    return _make


@pytest.fixture
def article(make_article, editor_user):
    """Default article: published, editor as author."""
    return make_article(editor_user, status=Article.Status.PUBLISHED, title='Default Comment Article')
