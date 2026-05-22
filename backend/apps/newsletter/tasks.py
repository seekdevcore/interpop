"""
Tasks Celery do app newsletter.

send_article_notification: wrapper async do service interno
_dispatch_article_notification_sync (newsletter/services.py). View/signal
chamava sync; agora enfileira. Service permanece como helper
síncrono para a própria task — não deve ser chamado de view ou admin
(use .delay() pra não bloquear o request).
"""
from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    max_retries=2,   # email pra subscribers é menos crítico que reset; 2 tentativas
)
def send_article_notification(self, article_id: str) -> None:
    """Carrega artigo pelo ID e dispara notificação pros subscribers.

    Carrega via DB porque entre o enqueue (signal post_save) e exec
    podem passar segundos — quero o estado atual do artigo. Se o
    artigo foi deletado (caso raro), task no-op e retorna."""
    # Import local pra evitar circular import com signals
    from apps.articles.models import Article
    from apps.newsletter.services import _dispatch_article_notification_sync

    try:
        article = Article.objects.get(pk=article_id)
    except Article.DoesNotExist:
        logger.warning('Article %s not found — likely deleted before task ran', article_id)
        return

    sent, failed = _dispatch_article_notification_sync(article)
    logger.info(
        'Article notification dispatched for %s: sent=%d failed=%d',
        article.slug, sent, failed,
    )


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    max_retries=3,
)
def send_welcome_email(self, subscriber_id: str) -> None:
    """Envia welcome email pra novo subscriber. Carrega via DB pelo ID
    pra obter token de unsubscribe + nome no template (service espera
    o objeto NewsletterSubscriber inteiro, não só o email)."""
    from apps.newsletter.models import NewsletterSubscriber
    from apps.newsletter.services import send_welcome as send_welcome_sync

    try:
        subscriber = NewsletterSubscriber.objects.get(pk=subscriber_id)
    except NewsletterSubscriber.DoesNotExist:
        logger.warning('Subscriber %s not found — likely unsubscribed', subscriber_id)
        return

    send_welcome_sync(subscriber)
    logger.info('Welcome email enqueued to %s', subscriber.email)
