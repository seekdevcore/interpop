"""Testes de ``apps.search.utils.normalize_search_text`` (Task T30.1.X2).

Invariante #2 do algorithms specialist:

    > ``normalize_search_text(s)`` é função única, compartilhada entre signal
    > post_save (upsert search_vector) E SearchService.query(). Drift quebra
    > silenciosamente toda busca composta.

Cenários cobertos:
    - Lowercase
    - Strip pontuação preservando alfanuméricos pt-BR (acento OK)
    - ``k-pop`` → ``k-pop kpop`` (gera variante sem hífen)
    - Whitespace collapsing
    - Edge cases: vazio, só espaços, apenas pontuação, emoji
    - Determinismo (idempotência: f(f(x)) == f(x))
    - Simetria: o mesmo callable usado em signal e service

Sem stemming aqui — quem faz stem é ``ts_lexize('portuguese_stem', ...)``
no Postgres. Esta função é apenas normalização lexical comum
(case-fold + acento OK + variantes de hífen).
"""
from __future__ import annotations

import pytest

from apps.search.utils import normalize_search_text


# ── Lowercase ────────────────────────────────────────────────────────────────


def test_lowercase() -> None:
    assert normalize_search_text('K-POP') == normalize_search_text('K-POP').lower()
    assert 'K' not in normalize_search_text('KPOP')


def test_preserve_portuguese_accents() -> None:
    """Acento permanece — unaccent é responsabilidade do Postgres (pt_unaccent)."""
    out = normalize_search_text('São Paulo Beyoncé')
    assert 'ã' in out
    assert 'é' in out


# ── Hifen → variantes (k-pop → "k-pop kpop") ─────────────────────────────────


def test_hyphenated_term_generates_unhyphenated_variant() -> None:
    """Inv 2 crítica — ``k-pop`` deve casar com ``kpop``.

    Estratégia: gerar AMBAS as variantes ("k-pop kpop") na string normalizada
    para que ``to_tsvector`` (indexing) e ``plainto_tsquery`` (query) cubram
    os dois lados.
    """
    out = normalize_search_text('k-pop')
    tokens = out.split()
    assert 'k-pop' in tokens
    assert 'kpop' in tokens


def test_multiple_hyphenated_terms() -> None:
    out = normalize_search_text('k-pop hip-hop')
    tokens = out.split()
    assert 'k-pop' in tokens and 'kpop' in tokens
    assert 'hip-hop' in tokens and 'hiphop' in tokens


def test_simple_hyphen_no_variant() -> None:
    """Token sem hífen → sem variante (não duplica)."""
    out = normalize_search_text('beyonce')
    assert out.split().count('beyonce') == 1


# ── Edge cases ───────────────────────────────────────────────────────────────


@pytest.mark.parametrize('inp,expected', [
    ('', ''),
    ('   ', ''),
    ('!@#$%', ''),
])
def test_empty_and_whitespace(inp: str, expected: str) -> None:
    assert normalize_search_text(inp) == expected


def test_emoji_stripped() -> None:
    """Emoji sai (não casa em tsvector de qualquer forma)."""
    out = normalize_search_text('kpop 🎵 music')
    assert '🎵' not in out


def test_html_chars_stripped() -> None:
    """Defesa em profundidade contra H-01 (SECURITY-REVIEW XSS): chars
    de HTML não passam. A camada principal é o serializer; esta é redundante."""
    out = normalize_search_text('<script>alert(1)</script>')
    assert '<' not in out
    assert '>' not in out
    assert '/' not in out


def test_whitespace_collapsing() -> None:
    out = normalize_search_text('   kpop    música  ')
    assert '  ' not in out  # sem dupla


# ── Idempotência / determinismo ──────────────────────────────────────────────


def test_idempotent() -> None:
    """Inv 1 — determinismo. f(f(x)) == f(x)."""
    for sample in ['k-pop', 'BTS no Brasil', 'Beyoncé', 'k-pop hip-hop']:
        once = normalize_search_text(sample)
        twice = normalize_search_text(once)
        assert once == twice, f'normalize_search_text não é idempotente para {sample!r}'


def test_deterministic_across_calls() -> None:
    """Mesma input, 100 chamadas → mesma output (sem efeito colateral global)."""
    sample = 'k-pop e Beyoncé no carnaval'
    outputs = {normalize_search_text(sample) for _ in range(100)}
    assert len(outputs) == 1


# ── Simetria signal ↔ service (Inv 2 — alma da feature) ──────────────────────


def test_callable_is_same_in_signal_and_service() -> None:
    """O signal e o service devem importar EXATAMENTE a mesma função.

    Se algum dia alguém criar uma cópia em outro módulo, este test
    falha duro. Isso é o coração da invariante #2.
    """
    from apps.search import services, signals, utils

    # Documentação de invariância: a fonte canônica é apps.search.utils.
    # Modules consumers que precisam normalizar DEVEM importar daqui.
    assert utils.normalize_search_text is normalize_search_text

    # Defesa: services e signals NÃO podem ter redefinição local.
    # Se aparecerem com nome igual, devem ser re-export (mesma identity).
    for mod in (services, signals):
        attr = getattr(mod, 'normalize_search_text', None)
        if attr is not None:
            assert attr is normalize_search_text, (
                f'{mod.__name__} tem cópia de normalize_search_text — '
                'INV 2 violada. Importar de apps.search.utils.'
            )


def test_kpop_query_matches_kpop_indexing() -> None:
    """Cenário concreto da Inv 2: artigo indexado com ``K-Pop`` no título;
    busca com ``kpop`` deve casar pelo termo normalizado comum.

    Como mostrar isso sem Postgres: ambas chamadas geram um conjunto de
    tokens cuja interseção contém ``kpop``.
    """
    indexed_title = normalize_search_text('K-Pop e a geopolítica do som')
    query = normalize_search_text('kpop')
    tokens_a = set(indexed_title.split())
    tokens_b = set(query.split())
    assert tokens_a & tokens_b, (
        f'Tokens não se cruzam — Inv 2 quebrada.\n'
        f'  indexed: {tokens_a}\n  query: {tokens_b}'
    )
