"""Migration 0004 — Vacuum tuning agressivo para GIN + search_index (ADR-034).

Configura, em Postgres:

    * Storage params do índice GIN ``idx_search_vector_gin``:
        - ``fastupdate = on``: insertions vão para pending list (buffer) antes
          de virem ao índice principal. Reduz custo write online.
        - ``gin_pending_list_limit = '2MB'``: flush mais frequente (vs 4MB
          default) → flushes pequenos e previsíveis em vez de spikes.

    * Storage params da tabela ``search_index``:
        - ``autovacuum_vacuum_scale_factor = 0.05``: vacuum dispara quando 5%
          das linhas modificadas (vs 20% default) → autovacuum 4× mais
          frequente para search-heavy.
        - ``autovacuum_analyze_scale_factor = 0.02``: analyze a cada 2%
          modificado → statistics fresh para o planner (plan_rows do ADR-025).
        - ``autovacuum_vacuum_cost_delay = '10ms'``: pacing throttle mais
          agressivo (vs 20ms default). KVM 1 I/O tolera.

Em SQLite-dev (ADR-020): no-op. SQLite não tem GIN nem autovacuum params
table-level.

Refs: DESIGN.md §2.2 (Vacuum tuning); ADR-034;
      _specialist-outputs/01-database-architect.md §2 Gap E.
"""
from __future__ import annotations

from django.db import migrations


# Cada statement é um único comando — driver SQLite aceita 1 stmt/execute().
TUNING_STATEMENTS = [
    # GIN fastupdate + pending list limit
    """
    ALTER INDEX idx_search_vector_gin SET (
        fastupdate = on,
        gin_pending_list_limit = 2048
    );
    """,
    # Autovacuum agressivo na tabela search_index
    """
    ALTER TABLE search_index SET (
        autovacuum_vacuum_scale_factor = 0.05,
        autovacuum_analyze_scale_factor = 0.02,
        autovacuum_vacuum_cost_delay = 10
    );
    """,
]

# Reverse — volta aos defaults (RESET = remove o storage param customizado).
RESET_STATEMENTS = [
    """
    ALTER INDEX idx_search_vector_gin RESET (
        fastupdate,
        gin_pending_list_limit
    );
    """,
    """
    ALTER TABLE search_index RESET (
        autovacuum_vacuum_scale_factor,
        autovacuum_analyze_scale_factor,
        autovacuum_vacuum_cost_delay
    );
    """,
]


def _apply_tuning(apps, schema_editor) -> None:
    """Aplica vacuum tuning em Postgres. No-op em SQLite-dev."""
    if schema_editor.connection.vendor != 'postgresql':
        return
    for stmt in TUNING_STATEMENTS:
        schema_editor.execute(stmt.strip())


def _reset_tuning(apps, schema_editor) -> None:
    """Rollback simétrico: volta aos defaults Postgres."""
    if schema_editor.connection.vendor != 'postgresql':
        return
    for stmt in RESET_STATEMENTS:
        schema_editor.execute(stmt.strip())


class Migration(migrations.Migration):
    """Vacuum tuning — última migration da Fase 1.

    NOTA sobre unidades:
        - ``gin_pending_list_limit`` aceita inteiro em KB (PostgreSQL 13+).
          ``'2MB'`` em string só funciona em SHOW; ALTER exige inteiro KB
          (2048 = 2MB).
        - ``autovacuum_vacuum_cost_delay`` em ms inteiro.
    """

    dependencies = [
        ('search', '0003_search_triggers'),
    ]

    operations = [
        migrations.RunPython(
            code=_apply_tuning,
            reverse_code=_reset_tuning,
            elidable=False,
        ),
    ]
