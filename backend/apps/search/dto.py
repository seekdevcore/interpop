"""DTOs (frozen dataclasses) da busca editorial.

Imutabilidade aqui reforça a **invariante #1 do algorithms specialist**
(determinismo): se o caller não pode mutar a spec depois de construída,
o teste property-based "mesma input → mesma ordem" se sustenta.

DTOs canônicos:

    - :class:`QuerySpec`         — input do ``SearchService.query()``
    - :class:`CursorPayload`     — tupla decodificada do cursor HMAC
    - :class:`ResultItem`        — 1 item da resposta (dict-shape friendly)
    - :class:`SearchResultPage`  — output do ``SearchService.query()``

Convenção: nenhum método de domínio aqui. DTOs são "data only". Lógica de
ranking, sorting, paginação fica em ``services.py``. Lógica de
encode/decode HMAC fica em ``cursors.py`` (módulo separado para isolar
secret access).
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


# ── Query input ──────────────────────────────────────────────────────────────


@dataclass(frozen=True, slots=True)
class QuerySpec:
    """Input imutável do :func:`SearchService.query`.

    Campos seguem 1:1 a query string do endpoint (ADR-023).

    Args:
        q: texto bruto da busca (antes de :func:`normalize_search_text`).
            Validação 2 ≤ len ≤ 200 fica no serializer.
        author_id: filtro opcional por UUID do autor.
        category_id: filtro opcional por ID de categoria (BIGINT).
        de: lower bound de ``published_at``.
        ate: upper bound de ``published_at``.
        cursor: cursor HMAC opaco (base64). ``None`` = primeira página.
        per_page: tamanho da página (default 20, max 50 — validado no
            serializer).
    """

    q: str
    author_id: uuid.UUID | None = None
    category_id: int | None = None
    de: datetime | None = None
    ate: datetime | None = None
    cursor: str | None = None
    per_page: int = 20


# ── Cursor payload ───────────────────────────────────────────────────────────


@dataclass(frozen=True, slots=True)
class CursorPayload:
    """Tupla decodificada do cursor HMAC.

    Carrega o ESTADO MÍNIMO necessário para tuple comparison estável na CTE
    `scored` (algorithms §7):

        (score, published_at, article_id) < (cursor_score, cursor_pub, cursor_id)

    Inv #6 — ``score`` é o valor já com ``ROUND(6)`` aplicado, simétrico
    com o que sai do SELECT. Float drift na 15ª casa quebrava paginação.

    Inv #9 — ``depth`` é o nº de páginas já navegadas. Server rejeita >50
    com 400 ``refine_query`` (defesa A3 anti-paginação profunda).
    """

    score: float
    published_at: datetime
    article_id: uuid.UUID
    depth: int


# ── Result item / page ───────────────────────────────────────────────────────


@dataclass(frozen=True, slots=True)
class ResultItem:
    """1 artigo na resposta da busca.

    Campos seguem o response shape do ADR-023 §"Endpoint contract".

    ``author`` e ``category`` são dicts pequenos (id + display + slug),
    NÃO entidades ORM — anti N+1 já resolvido no service via
    ``select_related`` + side-fetch ``in_bulk``.
    """

    article_id: uuid.UUID
    title: str
    slug: str
    excerpt: str
    published_at: datetime
    author: dict[str, Any]
    category: dict[str, Any] | None
    cover_url: str | None
    score: float


@dataclass(frozen=True, slots=True)
class SearchResultPage:
    """Output completo do :func:`SearchService.query`.

    Args:
        results: tupla de :class:`ResultItem` na ordem do ranking.
        next_cursor: cursor HMAC base64 da próxima página, ou ``None`` se
            esgotou (``hasMore`` deriva de ``next_cursor is not None``).
        total_estimate: estimativa via EXPLAIN ROWS (ADR-025).
        query_terms_expanded: stems pt-BR via ``ts_lexize`` (Inv #11), para
            highlighting client-side correto.
        took_ms: latência do service (DB + CTE + encode), excluindo
            serialização DRF.
    """

    results: tuple[ResultItem, ...] = field(default_factory=tuple)
    next_cursor: str | None = None
    total_estimate: int = 0
    query_terms_expanded: tuple[str, ...] = field(default_factory=tuple)
    took_ms: int = 0
