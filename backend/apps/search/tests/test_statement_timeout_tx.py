"""Test F2-B-01 / REVIEW-PHASE-2 — SET LOCAL statement_timeout durabilidade.

Cenário (Postgres-only — `SHOW statement_timeout` não é portátil):

Em autocommit, cada `with connection.cursor()` abre uma TX implícita
própria. `SET LOCAL statement_timeout = '500ms'` aplicado em um cursor
era VÁLIDO só durante esse `with` — o main query, rodado em OUTRO cursor
abria nova TX e perdia o cap. Invariante #12 quebrada em runtime.

Fix (commit que entrega F2-B-01): `_query_postgres` é
`@transaction.atomic`. Todos os cursores aninhados (statement_timeout,
main query, ts_lexize, EXPLAIN) compartilham a mesma TX e `SET LOCAL`
vale do início ao fim.

Este teste valida o comportamento DA TX, não o método interno do
service: abre TX, faz SET LOCAL, abre cursor diferente dentro da MESMA
TX, e confirma que `SHOW statement_timeout` ainda devolve o valor que
foi setado. Sem o fix, o segundo cursor reportaria o default ('0' = sem
cap).
"""
from __future__ import annotations

import pytest
from django.db import connection, transaction


@pytest.mark.requires_postgres
@pytest.mark.django_db(transaction=True)
def test_set_local_statement_timeout_persists_across_cursors_inside_tx():
    """Dentro de transaction.atomic, SET LOCAL aplica ao TX inteiro."""
    if connection.vendor != 'postgresql':
        pytest.skip('Postgres-only — SHOW statement_timeout não é portátil')
    target_ms = 500

    with transaction.atomic():
        # cursor 1: SET LOCAL
        with connection.cursor() as cur1:
            cur1.execute(f"SET LOCAL statement_timeout = '{target_ms}ms';")
            cur1.execute('SHOW statement_timeout;')
            value_inside_setter = cur1.fetchone()[0]

        # cursor 2: reabre dentro da MESMA TX. Sem @transaction.atomic
        # envolvendo, cur2 estaria em nova TX implícita e SHOW retornaria '0'.
        with connection.cursor() as cur2:
            cur2.execute('SHOW statement_timeout;')
            value_after_first_cursor_closed = cur2.fetchone()[0]

    # Ambos os cursores devem ver o mesmo cap (500ms; Postgres aceita '500ms'
    # ou normaliza — comparamos por conteúdo).
    assert value_inside_setter == value_after_first_cursor_closed, (
        f'SET LOCAL devia persistir cross-cursor dentro do TX. '
        f'cur1 reportou {value_inside_setter!r}, '
        f'cur2 reportou {value_after_first_cursor_closed!r}.'
    )
    assert '500' in value_inside_setter, (
        f'statement_timeout devia conter 500ms. got: {value_inside_setter!r}'
    )


@pytest.mark.requires_postgres
@pytest.mark.django_db(transaction=True)
def test_set_local_statement_timeout_dies_outside_tx():
    """Defensivo — confirma o bug original (sem @transaction.atomic).

    Documenta o motivo do fix: prova que sem TX explícita, o SET LOCAL
    morre quando o cursor fecha. Esse teste é a "evidência negativa" que
    justifica `@transaction.atomic` em `_query_postgres`.
    """
    if connection.vendor != 'postgresql':
        pytest.skip('Postgres-only — SHOW statement_timeout não é portátil')
    # 1º cursor: implicit TX. Set + read no MESMO cursor → vê o valor.
    with connection.cursor() as cur1:
        cur1.execute("SET LOCAL statement_timeout = '500ms';")
        cur1.execute('SHOW statement_timeout;')
        value_in_setter = cur1.fetchone()[0]

    # 2º cursor: implicit TX nova → não vê o SET LOCAL antigo.
    with connection.cursor() as cur2:
        cur2.execute('SHOW statement_timeout;')
        value_after_cursor_closed = cur2.fetchone()[0]

    assert '500' in value_in_setter
    # Confirma o bug que foi corrigido: cap perdido fora da TX explícita.
    assert value_after_cursor_closed != value_in_setter, (
        'Reproducao do bug F2-B-01: SET LOCAL devia morrer ao trocar de TX '
        'implicita. Se este assert falhar, o autocommit do Django mudou '
        'comportamento e o fix pode nao ser mais necessario — revisar.'
    )
