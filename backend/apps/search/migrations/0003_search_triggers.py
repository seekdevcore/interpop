"""Migration 0003 — Triggers SQL de sincronia Article → SearchIndex (ADR-018).

Cria, em Postgres:

    1. Função PL/pgSQL ``trg_articles_sync_search()`` — UPSERT idempotente
       em ``search_index`` quando ``Article.status = 'published' AND
       published_at IS NOT NULL``; DELETE quando rebaixado para draft.
    2. Função PL/pgSQL ``trg_articles_remove_search()`` — DELETE em
       ``search_index`` em DELETE de Article.
    3. Trigger ``articles_sync_search`` AFTER INSERT OR UPDATE OF
       (status, published_at, title, excerpt, body, author_id, category_id)
       ON articles — escopo de campos relevantes apenas, reduz overhead.
    4. Trigger ``articles_remove_search`` AFTER DELETE ON articles.

Trigger SQL é a **fonte de verdade da consistência** (ADR-018). Garante
sincronia sob 4 cenários onde signal Python falha:
    - bulk_update / QuerySet.update() (Django NÃO dispara signal)
    - Raw SQL (UPDATE articles SET status=...)
    - Fixture loaddata em CI/dev
    - Restore parcial pós-incidente (pg_restore --table=articles)

Em SQLite-dev (ADR-020): no-op. SQLite suporta trigger SQL limitada mas não
PL/pgSQL, tsvector ou setweight. SearchService Fase 2 usa __icontains.

Refs: DESIGN.md §2.2 (Decisão refinada — Trigger SQL + Signal);
      ADR-018 (trigger = fonte de verdade);
      ADR-019 (articles_search_config IMMUTABLE usada na trigger);
      _specialist-outputs/01-database-architect.md §1 (Bug 3, Bug 4).
"""
from __future__ import annotations

from django.db import migrations


# Função de UPSERT (publicação + reindex de campo) / DELETE (despublicação).
# Tratamentos:
#   * NEW.status = 'published' AND NEW.published_at IS NOT NULL → UPSERT
#     com setweight A/B/C de title/excerpt/body via articles_search_config
#     (configuration pt_unaccent — ADR-019).
#   * Caso contrário (draft, ou published_at NULL) → DELETE da projeção.
#     Esse branch cobre o "fantasma do publicado" (Bug 3 do specialist DB).
CREATE_SYNC_FUNCTION_SQL = r"""
CREATE OR REPLACE FUNCTION public.trg_articles_sync_search()
RETURNS trigger AS $$
BEGIN
    IF NEW.status = 'published' AND NEW.published_at IS NOT NULL THEN
        INSERT INTO search_index (
            article_id, search_vector,
            title_text, excerpt_text, body_text,
            author_id, category_id, published_at, indexed_at
        ) VALUES (
            NEW.id,
            setweight(public.articles_search_config(COALESCE(NEW.title, '')),   'A') ||
            setweight(public.articles_search_config(COALESCE(NEW.excerpt, '')), 'B') ||
            setweight(public.articles_search_config(COALESCE(NEW.body, '')),    'C'),
            COALESCE(NEW.title, ''),
            COALESCE(NEW.excerpt, ''),
            COALESCE(NEW.body, ''),
            NEW.author_id,
            NEW.category_id,
            NEW.published_at,
            NOW()
        )
        ON CONFLICT (article_id) DO UPDATE SET
            search_vector = EXCLUDED.search_vector,
            title_text    = EXCLUDED.title_text,
            excerpt_text  = EXCLUDED.excerpt_text,
            body_text     = EXCLUDED.body_text,
            author_id     = EXCLUDED.author_id,
            category_id   = EXCLUDED.category_id,
            published_at  = EXCLUDED.published_at,
            indexed_at    = NOW();
    ELSE
        -- Despublicação (status virou draft, OR published_at virou NULL):
        -- remove projeção. Corrige Bug 3 do specialist DB.
        DELETE FROM search_index WHERE article_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

# Função de remoção em DELETE de Article (CASCADE da FK também removeria, mas
# manter trigger explícita facilita debug e cobre cenário onde FK foi
# desabilitada temporariamente — ex.: session_replication_role = 'replica').
CREATE_REMOVE_FUNCTION_SQL = r"""
CREATE OR REPLACE FUNCTION public.trg_articles_remove_search()
RETURNS trigger AS $$
BEGIN
    DELETE FROM search_index WHERE article_id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;
"""

# Trigger AFTER INSERT OR UPDATE OF — escopo limitado a campos relevantes.
# UPDATE em view_count, is_featured, slug etc. NÃO dispara reindex (reduz custo).
# IF NOT EXISTS não está disponível em CREATE TRIGGER (Postgres < 14 não suporta,
# 14+ sim); usamos DROP IF EXISTS + CREATE para idempotência cross-version.
CREATE_TRIGGERS_SQL = r"""
DROP TRIGGER IF EXISTS articles_sync_search ON articles;
CREATE TRIGGER articles_sync_search
    AFTER INSERT OR UPDATE OF
        status, published_at, title, excerpt, body, author_id, category_id
    ON articles
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_articles_sync_search();

DROP TRIGGER IF EXISTS articles_remove_search ON articles;
CREATE TRIGGER articles_remove_search
    AFTER DELETE ON articles
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_articles_remove_search();
"""

# Rollback simétrico.
DROP_TRIGGERS_SQL = r"""
DROP TRIGGER IF EXISTS articles_remove_search ON articles;
DROP TRIGGER IF EXISTS articles_sync_search ON articles;
"""

DROP_FUNCTIONS_SQL = r"""
DROP FUNCTION IF EXISTS public.trg_articles_remove_search();
DROP FUNCTION IF EXISTS public.trg_articles_sync_search();
"""


def _split_statements(sql: str) -> list[str]:
    """Quebra SQL multi-statement respeitando blocos PL/pgSQL ``$$ ... $$``.

    Mesmo splitter da migration 0001 (não compartilhado para evitar import
    cíclico entre migrations).
    """
    statements: list[str] = []
    buffer: list[str] = []
    in_dollar_block = False
    for line in sql.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith('--'):
            buffer.append(line)
            continue
        dollar_count = stripped.count('$$')
        if dollar_count:
            in_dollar_block = (in_dollar_block + dollar_count) % 2 == 1
        buffer.append(line)
        if not in_dollar_block and stripped.endswith(';'):
            stmt = '\n'.join(buffer).strip()
            if stmt:
                statements.append(stmt)
            buffer = []
    tail = '\n'.join(buffer).strip()
    if tail:
        statements.append(tail)
    return statements


def _apply_triggers(apps, schema_editor) -> None:
    """Cria função + 2 triggers em Postgres. No-op em SQLite-dev."""
    if schema_editor.connection.vendor != 'postgresql':
        return
    for sql in (
        CREATE_SYNC_FUNCTION_SQL,
        CREATE_REMOVE_FUNCTION_SQL,
        CREATE_TRIGGERS_SQL,
    ):
        for stmt in _split_statements(sql):
            schema_editor.execute(stmt)


def _drop_triggers(apps, schema_editor) -> None:
    """Rollback simétrico ao :func:`_apply_triggers`."""
    if schema_editor.connection.vendor != 'postgresql':
        return
    for sql in (DROP_TRIGGERS_SQL, DROP_FUNCTIONS_SQL):
        for stmt in _split_statements(sql):
            schema_editor.execute(stmt)


class Migration(migrations.Migration):
    """Triggers SQL de sincronia Article → SearchIndex.

    ``atomic = True`` é OK: CREATE FUNCTION e CREATE TRIGGER aceitam
    transação. Importante rodar DEPOIS dos índices (0002) para que o GIN
    exista antes do primeiro insert massivo via backfill (Fase 2 reindex).
    """

    dependencies = [
        ('search', '0002_search_indexes'),
    ]

    operations = [
        migrations.RunPython(
            code=_apply_triggers,
            reverse_code=_drop_triggers,
            elidable=False,
        ),
    ]
