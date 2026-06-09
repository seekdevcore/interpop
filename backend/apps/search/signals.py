"""Signals do app de busca — invalidação de cache (Task T30.1.5c).

**Invariante ADR-018 (DURA)**: este módulo NUNCA escreve em
``SearchIndex``. A sincronia ``Article → SearchIndex`` é feita pela
TRIGGER POSTGRES ``trg_articles_sync_search`` (migration 0003 + 0005
ENABLE ALWAYS). Trigger é a fonte de verdade da consistência.

O que este módulo faz: ao detectar mutação em ``Article`` (post_save ou
post_delete), apaga o cache Redis ``search:v1:*`` para forçar a próxima
request a recomputar a partir do banco já atualizado pela trigger.

Não é necessário filtrar por ``status='published'`` aqui:

    - Rebaixar published → draft muda o conjunto de resultados.
    - Adicionar draft cria potencial futura linha em search_index.
    - Apagar published remove linha.

Em todos os casos a busca anterior está stale. Invalidação total é
mais simples e segura que parcial neste estágio (volume de mutação
em Article é baixo — N artigos/dia).

Referências:

    - ADR-018 §"Trigger = fonte de verdade; signal só cache invalidation"
    - ADR-037 §"Cache key inclui auth_tier" — invalidação é total, não por
      tier (rationale: tier afeta KEY, não conteúdo da resposta)
    - SECURITY-REVIEW H-04
"""
from __future__ import annotations

import logging

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.articles.models import Article

from .cache import invalidate_all_search_cache


logger = logging.getLogger('interpop.search.signals')


@receiver(post_save, sender=Article, dispatch_uid='search.invalidate_on_save')
def _invalidate_on_article_save(sender, instance, created, **kwargs):
    """Invalida cache em CADA save de Article (publish, edit, unpublish)."""
    n = invalidate_all_search_cache()
    logger.info(
        'search.cache.invalidated.on_save',
        extra={
            'article_id': str(instance.pk),
            # 'created' colide com LogRecord.created — usar 'is_new'.
            'is_new': created,
            'status': instance.status,
            'keys_removed': n,
        },
    )


@receiver(post_delete, sender=Article, dispatch_uid='search.invalidate_on_delete')
def _invalidate_on_article_delete(sender, instance, **kwargs):
    """Invalida cache em delete de Article (artigo some da projeção)."""
    n = invalidate_all_search_cache()
    logger.info(
        'search.cache.invalidated.on_delete',
        extra={'article_id': str(instance.pk), 'keys_removed': n},
    )
