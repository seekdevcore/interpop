"""Migration 0002 — Índices da busca editorial.

Cria 4 índices em ``search_index``:

    1. ``idx_search_vector_gin`` — GIN sobre ``search_vector`` (FTS).
    2. ``idx_search_category_published`` — composite parcial
       ``(category_id, published_at DESC) WHERE category_id IS NOT NULL``.
    3. ``idx_search_author_pub_covering`` — composite com
       ``INCLUDE (article_id)`` para index-only scan no caminho filter-por-autor.
    4. ``idx_search_published_only`` — BTree em ``published_at DESC`` para
       ordenação por recência sem texto.

Por que ``atomic = False``:
    ``CREATE INDEX CONCURRENTLY`` em Postgres NÃO pode rodar dentro de
    transação. Django wrap migrations em transação por default; aqui
    desligamos com ``atomic = False`` para que CONCURRENTLY seja aceito
    (ADR-030-DB §"`CREATE INDEX CONCURRENTLY` exige `atomic = False`").

Em SQLite-dev (ADR-020): pulado completamente. SQLite não tem CONCURRENTLY,
não tem GIN, não suporta partial indexes com expressões pt-BR. Em local-dev
o ``__icontains`` fallback do SearchService (Fase 2) é suficiente.

Refs: DESIGN.md §2.2 (Indexes refinados);
      ADR-030-DB (composite parciais + covering);
      _specialist-outputs/01-database-architect.md §1 (Bug 5).
"""
from __future__ import annotations

from django.db import migrations


# 4 statements separados — CONCURRENTLY não pode rodar dentro de tx, e o
# driver psycopg também aceita 1 stmt por execute() quando usamos schema_editor.
CREATE_INDEXES_SQL = [
    # 1. GIN sobre search_vector — coração da busca FTS.
    """
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_vector_gin
        ON search_index USING GIN (search_vector);
    """,
    # 2. Composite parcial por editoria (ADR-030-DB §"Por que parcial em
    #    category_id"). WHERE NOT NULL economiza ~40% de tamanho e elimina
    #    write amplification quando category_id IS NULL no upsert.
    """
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_category_published
        ON search_index (category_id, published_at DESC)
        WHERE category_id IS NOT NULL;
    """,
    # 3. Composite com covering INCLUDE (ADR-030-DB §"Por que covering em
    #    author_id"). Permite index-only scan na CTE candidate-narrowing
    #    quando o filtro é só por autor (Postgres devolve article_id sem heap
    #    fetch).
    """
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_author_pub_covering
        ON search_index (author_id, published_at DESC)
        INCLUDE (article_id);
    """,
    # 4. BTree em published_at DESC para ordenação por recência sem texto.
    """
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_published_only
        ON search_index (published_at DESC);
    """,
]

DROP_INDEXES_SQL = [
    'DROP INDEX CONCURRENTLY IF EXISTS idx_search_published_only;',
    'DROP INDEX CONCURRENTLY IF EXISTS idx_search_author_pub_covering;',
    'DROP INDEX CONCURRENTLY IF EXISTS idx_search_category_published;',
    'DROP INDEX CONCURRENTLY IF EXISTS idx_search_vector_gin;',
]


def _create_indexes(apps, schema_editor) -> None:
    """Cria os 4 índices em Postgres. No-op em SQLite-dev."""
    if schema_editor.connection.vendor != 'postgresql':
        return  # SQLite: SearchService usa __icontains fallback (ADR-020).
    for stmt in CREATE_INDEXES_SQL:
        schema_editor.execute(stmt.strip())


def _drop_indexes(apps, schema_editor) -> None:
    """Rollback simétrico ao :func:`_create_indexes`."""
    if schema_editor.connection.vendor != 'postgresql':
        return
    for stmt in DROP_INDEXES_SQL:
        schema_editor.execute(stmt.strip())


class Migration(migrations.Migration):
    """Índices da busca editorial.

    ``atomic = False`` é REQUISITO DURO (não retirar): ``CREATE INDEX
    CONCURRENTLY`` é rejeitado pelo Postgres dentro de transação.
    Consequência: se UMA das 4 instruções falhar, as anteriores ficam
    aplicadas (Postgres permite resume manual). Em CI isso é raro porque
    a tabela está vazia; em produção, gerentes de migration devem confirmar
    estado dos índices via ``\\d+ search_index`` em caso de falha parcial.
    """

    atomic = False

    dependencies = [
        ('search', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(
            code=_create_indexes,
            reverse_code=_drop_indexes,
            elidable=False,
        ),
    ]
