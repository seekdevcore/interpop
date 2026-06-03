"""DTOs do app de busca — stub para Fase 2.

Quando a Fase 2 começar:
    - ``QuerySpec`` (dataclass imutável com query, filters, cursor, limit)
    - ``SearchResultPage`` (items, next_cursor, total_estimate, took_ms)
    - ``ResultItem`` (article_id, slug, title, excerpt, ...)

Manter dataclasses ``frozen=True`` para reforçar determinismo (invariante 1).
"""
from __future__ import annotations
