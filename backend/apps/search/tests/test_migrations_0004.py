"""Testes da migration ``0004_search_vacuum_tuning`` (Task T30.1.X1; ADR-034).

Verifica que os storage params customizados foram aplicados ao índice GIN e à
tabela search_index. Todos os testes Postgres-only (SQLite não tem autovacuum
nem gin_pending_list_limit).
"""
from __future__ import annotations

import pytest
from django.db import connection


def _get_reloptions(rel_name: str) -> dict[str, str]:
    """Lê pg_class.reloptions de uma tabela/índice como dict."""
    with connection.cursor() as cur:
        cur.execute(
            "SELECT reloptions FROM pg_class WHERE relname = %s;",
            [rel_name],
        )
        row = cur.fetchone()
        if row is None or row[0] is None:
            return {}
        options = {}
        for entry in row[0]:
            key, _, val = entry.partition('=')
            options[key] = val
        return options


@pytest.mark.requires_postgres
@pytest.mark.django_db
def test_gin_index_has_fastupdate_on() -> None:
    """ADR-034 — idx_search_vector_gin.fastupdate = on."""
    if connection.vendor != 'postgresql':
        pytest.skip('Postgres-only')
    opts = _get_reloptions('idx_search_vector_gin')
    assert opts.get('fastupdate') == 'on', (
        f'fastupdate não está on em idx_search_vector_gin. Reloptions: {opts}'
    )


@pytest.mark.requires_postgres
@pytest.mark.django_db
def test_gin_index_has_pending_list_limit_2mb() -> None:
    """ADR-034 — idx_search_vector_gin.gin_pending_list_limit = 2048 (2MB em KB)."""
    if connection.vendor != 'postgresql':
        pytest.skip('Postgres-only')
    opts = _get_reloptions('idx_search_vector_gin')
    assert opts.get('gin_pending_list_limit') == '2048', (
        f'gin_pending_list_limit esperado 2048 (2MB), atual: {opts}'
    )


@pytest.mark.requires_postgres
@pytest.mark.django_db
def test_search_index_table_autovacuum_aggressive() -> None:
    """ADR-034 — autovacuum scale_factor 0.05 / analyze 0.02 / cost_delay 10ms."""
    if connection.vendor != 'postgresql':
        pytest.skip('Postgres-only')
    opts = _get_reloptions('search_index')
    assert opts.get('autovacuum_vacuum_scale_factor') == '0.05', (
        f'autovacuum_vacuum_scale_factor esperado 0.05, atual: {opts}'
    )
    assert opts.get('autovacuum_analyze_scale_factor') == '0.02', (
        f'autovacuum_analyze_scale_factor esperado 0.02, atual: {opts}'
    )
    assert opts.get('autovacuum_vacuum_cost_delay') == '10', (
        f'autovacuum_vacuum_cost_delay esperado 10ms, atual: {opts}'
    )


@pytest.mark.django_db
def test_migration_0004_applied() -> None:
    """ADR-020 — migration 0004 marcada como aplicada (no-op em SQLite)."""
    with connection.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM django_migrations "
            "WHERE app = 'search' AND name = '0004_search_vacuum_tuning';"
        )
        assert cur.fetchone() is not None
