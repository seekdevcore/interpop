"""SearchService — implementação adiada para a Fase 2 (Sprint 4).

Este arquivo é stub intencional. A Fase 1 entrega apenas o schema DB (tabelas,
índices, triggers, vacuum tuning). A query orquestrada (CTE candidate-narrowing,
ts_rank_cd com recency decay, cursor HMAC base64, 12 invariantes do
DESIGN §2.3) será implementada na Fase 2 (T30.1.7).

Quando a Fase 2 começar:
    - Adicionar :class:`QuerySpec` (dto.py)
    - Adicionar :func:`SearchService.query(spec) -> SearchResultPage`
    - Honrar os 12 invariantes do DESIGN §2.3 (determinismo, normalização
      simétrica, plainto_tsquery, status filter, cursor HMAC, etc.)
"""
from __future__ import annotations
