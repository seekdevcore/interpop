"""Testes de schema da migration ``0001_initial`` do app ``apps.search``.

Estratégia (ADR-020):
    - Asserções "tabela existe" rodam em qualquer backend (Postgres + SQLite).
    - Asserções FTS-específicas (extension, configuration, função IMMUTABLE,
      tsvector real) são marcadas com ``@pytest.mark.requires_postgres`` e
      ficam skip-se-não-Postgres.

Refs: DESIGN.md §2.2; ADR-019; _specialist-outputs/01-database-architect.md §1.
"""
from __future__ import annotations

import pytest
from django.db import connection


# ── Asserções cross-backend ────────────────────────────────────────────────────


@pytest.mark.django_db
def test_search_index_table_exists() -> None:
    """T30.1.4b — após migrate, tabela ``search_index`` deve existir."""
    table_names = connection.introspection.table_names()
    assert 'search_index' in table_names, (
        f'Tabela search_index não foi criada pela migration 0001. '
        f'Tabelas presentes: {sorted(table_names)}'
    )


@pytest.mark.django_db
def test_search_log_table_exists() -> None:
    """T30.1.4b — após migrate, tabela ``search_log`` deve existir."""
    table_names = connection.introspection.table_names()
    assert 'search_log' in table_names


@pytest.mark.django_db
def test_search_index_columns_present() -> None:
    """T30.1.4b — colunas chave da projeção devem existir.

    Em SQLite, os tipos podem diferir (CHAR(32) vs UUID), mas os nomes das
    colunas são idênticos por contrato.
    """
    cols = {col.name for col in connection.introspection.get_table_description(
        connection.cursor(), 'search_index'
    )}
    expected = {
        'article_id', 'search_vector', 'title_text', 'excerpt_text',
        'body_text', 'author_id', 'category_id', 'published_at', 'indexed_at',
    }
    missing = expected - cols
    assert not missing, f'Colunas ausentes em search_index: {missing}'


@pytest.mark.django_db
def test_search_log_columns_present() -> None:
    """T30.1.4b — search_log tem campos para analytics + retenção LGPD."""
    cols = {col.name for col in connection.introspection.get_table_description(
        connection.cursor(), 'search_log'
    )}
    expected = {
        'id', 'query_text', 'query_norm', 'filters_json', 'results_count',
        'total_estimate', 'duration_ms', 'cache_hit', 'user_id', 'created_at',
    }
    missing = expected - cols
    assert not missing, f'Colunas ausentes em search_log: {missing}'


# ── Asserções Postgres-only (FTS pt-BR real) ───────────────────────────────────


@pytest.mark.requires_postgres
@pytest.mark.django_db
def test_unaccent_extension_installed() -> None:
    """ADR-019 — extension ``unaccent`` deve estar instalada em Postgres."""
    if connection.vendor != 'postgresql':
        pytest.skip('Postgres-only')
    with connection.cursor() as cur:
        cur.execute("SELECT 1 FROM pg_extension WHERE extname = 'unaccent';")
        assert cur.fetchone() is not None, (
            'Extension unaccent não foi criada. Verifique permissão SUPERUSER '
            'na primeira execução (TX-13).'
        )


@pytest.mark.requires_postgres
@pytest.mark.django_db
def test_pt_unaccent_configuration_exists() -> None:
    """ADR-019 — CONFIGURATION ``public.pt_unaccent`` deve existir."""
    if connection.vendor != 'postgresql':
        pytest.skip('Postgres-only')
    with connection.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM pg_ts_config WHERE cfgname = 'pt_unaccent' "
            "AND cfgnamespace = 'public'::regnamespace;"
        )
        assert cur.fetchone() is not None, (
            'CONFIGURATION pt_unaccent não criada. ADR-019 §Implementação.'
        )


@pytest.mark.requires_postgres
@pytest.mark.django_db
def test_articles_search_config_is_immutable() -> None:
    """Bug 2 do specialist DB — provolatile deve ser 'i' (IMMUTABLE).

    Postgres recusa criar índice expressão sobre função STABLE/VOLATILE. Se este
    test falhar, o GIN da migration 0002 vai falhar com 'functions in index
    expression must be marked IMMUTABLE'.
    """
    if connection.vendor != 'postgresql':
        pytest.skip('Postgres-only')
    with connection.cursor() as cur:
        cur.execute(
            "SELECT provolatile FROM pg_proc "
            "WHERE proname = 'articles_search_config' "
            "AND pronamespace = 'public'::regnamespace;"
        )
        row = cur.fetchone()
        assert row is not None, 'Função articles_search_config não criada.'
        assert row[0] == 'i', (
            f"articles_search_config tem provolatile='{row[0]}' "
            f"(esperado 'i' = IMMUTABLE). GIN vai falhar. ADR-019."
        )


@pytest.mark.requires_postgres
@pytest.mark.django_db
def test_pt_unaccent_normalizes_accents() -> None:
    """ADR-019 — 'Beyoncé' deve gerar mesmo lexema que 'beyonce'."""
    if connection.vendor != 'postgresql':
        pytest.skip('Postgres-only')
    with connection.cursor() as cur:
        cur.execute("SELECT to_tsvector('public.pt_unaccent', %s)::text;", ['Beyoncé'])
        with_accent = cur.fetchone()[0]
        cur.execute("SELECT to_tsvector('public.pt_unaccent', %s)::text;", ['beyonce'])
        without_accent = cur.fetchone()[0]
        assert with_accent == without_accent, (
            f'pt_unaccent não normalizou: "{with_accent}" != "{without_accent}". '
            f'Mapping unaccent + portuguese_stem está errado em ADR-019.'
        )


@pytest.mark.requires_postgres
@pytest.mark.django_db
def test_pt_unaccent_stems_portuguese() -> None:
    """ADR-019 — 'cantores' deve casar com lexema 'cantor' (portuguese_stem)."""
    if connection.vendor != 'postgresql':
        pytest.skip('Postgres-only')
    with connection.cursor() as cur:
        cur.execute(
            "SELECT to_tsvector('public.pt_unaccent', %s) @@ "
            "plainto_tsquery('public.pt_unaccent', %s);",
            ['os cantores brasileiros', 'cantor'],
        )
        assert cur.fetchone()[0] is True, (
            'portuguese_stem não está ativo: "cantores" deveria casar com "cantor".'
        )


@pytest.mark.requires_postgres
@pytest.mark.django_db
def test_search_vector_column_is_tsvector() -> None:
    """search_vector deve ser tsvector real em Postgres (não TEXT)."""
    if connection.vendor != 'postgresql':
        pytest.skip('Postgres-only')
    with connection.cursor() as cur:
        cur.execute(
            "SELECT data_type FROM information_schema.columns "
            "WHERE table_name = 'search_index' AND column_name = 'search_vector';"
        )
        row = cur.fetchone()
        assert row is not None and row[0] == 'tsvector', (
            f'search_vector deveria ser tsvector, é {row}'
        )


@pytest.mark.requires_postgres
@pytest.mark.django_db
def test_search_index_author_id_is_uuid_in_db() -> None:
    """Bug 1 do specialist DB — author_id deve ser UUID, não BIGINT, no DB."""
    if connection.vendor != 'postgresql':
        pytest.skip('Postgres-only')
    with connection.cursor() as cur:
        cur.execute(
            "SELECT data_type FROM information_schema.columns "
            "WHERE table_name = 'search_index' AND column_name = 'author_id';"
        )
        row = cur.fetchone()
        assert row is not None and row[0] == 'uuid', (
            f'author_id deveria ser uuid no DB, é {row}. '
            f'Bug 1 do specialist DB foi reintroduzido.'
        )
