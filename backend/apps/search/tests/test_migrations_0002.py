"""Testes da migration ``0002_search_indexes`` (Task T30.1.3 + ADR-030-DB).

Todos os testes aqui são ``requires_postgres`` — SQLite não tem GIN nem
partial/covering indexes nos moldes Postgres.

Verifica a presença dos 4 índices listados em ADR-030-DB.
"""
from __future__ import annotations

import pytest
from django.db import connection


@pytest.mark.requires_postgres
@pytest.mark.django_db
def test_gin_index_on_search_vector_exists() -> None:
    """ADR-030-DB §"Indexes finais" — idx_search_vector_gin."""
    if connection.vendor != 'postgresql':
        pytest.skip('Postgres-only')
    with connection.cursor() as cur:
        cur.execute(
            "SELECT indexdef FROM pg_indexes "
            "WHERE schemaname = 'public' AND indexname = 'idx_search_vector_gin';"
        )
        row = cur.fetchone()
        assert row is not None, 'GIN index idx_search_vector_gin não criado.'
        assert 'USING gin' in row[0].lower(), (
            f'Index não é GIN: {row[0]!r}'
        )
        assert 'search_vector' in row[0], (
            f'Index não cobre search_vector: {row[0]!r}'
        )


@pytest.mark.requires_postgres
@pytest.mark.django_db
def test_partial_category_index_exists() -> None:
    """ADR-030-DB §"Por que parcial em category_id" — WHERE NOT NULL."""
    if connection.vendor != 'postgresql':
        pytest.skip('Postgres-only')
    with connection.cursor() as cur:
        cur.execute(
            "SELECT indexdef FROM pg_indexes "
            "WHERE schemaname = 'public' "
            "AND indexname = 'idx_search_category_published';"
        )
        row = cur.fetchone()
        assert row is not None
        definition = row[0].lower()
        assert 'where' in definition, (
            f'Index não é parcial (sem WHERE): {row[0]!r}'
        )
        assert 'category_id is not null' in definition, (
            f'Index parcial sem cláusula NOT NULL esperada: {row[0]!r}'
        )


@pytest.mark.requires_postgres
@pytest.mark.django_db
def test_covering_author_index_exists() -> None:
    """ADR-030-DB §"Por que covering em author_id" — INCLUDE (article_id)."""
    if connection.vendor != 'postgresql':
        pytest.skip('Postgres-only')
    with connection.cursor() as cur:
        cur.execute(
            "SELECT indexdef FROM pg_indexes "
            "WHERE schemaname = 'public' "
            "AND indexname = 'idx_search_author_pub_covering';"
        )
        row = cur.fetchone()
        assert row is not None
        definition = row[0].lower()
        assert 'include' in definition, (
            f'Index não é covering (sem INCLUDE): {row[0]!r}'
        )
        assert 'article_id' in definition


@pytest.mark.requires_postgres
@pytest.mark.django_db
def test_published_at_btree_index_exists() -> None:
    """idx_search_published_only — BTree para ordenação por recência."""
    if connection.vendor != 'postgresql':
        pytest.skip('Postgres-only')
    with connection.cursor() as cur:
        cur.execute(
            "SELECT indexdef FROM pg_indexes "
            "WHERE schemaname = 'public' "
            "AND indexname = 'idx_search_published_only';"
        )
        assert cur.fetchone() is not None


@pytest.mark.requires_postgres
@pytest.mark.django_db
def test_all_four_indexes_present_on_search_index() -> None:
    """Smoke: ADR-030-DB lista 4 índices; nenhum deles está faltando."""
    if connection.vendor != 'postgresql':
        pytest.skip('Postgres-only')
    expected = {
        'idx_search_vector_gin',
        'idx_search_category_published',
        'idx_search_author_pub_covering',
        'idx_search_published_only',
    }
    with connection.cursor() as cur:
        cur.execute(
            "SELECT indexname FROM pg_indexes "
            "WHERE schemaname = 'public' AND tablename = 'search_index';"
        )
        actual = {row[0] for row in cur.fetchall()}
    missing = expected - actual
    assert not missing, (
        f'Índices ADR-030-DB faltando: {missing}. Encontrados: {actual}'
    )


@pytest.mark.django_db
def test_migration_0002_runs_in_sqlite_dev_as_noop() -> None:
    """ADR-020 — em SQLite, migration 0002 deve ser no-op (não trava)."""
    if connection.vendor == 'postgresql':
        pytest.skip('Esta asserção valida fallback SQLite.')
    # Se chegamos aqui é porque migrate já rodou (db.sqlite3 existe) e a
    # migration foi aplicada como no-op. Confirmar via django_migrations.
    with connection.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM django_migrations "
            "WHERE app = 'search' AND name = '0002_search_indexes';"
        )
        assert cur.fetchone() is not None, (
            'Migration 0002 não foi aplicada em SQLite (deveria ser no-op '
            'silencioso, não skip).'
        )
