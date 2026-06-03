"""Testes da migration ``0005_trigger_enable_always`` (Task T30.1.5d; ADR-039).

Fecha o vetor M-04/H-04 do SECURITY-REVIEW (CWE-863): trigger criada com
``ENABLE`` default (modo ORIGIN) é bypassada por
``SET session_replication_role = 'replica'``. ``ENABLE ALWAYS`` força execução
mesmo em modo replica.

Cenários cobertos:

    1. ``pg_trigger.tgenabled = 'A'`` para ``articles_sync_search`` e
       ``articles_remove_search`` (estrutural — verifica o estado da migration).
    2. Funcional — em sessão com ``session_replication_role = 'replica'``,
       INSERT publicado AINDA popula ``search_index``. Sem ENABLE ALWAYS,
       o INSERT seria silencioso (trigger não dispara) e ``search_index``
       ficaria vazio.

Referências:

    - ADR-039 (Test integration trigger bypass session_replication_role)
    - REVIEW-PHASE-1.md §3 H-01
    - SECURITY-REVIEW.md M-04
"""
from __future__ import annotations

import uuid

import pytest
from django.db import connection

from apps.articles.models import Category


def _trigger_enabled(trigger_name: str) -> str:
    """Lê ``pg_trigger.tgenabled`` para um trigger por nome.

    Valores possíveis:
        - 'O' (Origin) — default; bypassado por session_replication_role='replica'
        - 'A' (Always) — dispara mesmo em modo replica (defesa em profundidade)
        - 'D' (Disabled), 'R' (Replica only)
    """
    with connection.cursor() as cur:
        cur.execute(
            'SELECT tgenabled FROM pg_trigger WHERE tgname = %s;',
            [trigger_name],
        )
        row = cur.fetchone()
        return row[0] if row else ''


def _count_search_index(article_id: uuid.UUID) -> int:
    with connection.cursor() as cur:
        cur.execute(
            'SELECT COUNT(*) FROM search_index WHERE article_id = %s;',
            [str(article_id)],
        )
        return cur.fetchone()[0]


@pytest.mark.requires_postgres
@pytest.mark.django_db
def test_sync_trigger_is_enable_always() -> None:
    """ADR-039 — trigger ``articles_sync_search`` deve ter ``tgenabled = 'A'``."""
    if connection.vendor != 'postgresql':
        pytest.skip('Postgres-only — pg_trigger é catálogo Postgres')
    state = _trigger_enabled('articles_sync_search')
    assert state == 'A', (
        f"articles_sync_search deve estar em ENABLE ALWAYS (tgenabled='A'), "
        f"está '{state}'. Sem isso, SET session_replication_role='replica' "
        f"bypassa a trigger (vetor M-04 do SECURITY-REVIEW)."
    )


@pytest.mark.requires_postgres
@pytest.mark.django_db
def test_remove_trigger_is_enable_always() -> None:
    """ADR-039 — trigger ``articles_remove_search`` também deve ser ALWAYS."""
    if connection.vendor != 'postgresql':
        pytest.skip('Postgres-only — pg_trigger é catálogo Postgres')
    state = _trigger_enabled('articles_remove_search')
    assert state == 'A', (
        f"articles_remove_search deve estar em ENABLE ALWAYS, está '{state}'."
    )


@pytest.mark.requires_postgres
@pytest.mark.django_db(transaction=True)
def test_trigger_fires_under_replica_role(admin_user) -> None:
    """Funcional — sob ``session_replication_role='replica'``, o INSERT em
    artigo publicado AINDA popula ``search_index`` (porque a trigger é ALWAYS).

    Esta é a defesa real contra o vetor de bypass:
        1. Atacante com role REPLICATION (ou superuser) executa
           ``SET session_replication_role = 'replica'``.
        2. Triggers ORIGIN (default ENABLE) NÃO disparam → INSERT silencioso
           em articles, search_index fica vazio → drift permanente.
        3. Com ENABLE ALWAYS, a trigger dispara mesmo assim → consistência
           preservada.
    """
    if connection.vendor != 'postgresql':
        pytest.skip('Postgres-only — session_replication_role é Postgres')

    category, _ = Category.objects.get_or_create(name='Música Replica Test')

    # Simula atacante / replica session
    with connection.cursor() as cur:
        cur.execute("SET LOCAL session_replication_role = 'replica';")
        # INSERT direto via SQL (Django ORM via SET LOCAL é tricky em mesma tx)
        article_id = uuid.uuid4()
        cur.execute(
            """
            INSERT INTO articles (
                id, title, slug, excerpt, body, author_id, category_id,
                status, is_featured, view_count, created_at, updated_at,
                published_at, cover_caption
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s,
                'published', false, 0, NOW(), NOW(), NOW(), ''
            );
            """,
            [
                str(article_id),
                'Trigger ENABLE ALWAYS deve disparar mesmo em replica',
                f'trigger-replica-{article_id.hex[:8]}',
                'Excerpt sob replica role',
                'Body sob replica role',
                str(admin_user.id),
                category.id,
            ],
        )

    assert _count_search_index(article_id) == 1, (
        "Trigger não disparou sob session_replication_role='replica'. "
        "ADR-039 / migration 0005 não aplicada ou trigger não é ENABLE ALWAYS. "
        "Vetor M-04 do SECURITY-REVIEW REABERTO."
    )


@pytest.mark.django_db
def test_migration_0005_applied() -> None:
    """Estrutural — a migration 0005 deve existir e estar registrada.

    Não requer Postgres porque só verifica o estado de migration recorder.
    Em SQLite-dev a migration é no-op (não há pg_trigger).
    """
    from django.db.migrations.recorder import MigrationRecorder

    applied = MigrationRecorder(connection).applied_migrations()
    assert ('search', '0005_trigger_enable_always') in applied, (
        'Migration 0005_trigger_enable_always não aplicada — rodar `uv run '
        'python manage.py migrate search`.'
    )
