"""Migration 0005 — Triggers ENABLE ALWAYS (ADR-039 + REVIEW-PHASE-1 H-01).

Fix do achado 🟠 High do code-review da Fase 1: as triggers criadas pela
migration 0003 estão em modo ``ENABLE`` (ORIGIN) default. Esse modo é
**bypassado** por::

    SET session_replication_role = 'replica';

Vetor (CWE-863, Incorrect Authorization Check):

    1. Atacante com role REPLICATION (raro) ou usuário ``postgres``
       (host comprometido) executa o SET acima.
    2. Triggers em modo ORIGIN não disparam para a sessão.
    3. INSERT/UPDATE em ``articles`` não sincroniza ``search_index``.
    4. Drift permanente: artigos publicados desaparecem da busca, ou
       mantêm projeção stale (search_vector desatualizado).

Defesa: marcar as triggers como ``ENABLE ALWAYS`` (``pg_trigger.tgenabled =
'A'``). Triggers ALWAYS disparam mesmo em modo replica.

Rollback simétrico: ``ENABLE`` puro (volta ao default ORIGIN). Não usa
``DISABLE`` porque queremos preservar o comportamento da 0003.

Em SQLite-dev (ADR-020): no-op. Trigger SQLite não tem ALWAYS/REPLICA
modes — o catálogo Postgres `pg_trigger` nem existe.

Referências:

    - ADR-039 (Test integration trigger bypass session_replication_role)
    - REVIEW-PHASE-1.md §3 H-01
    - SECURITY-REVIEW.md §3 M-04
"""
from __future__ import annotations

from django.db import migrations


ENABLE_ALWAYS_SQL = r"""
ALTER TABLE articles ENABLE ALWAYS TRIGGER articles_sync_search;
ALTER TABLE articles ENABLE ALWAYS TRIGGER articles_remove_search;
"""

# Rollback: volta ao default ENABLE (ORIGIN). Não DISABLE — queremos que a
# sincronia continue funcionando em modo single-session normal.
ENABLE_ORIGIN_SQL = r"""
ALTER TABLE articles ENABLE TRIGGER articles_sync_search;
ALTER TABLE articles ENABLE TRIGGER articles_remove_search;
"""


def _apply_enable_always(apps, schema_editor) -> None:
    """Marca as duas triggers como ``ENABLE ALWAYS``. No-op em SQLite-dev."""
    if schema_editor.connection.vendor != 'postgresql':
        return
    for stmt in (s.strip() for s in ENABLE_ALWAYS_SQL.split(';') if s.strip()):
        schema_editor.execute(stmt)


def _reverse_enable_always(apps, schema_editor) -> None:
    """Rollback: volta ao default ORIGIN (``ENABLE`` puro)."""
    if schema_editor.connection.vendor != 'postgresql':
        return
    for stmt in (s.strip() for s in ENABLE_ORIGIN_SQL.split(';') if s.strip()):
        schema_editor.execute(stmt)


class Migration(migrations.Migration):
    """ENABLE ALWAYS para triggers de sincronia search_index.

    ``atomic = True`` (default): ALTER TABLE ... ENABLE TRIGGER é DDL leve
    que aceita transação. Não usa CONCURRENTLY, não trava operações de
    leitura — apenas atualiza catálogo.
    """

    dependencies = [
        ('search', '0004_search_vacuum_tuning'),
    ]

    operations = [
        migrations.RunPython(
            code=_apply_enable_always,
            reverse_code=_reverse_enable_always,
            elidable=False,
        ),
    ]
