"""Testes da migration ``0003_search_triggers`` (Task T30.1.5b; ADR-018).

Cenários cobertos (tabela de ADR-018 §"Tests obrigatórios"):

    1. INSERT publicado → 1 linha em search_index com tsvector populado.
    2. UPDATE title em PUBLISHED → tsvector reflete novo título.
    3. UPDATE status='draft' (bulk_update) → search_index vazio.
    4. Raw SQL UPDATE status='draft' → search_index vazio.
    5. DELETE Article → search_index vazio.

Todos os cenários são Postgres-only (trigger PL/pgSQL não roda em SQLite).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
from django.db import connection

from apps.articles.models import Article, Category


# ── Helpers ────────────────────────────────────────────────────────────────────


def _count_search_index(article_id: uuid.UUID) -> int:
    with connection.cursor() as cur:
        cur.execute(
            'SELECT COUNT(*) FROM search_index WHERE article_id = %s;',
            [str(article_id)],
        )
        return cur.fetchone()[0]


def _get_search_vector_text(article_id: uuid.UUID) -> str | None:
    with connection.cursor() as cur:
        cur.execute(
            'SELECT search_vector::text FROM search_index WHERE article_id = %s;',
            [str(article_id)],
        )
        row = cur.fetchone()
        return row[0] if row else None


@pytest.fixture
def author(admin_user):
    """Usa fixture global admin_user (apps/users/conftest.py) como autor."""
    return admin_user


@pytest.fixture
def category(db):
    # get_or_create porque migration 0003 do app articles já popula categorias
    # (Música, Cinema, Moda, Literatura, Cultura Digital).
    cat, _ = Category.objects.get_or_create(name='Música Teste FTS')
    return cat


# ── Cenários ADR-018 ───────────────────────────────────────────────────────────


@pytest.mark.requires_postgres
@pytest.mark.django_db
def test_publish_article_inserts_into_search_index(author, category) -> None:
    """ADR-018 — INSERT publicado deve criar 1 linha em search_index."""
    if connection.vendor != 'postgresql':
        pytest.skip('Postgres-only — trigger PL/pgSQL')
    article = Article.objects.create(
        title='K-Pop e a geopolítica do som',
        excerpt='Como BTS reescreveu o soft power coreano.',
        body='Em 2012, o vídeo de Gangnam Style ultrapassou 1 bilhão de views...',
        author=author,
        category=category,
        status=Article.Status.PUBLISHED,
        published_at=datetime.now(timezone.utc),
    )
    assert _count_search_index(article.id) == 1, (
        'Trigger não criou linha em search_index após publicação.'
    )
    vec = _get_search_vector_text(article.id)
    assert vec is not None and len(vec) > 0, (
        'search_vector está vazio — setweight não aplicou.'
    )


@pytest.mark.requires_postgres
@pytest.mark.django_db
def test_update_title_in_published_refreshes_vector(author, category) -> None:
    """ADR-018 — UPDATE title em PUBLISHED deve atualizar tsvector."""
    if connection.vendor != 'postgresql':
        pytest.skip('Postgres-only')
    article = Article.objects.create(
        title='Título original',
        excerpt='Excerpt',
        body='Body',
        author=author,
        category=category,
        status=Article.Status.PUBLISHED,
        published_at=datetime.now(timezone.utc),
    )
    vec_before = _get_search_vector_text(article.id)
    article.title = 'Título completamente diferente sobre Beyoncé'
    article.save()
    vec_after = _get_search_vector_text(article.id)
    assert vec_before != vec_after, (
        'tsvector não mudou após UPDATE title — trigger UPDATE não disparou.'
    )
    # 'beyonce' (sem acento via pt_unaccent) deve estar no vetor após o UPDATE.
    assert 'beyonc' in vec_after.lower(), (
        f'Lexema "beyonc" ausente no novo vetor: {vec_after}'
    )


@pytest.mark.requires_postgres
@pytest.mark.django_db
def test_bulk_update_status_to_draft_removes_from_index(author, category) -> None:
    """ADR-018 — bulk_update / QuerySet.update() devem disparar trigger.

    Esse é o cenário que signal Python NÃO cobre (Bug 3 do specialist DB).
    """
    if connection.vendor != 'postgresql':
        pytest.skip('Postgres-only')
    article = Article.objects.create(
        title='Para despublicar',
        excerpt='X',
        body='Y',
        author=author,
        category=category,
        status=Article.Status.PUBLISHED,
        published_at=datetime.now(timezone.utc),
    )
    assert _count_search_index(article.id) == 1
    # QuerySet.update() — NÃO dispara signal Django, mas DEVE disparar trigger.
    Article.objects.filter(pk=article.pk).update(status=Article.Status.DRAFT)
    assert _count_search_index(article.id) == 0, (
        'search_index ainda tem linha após bulk update para draft — trigger '
        'NÃO cobriu o caso. Bug 3 reintroduzido.'
    )


@pytest.mark.requires_postgres
@pytest.mark.django_db
def test_raw_sql_update_status_removes_from_index(author, category) -> None:
    """ADR-018 — UPDATE direto via raw SQL deve disparar trigger."""
    if connection.vendor != 'postgresql':
        pytest.skip('Postgres-only')
    article = Article.objects.create(
        title='Raw SQL test',
        excerpt='X',
        body='Y',
        author=author,
        category=category,
        status=Article.Status.PUBLISHED,
        published_at=datetime.now(timezone.utc),
    )
    assert _count_search_index(article.id) == 1
    with connection.cursor() as cur:
        cur.execute(
            "UPDATE articles SET status = 'draft' WHERE id = %s;",
            [str(article.id)],
        )
    assert _count_search_index(article.id) == 0, (
        'search_index ainda tem linha após raw SQL — trigger é a única defesa '
        'aqui, e falhou.'
    )


@pytest.mark.requires_postgres
@pytest.mark.django_db
def test_delete_article_removes_from_index(author, category) -> None:
    """ADR-018 — DELETE Article deve remover de search_index."""
    if connection.vendor != 'postgresql':
        pytest.skip('Postgres-only')
    article = Article.objects.create(
        title='Para deletar',
        excerpt='X',
        body='Y',
        author=author,
        category=category,
        status=Article.Status.PUBLISHED,
        published_at=datetime.now(timezone.utc),
    )
    article_id = article.id
    assert _count_search_index(article_id) == 1
    article.delete()
    assert _count_search_index(article_id) == 0, (
        'search_index ainda tem linha após DELETE Article — trigger '
        'remove_search não disparou.'
    )


# ── Smoke cross-backend ────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_migration_0003_applied_in_any_backend() -> None:
    """ADR-020 — migration 0003 deve estar marcada como aplicada (no-op em SQLite)."""
    with connection.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM django_migrations "
            "WHERE app = 'search' AND name = '0003_search_triggers';"
        )
        assert cur.fetchone() is not None
