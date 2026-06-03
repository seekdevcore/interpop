"""Cache helpers da busca — separação por ``auth_tier`` (ADR-037 / H-04).

SECURITY-REVIEW H-04 (CWE-524): cache key SEM ``auth_tier`` mistura
respostas de usuário anônimo e autenticado. Esta camada garante
KEYS distintas por tier mesmo para o mesmo ``QuerySpec``.

Formato da key::

    search:v1:<tier>:<sha256_hex>

- ``search:v1:`` — prefix versionado, consumido pelo
  ``cache.delete_pattern('search:v1:*')`` no signal de invalidação
  (ADR-037).
- ``<tier>`` ∈ {``anon``, ``user``} — separa pools.
- ``<sha256_hex>`` — hash hex da canonical query string (q normalizado +
  filtros + cursor + per_page).

Invariante (testada): mesma input + tier → mesma key; tier diferente → key
diferente; tier desconhecido → ``ValueError`` (não fallback silencioso).
"""
from __future__ import annotations

import hashlib
import json
from typing import Final, Literal

from .dto import QuerySpec
from .utils import normalize_search_text


CACHE_KEY_PREFIX: Final[str] = 'search:v1:'

AuthTier = Literal['anon', 'user']
_VALID_TIERS: Final[frozenset[AuthTier]] = frozenset({'anon', 'user'})


def canonical_query_string(spec: QuerySpec) -> str:
    """Serializa a parte "stable" do spec para hashing.

    NÃO inclui ``cursor`` aqui — o cursor é incluído explicitamente em
    :func:`build_cache_key` (porque cada página da mesma query deve ter
    cache key própria, mas o cursor não faz parte do "shape" semântico
    da busca).

    Saída JSON ordenada por chave (determinístico cross-versão Python).
    """
    payload = {
        'q': normalize_search_text(spec.q),
        'author_id': str(spec.author_id) if spec.author_id else None,
        'category_id': spec.category_id,
        'de': spec.de.isoformat() if spec.de else None,
        'ate': spec.ate.isoformat() if spec.ate else None,
        'per_page': spec.per_page,
    }
    return json.dumps(payload, sort_keys=True, separators=(',', ':'))


def build_cache_key(spec: QuerySpec, *, auth_tier: AuthTier) -> str:
    """Constrói a cache key para ``(spec, auth_tier)``.

    Args:
        spec: :class:`QuerySpec` validado.
        auth_tier: ``'anon'`` para anônimo, ``'user'`` para autenticado.
            **Não há outros valores** — admin/editor não têm tier separado
            (busca é leitura pública sem dados personalizados; ADR-037
            invariante "response function-pure de (q, filters, cursor)").

    Returns:
        ``search:v1:<tier>:<sha256_hex>``.

    Raises:
        ValueError: tier fora de ``{'anon', 'user'}`` — fail-fast em vez
            de cair em pool comum silenciosamente (defesa H-04).
    """
    if auth_tier not in _VALID_TIERS:
        raise ValueError(
            f"auth_tier inválido: {auth_tier!r}. "
            f"Esperado um de {sorted(_VALID_TIERS)}. "
            "Tier desconhecido em fallback silencioso = vetor H-04."
        )
    # Inclui o cursor aqui — páginas distintas da mesma query merecem
    # cache keys distintas (cada página = response shape distinto).
    payload_str = canonical_query_string(spec)
    cursor_part = spec.cursor or ''
    digest = hashlib.sha256(
        (payload_str + '|cursor=' + cursor_part).encode('utf-8'),
    ).hexdigest()
    return f'{CACHE_KEY_PREFIX}{auth_tier}:{digest}'
