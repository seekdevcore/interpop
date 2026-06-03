"""Migration 0001 — Schema inicial da busca editorial.

Cria, em Postgres:

    1. Extension ``unaccent`` (exige SUPERUSER em provisão — TX-13).
    2. Função ``immutable_unaccent(regdictionary, text)`` declarada IMMUTABLE
       PARALLEL SAFE (workaround para que ``unaccent`` possa ser usada em
       índice expressão).
    3. ``CONFIGURATION pt_unaccent`` clonada de ``portuguese`` com
       ``ALTER MAPPING ... WITH unaccent, portuguese_stem`` — pipeline FTS
       canônico pt-BR (ADR-019).
    4. Função ``articles_search_config(text) RETURNS tsvector IMMUTABLE
       PARALLEL SAFE`` — usada por trigger e queries (ADR-019).
    5. Tabela ``search_index`` (read-projection de Article) com
       ``article_id UUID`` PK, ``search_vector tsvector``, weighted text
       fields, ``author_id UUID``, ``category_id BIGINT NULL``,
       ``published_at TIMESTAMPTZ`` e ``indexed_at TIMESTAMPTZ`` (ADR-016).
    6. Tabela ``search_log`` (analytics, retenção LGPD 7d).

Em SQLite-dev (ADR-020), apenas o esqueleto mínimo das duas tabelas é criado
(sem extensions, configuration, função IMMUTABLE ou tsvector nativo). Tests
gated por ``@pytest.mark.requires_postgres`` cobrem o caminho Postgres real.

Bugs corrigidos vs DESIGN v2 (specialist DB):
    Bug 1: ``author_id UUID`` (User.id é UUID, não BIGINT).
    Bug 2: configuration ``pt_unaccent`` preserva ``IMMUTABLE`` na função
           ``articles_search_config`` (necessário para índice expressão).

Refs: DESIGN.md §2.2; ADR-018; ADR-019; ADR-020;
      _specialist-outputs/01-database-architect.md §1.
"""
from __future__ import annotations

from django.db import migrations, models


# ── SQL Postgres-only ───────────────────────────────────────────────────────────

CREATE_EXTENSION_AND_FUNCTION_SQL = r"""
-- 1. Extension unaccent. Exige SUPERUSER na primeira execução em produção.
--    Em ambientes gerenciados, executar manualmente como admin do Postgres
--    antes de rodar migrate como usuário da app.
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Wrapper IMMUTABLE de unaccent.
--    ``unaccent(regdictionary, text)`` em catalog é STABLE (depende de
--    ``unaccent.rules``). Postgres recusa criar índice expressão sobre função
--    STABLE → wrapper IMMUTABLE PARALLEL SAFE é o workaround padrão da
--    comunidade pt-BR (Bug 2 do specialist DB).
CREATE OR REPLACE FUNCTION public.immutable_unaccent(regdictionary, text)
RETURNS text AS $$
    SELECT unaccent($1, $2)
$$ LANGUAGE SQL IMMUTABLE PARALLEL SAFE;

-- 3. CONFIGURATION dedicada pt_unaccent — clona portuguese e troca o mapping
--    de palavras (hword, hword_part, word) para passar por unaccent ANTES
--    do portuguese_stem. Resultado: normalização token-a-token dentro do
--    pipeline FTS (preserva tratamento de stopwords pt-BR — ADR-019).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_ts_config
        WHERE cfgname = 'pt_unaccent' AND cfgnamespace = 'public'::regnamespace
    ) THEN
        CREATE TEXT SEARCH CONFIGURATION public.pt_unaccent (
            COPY = pg_catalog.portuguese
        );
    END IF;
END $$;

ALTER TEXT SEARCH CONFIGURATION public.pt_unaccent
    ALTER MAPPING FOR hword, hword_part, word
    WITH unaccent, portuguese_stem;

-- 4. Função wrapper IMMUTABLE PARALLEL SAFE para uso em trigger e índice.
--    Esta é a função que a trigger ``trg_articles_sync_search`` (migration
--    0003) chama com setweight A/B/C sobre title/excerpt/body.
CREATE OR REPLACE FUNCTION public.articles_search_config(text)
RETURNS tsvector AS $$
    SELECT to_tsvector('public.pt_unaccent'::regconfig, $1)
$$ LANGUAGE SQL IMMUTABLE PARALLEL SAFE;
"""

DROP_EXTENSION_AND_FUNCTION_SQL = r"""
DROP FUNCTION IF EXISTS public.articles_search_config(text);
DROP TEXT SEARCH CONFIGURATION IF EXISTS public.pt_unaccent;
DROP FUNCTION IF EXISTS public.immutable_unaccent(regdictionary, text);
-- NOTA: NÃO removemos a extension unaccent no rollback — outros apps podem
-- depender dela. Provisão é externa (TX-13).
"""

CREATE_TABLES_POSTGRES_SQL = r"""
-- Tabela search_index — read-projection de Article (ADR-016).
-- Schema controlado por esta migration, NÃO pelo ORM (Meta.managed = False).
--
-- Por que esses campos? Ver DESIGN.md §2.2:
--   * article_id UUID PK 1:1 com articles.id
--   * search_vector tsvector — composto por setweight A/B/C
--   * title_text / excerpt_text / body_text — cópias para ts_headline futuro
--   * author_id UUID — cópia para filtro sem JOIN
--   * category_id BIGINT NULL — cópia para filtro sem JOIN
--   * published_at TIMESTAMPTZ — recency decay
--   * indexed_at TIMESTAMPTZ — diagnóstico do último upsert
CREATE TABLE IF NOT EXISTS search_index (
    article_id    UUID PRIMARY KEY
                  REFERENCES articles(id) ON DELETE CASCADE,
    search_vector tsvector NOT NULL,
    title_text    TEXT     NOT NULL,
    excerpt_text  TEXT     NOT NULL DEFAULT '',
    body_text     TEXT     NOT NULL,
    -- Bug 1 do specialist DB: User.id é UUID, NÃO BIGINT.
    -- FK aponta para users(id) (tabela do AbstractBaseUser custom em apps.users).
    author_id     UUID     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- category_id continua BIGINT (Category usa BigAutoField padrão); NULL-able
    -- porque Article.category é opcional (on_delete=SET_NULL).
    category_id   BIGINT   REFERENCES categories(id) ON DELETE SET NULL,
    published_at  TIMESTAMPTZ NOT NULL,
    indexed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE search_index IS
    'Read-projection de Article para FTS (ADR-016). Mantida pela trigger '
    'trg_articles_sync_search (ADR-018). Código Python NUNCA escreve aqui.';

-- Tabela search_log — analytics, retenção LGPD 7d (RNF do DESIGN).
CREATE TABLE IF NOT EXISTS search_log (
    id              BIGSERIAL PRIMARY KEY,
    query_text      TEXT NOT NULL DEFAULT '',
    query_norm      TEXT NOT NULL DEFAULT '',
    filters_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
    results_count   INTEGER NOT NULL DEFAULT 0,
    total_estimate  INTEGER NOT NULL DEFAULT 0,
    duration_ms     INTEGER NOT NULL DEFAULT 0,
    cache_hit       BOOLEAN NOT NULL DEFAULT FALSE,
    -- user_id é UUID opcional (anon = NULL). Sem PII além do ID interno.
    user_id         UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE search_log IS
    'Log de buscas com retenção 7d (LGPD). Purga via Celery Beat (futuro).';

CREATE INDEX IF NOT EXISTS idx_search_log_created_at
    ON search_log (created_at DESC);
"""

DROP_TABLES_POSTGRES_SQL = r"""
DROP TABLE IF EXISTS search_log;
DROP TABLE IF EXISTS search_index;
"""

# ── SQL SQLite-dev fallback (ADR-020) ───────────────────────────────────────────
# SQLite NÃO suporta tsvector, CREATE EXTENSION, CREATE TEXT SEARCH CONFIGURATION,
# nem trigger PL/pgSQL. Criamos apenas o esqueleto das tabelas — search_vector
# vira TEXT NULL, sem trigger, sem GIN, sem foreign keys com ON DELETE CASCADE
# (que SQLite suporta mas com semântica restrita). Isso permite que o ORM mapeie
# os models com managed=False sem que a migration trave. Tests reais de FTS são
# gated por @pytest.mark.requires_postgres.

CREATE_TABLES_SQLITE_SQL = r"""
CREATE TABLE IF NOT EXISTS search_index (
    article_id    CHAR(32) PRIMARY KEY,
    search_vector TEXT,
    title_text    TEXT NOT NULL,
    excerpt_text  TEXT NOT NULL DEFAULT '',
    body_text     TEXT NOT NULL,
    author_id     CHAR(32) NOT NULL,
    category_id   BIGINT,
    published_at  DATETIME NOT NULL,
    indexed_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS search_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    query_text      TEXT NOT NULL DEFAULT '',
    query_norm      TEXT NOT NULL DEFAULT '',
    filters_json    TEXT NOT NULL DEFAULT '{}',
    results_count   INTEGER NOT NULL DEFAULT 0,
    total_estimate  INTEGER NOT NULL DEFAULT 0,
    duration_ms     INTEGER NOT NULL DEFAULT 0,
    cache_hit       INTEGER NOT NULL DEFAULT 0,
    user_id         CHAR(32),
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_search_log_created_at
    ON search_log (created_at DESC);
"""

DROP_TABLES_SQLITE_SQL = r"""
DROP TABLE IF EXISTS search_log;
DROP TABLE IF EXISTS search_index;
"""


# ── Operações condicionais por vendor (ADR-020) ────────────────────────────────


def _split_sql_statements(sql: str) -> list[str]:
    """Quebra SQL multi-statement em statements individuais.

    Necessário porque o driver SQLite (sqlite3) só aceita 1 statement por
    ``execute()``. Postgres aceita multi-statement, mas split é seguro para
    ambos.

    Não é parser SQL completo; assume:
        - Statements separados por ';' no fim da linha.
        - Blocos DO $$ ... $$ usam ``$$`` como delimitador e NÃO devem ser
          quebrados pelo ';' interno.
    """
    statements: list[str] = []
    buffer: list[str] = []
    in_dollar_block = False
    for line in sql.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith('--'):
            buffer.append(line)
            continue
        # Tracking de blocos DO $$ ... $$ (sequência ímpar = entra/sai)
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


def _execute_many(schema_editor, sql: str) -> None:
    """Executa SQL multi-statement em chunks individuais (compat SQLite)."""
    for stmt in _split_sql_statements(sql):
        schema_editor.execute(stmt)


def _apply_postgres_only(apps, schema_editor):
    """Roda as DDLs Postgres-only (extensions, configuration, função IMMUTABLE,
    tabelas full com tsvector + FKs).

    Em SQLite, roda o fallback mínimo (sem extensions, sem tsvector real).
    """
    vendor = schema_editor.connection.vendor
    if vendor == 'postgresql':
        _execute_many(schema_editor, CREATE_EXTENSION_AND_FUNCTION_SQL)
        _execute_many(schema_editor, CREATE_TABLES_POSTGRES_SQL)
    else:
        # SQLite-dev (ADR-020). Outros vendors caem aqui também — assumimos
        # comportamento "best effort" via SQL ANSI mínimo. Em CI sempre Postgres.
        _execute_many(schema_editor, CREATE_TABLES_SQLITE_SQL)


def _reverse_postgres_only(apps, schema_editor):
    """Rollback simétrico ao :func:`_apply_postgres_only`."""
    vendor = schema_editor.connection.vendor
    if vendor == 'postgresql':
        _execute_many(schema_editor, DROP_TABLES_POSTGRES_SQL)
        _execute_many(schema_editor, DROP_EXTENSION_AND_FUNCTION_SQL)
    else:
        _execute_many(schema_editor, DROP_TABLES_SQLITE_SQL)


class Migration(migrations.Migration):
    """Schema inicial da busca editorial.

    ``atomic = True`` é OK aqui: CREATE EXTENSION / CONFIGURATION / FUNCTION /
    TABLE rodam dentro de transação em Postgres. CONCURRENTLY (que exige
    ``atomic = False``) só aparece na migration ``0002_search_indexes``.
    """

    initial = True

    dependencies = [
        # Aguarda tabela articles (FK article_id → articles.id) e users
        # (FK author_id → users.id) e categories (FK category_id → categories.id).
        # Targeted nas últimas migrations de cada app para garantir que o schema
        # final esteja estabilizado antes de adicionar FKs.
        ('articles', '0004_article_cover_caption'),
        ('users', '0004_user_role_editor_label'),
    ]

    operations = [
        # 1. Registra os models no state do Django (managed=False → ORM NÃO
        #    cria/altera schema; ORM apenas mapeia para queries).
        migrations.CreateModel(
            name='SearchIndex',
            fields=[
                ('article_id', models.UUIDField(primary_key=True, serialize=False, db_column='article_id')),
                ('search_vector', models.TextField(blank=True, null=True, db_column='search_vector')),
                ('title_text', models.TextField(db_column='title_text')),
                ('excerpt_text', models.TextField(blank=True, default='', db_column='excerpt_text')),
                ('body_text', models.TextField(db_column='body_text')),
                ('author_id', models.UUIDField(db_column='author_id')),
                ('category_id', models.BigIntegerField(blank=True, null=True, db_column='category_id')),
                ('published_at', models.DateTimeField(db_column='published_at')),
                ('indexed_at', models.DateTimeField(db_column='indexed_at')),
            ],
            options={
                'managed': False,
                'db_table': 'search_index',
                'verbose_name': 'Entrada do índice de busca',
                'verbose_name_plural': 'Entradas do índice de busca',
            },
        ),
        migrations.CreateModel(
            name='SearchLog',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('query_text', models.TextField(blank=True, default='')),
                ('query_norm', models.TextField(blank=True, default='')),
                ('filters_json', models.JSONField(blank=True, default=dict)),
                ('results_count', models.IntegerField(default=0)),
                ('total_estimate', models.IntegerField(default=0)),
                ('duration_ms', models.IntegerField(default=0)),
                ('cache_hit', models.BooleanField(default=False)),
                ('user_id', models.UUIDField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
            ],
            options={
                'managed': False,
                'db_table': 'search_log',
                'verbose_name': 'Log de busca',
                'verbose_name_plural': 'Logs de busca',
                'ordering': ['-created_at'],
            },
        ),
        # 2. Cria o schema real via SQL (extensions, configuration, função
        #    IMMUTABLE, tabelas com tsvector, FKs com ON DELETE CASCADE).
        #    Em SQLite, fallback mínimo (sem FTS real).
        migrations.RunPython(
            code=_apply_postgres_only,
            reverse_code=_reverse_postgres_only,
            elidable=False,
        ),
    ]
