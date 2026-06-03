"""Utilitários da busca editorial — normalização lexical simétrica.

A única função aqui (:func:`normalize_search_text`) é o coração da
**invariante #2** do algorithms specialist:

    > A mesma função normaliza a STRING DE INDEXAÇÃO e a STRING DE QUERY.
    > Drift entre as duas = busca composta quebra silenciosamente.

Por isso ela vive em ``apps.search.utils`` (fonte canônica) e tanto o
serviço (``SearchService.query()``) quanto o signal de cache invalidation
importam DAQUI — não reimplementam.

Escopo desta função (intencional e mínimo):
    - lowercase (case-fold)
    - strip de pontuação preservando alfanuméricos pt-BR (acentos OK,
      pois o Postgres aplica ``unaccent`` no tsvector via configuração
      ``pt_unaccent`` — ADR-019)
    - geração de **variante sem hífen** para termos compostos (``k-pop`` →
      ``k-pop kpop``). Isso resolve o caso 1.5 do algorithms §4
      ("``k-pop`` vs ``kpop`` NÃO casa sem normalização extra")
    - colapso de whitespace

Fora do escopo (faz o Postgres):
    - stemming (``portuguese_stem`` / ``ts_lexize``)
    - remoção de stopwords (config ``portuguese``)
    - unaccent (config ``pt_unaccent``)
"""
from __future__ import annotations

import re
from typing import Final


# Whitelist de caracteres alfanuméricos (latino básico + acentos pt-BR),
# espaço e hífen. Tudo o mais é removido (incluindo <, >, /, &, " — defesa em
# profundidade contra reflexão de input no ``query_terms_expanded``: SECURITY
# H-01).
_ALLOWED_CHARS_RE: Final[re.Pattern[str]] = re.compile(
    r'[^a-z0-9À-ſ\s\-]', re.IGNORECASE,
)

# Detecta termos hifenizados (``k-pop``, ``hip-hop``) para gerar a variante
# sem hífen no mesmo string. ``\b`` exige palavra completa nos dois lados.
_HYPHEN_TERM_RE: Final[re.Pattern[str]] = re.compile(r'\b(\w+)-(\w+)\b')

# Whitespace múltiplo (incluindo \t, \n) → 1 espaço.
_WHITESPACE_RE: Final[re.Pattern[str]] = re.compile(r'\s+')


def normalize_search_text(text: str) -> str:
    """Normaliza texto para uso simétrico em indexing + query.

    Inv #2 do algorithms specialist (``_specialist-outputs/02-algorithms-architect.md
    §8``): tanto a trigger SQL (via Article → search_index) quanto o
    ``SearchService.query()`` (via ``plainto_tsquery``) operam sobre a saída
    desta função. Mudar a regra aqui sem repropagar = quebra silenciosa de
    toda busca composta.

    Args:
        text: input cru — pode ser ``None`` no caller; aqui assumimos string
            (o caller defende ``None``). Pode conter qualquer Unicode.

    Returns:
        String normalizada (lowercase, sem pontuação, hífens preservados +
        variantes sem hífen geradas, whitespace colapsado). Pode ser ``''``
        se o input só tinha pontuação / emoji / whitespace.

    Examples:
        >>> normalize_search_text('K-Pop e Beyoncé')
        'k-pop kpop e beyoncé'
        >>> normalize_search_text('  HIP-HOP   brasileiro  ')
        'hip-hop hiphop brasileiro'
        >>> normalize_search_text('<script>alert(1)</script>')
        'scriptalert1scriptscript'
        >>> normalize_search_text('')
        ''

    Note:
        A variante sem hífen é INSERIDA DEPOIS do termo original, separada
        por espaço. O Postgres tokeniza por whitespace, então ambos viram
        tokens independentes — tanto no tsvector quanto no tsquery.
    """
    if not text:
        return ''
    # 1. Lowercase primeiro — facilita regex e garante determinismo.
    out = text.lower()
    # 2. Strip de caracteres fora da whitelist (mantém acento pt-BR).
    out = _ALLOWED_CHARS_RE.sub('', out)
    # 3. Gera variante sem hífen para CADA termo hifenizado.
    #    "k-pop" → "k-pop kpop"; "hip-hop" → "hip-hop hiphop"
    out = _HYPHEN_TERM_RE.sub(r'\1-\2 \1\2', out)
    # 4. Colapsa whitespace e strip das pontas.
    out = _WHITESPACE_RE.sub(' ', out).strip()
    # 5. Dedup tokens preservando ordem (defesa de idempotência: f(f(x))==f(x)
    #    — sem isso, segunda chamada gera "k-pop kpop kpop" ao re-expandir
    #    o k-pop pré-existente).
    seen: set[str] = set()
    deduped: list[str] = []
    for token in out.split():
        if token not in seen:
            seen.add(token)
            deduped.append(token)
    return ' '.join(deduped)
