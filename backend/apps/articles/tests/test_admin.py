"""Tests do ArticleAdmin (apps/articles/admin.py).

Fix OPS-1 (CONCERNS / F-10 CA): ao publicar um Article via Django admin,
`published_at` ficava `None` quando o editor não preenchia manualmente o
campo (ele é `null=True, blank=True`). Consequência:
- ordering `-published_at` jogava artigos para o fim da lista
- `published_at|date` no template renderizava string vazia
- ranking de busca (SearchView) caía no fallback `-created_at`

A correção é setar `published_at = timezone.now()` em `save_model` quando
o status é `PUBLISHED` E o campo ainda está vazio. NÃO sobrescreve valor
existente (ex.: editor agendou ou está re-editando artigo já publicado).
"""
from __future__ import annotations

import pytest
from django.contrib.admin.sites import AdminSite
from django.contrib.messages.storage.fallback import FallbackStorage
from django.test import RequestFactory
from django.utils import timezone

from apps.articles.admin import ArticleAdmin
from apps.articles.models import Article, Category


@pytest.fixture
def category(db):
    obj, _ = Category.objects.get_or_create(
        slug='test-admin', defaults={'name': 'Test Admin'},
    )
    return obj


@pytest.fixture
def editor(db):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    return User.objects.create_user(
        username='editor.admin',
        email='editor@admin.test',
        password='S3nh@Forte!2026',
        role='editor',
    )


def _admin_request(user):
    factory = RequestFactory()
    request = factory.post('/admin/articles/article/add/')
    request.user = user
    request.session = {}
    request._messages = FallbackStorage(request)
    return request


def _make_article_admin(category, editor, **fields):
    """Cria Article sem salvar (admin.save_model fará isso)."""
    defaults = dict(
        title='Test article',
        slug='test-article-ops1',
        excerpt='Excerpt',
        body='Body',
        author=editor,
        category=category,
        status=Article.Status.DRAFT,
    )
    defaults.update(fields)
    return Article(**defaults)


def test_save_model_sets_published_at_when_transitioning_to_published(
    category, editor,
):
    """Status=PUBLISHED + published_at=None → admin seta now() automaticamente."""
    admin = ArticleAdmin(Article, AdminSite())
    article = _make_article_admin(
        category, editor, status=Article.Status.PUBLISHED, published_at=None,
    )

    before = timezone.now()
    admin.save_model(_admin_request(editor), article, form=None, change=False)
    after = timezone.now()

    article.refresh_from_db()
    assert article.published_at is not None, 'published_at deveria estar setado'
    assert before <= article.published_at <= after, (
        f'published_at fora da janela do save_model: {article.published_at}'
    )


def test_save_model_keeps_draft_published_at_null(category, editor):
    """Status=DRAFT NÃO seta published_at — só publica timestamp ao publicar."""
    admin = ArticleAdmin(Article, AdminSite())
    article = _make_article_admin(
        category, editor, status=Article.Status.DRAFT, published_at=None,
    )

    admin.save_model(_admin_request(editor), article, form=None, change=False)

    article.refresh_from_db()
    assert article.published_at is None, (
        f'DRAFT não deve ter published_at: {article.published_at}'
    )


def test_save_model_preserves_existing_published_at(category, editor):
    """Se editor já definiu published_at (ex.: agendou ou está editando
    artigo antigo), NÃO sobrescrever — respeita decisão do editor."""
    admin = ArticleAdmin(Article, AdminSite())
    scheduled = timezone.now() - timezone.timedelta(days=7)
    article = _make_article_admin(
        category, editor,
        status=Article.Status.PUBLISHED,
        published_at=scheduled,
    )

    admin.save_model(_admin_request(editor), article, form=None, change=False)

    article.refresh_from_db()
    # Mesmo timestamp (microssegundos podem perder precisão no DB, mas data
    # idêntica é o que importa).
    assert article.published_at is not None
    assert abs((article.published_at - scheduled).total_seconds()) < 1, (
        f'published_at deveria permanecer {scheduled}, virou {article.published_at}'
    )
