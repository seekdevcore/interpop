"""Signals do app de busca — stub para Fase 2.

IMPORTANTE (ADR-018): o signal Python NUNCA escreve em ``SearchIndex``. A
sincronia ``Article → SearchIndex`` é feita pela TRIGGER POSTGRES
``trg_articles_sync_search`` (migration ``0003_search_triggers``).

Este módulo existe apenas para hospedar futuramente a invalidação de cache
Redis pós-mutação de ``Article``. Implementação na Fase 2 (T30.1.5c)::

    @receiver([post_save, post_delete], sender=Article)
    def invalidate_search_cache(sender, instance, **kwargs):
        cache.delete_pattern('search:v1:*')
"""
from __future__ import annotations
