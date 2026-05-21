"""
Auto-send the newsletter article notification when a post transitions to
"published" (either created as published or moved from draft → published).

Editor-driven sends remain a fallback via the admin action; this signal
covers the default flow where editors publish straight from the front-end
"Nova publicação" form.

Sync delivery via Django's send_mail/EmailMultiAlternatives is acceptable
for the project's current subscriber volume. For high-volume sends this
should be queued (Celery/Django-Q) — fail_silently inside services.py
already isolates the request thread from SMTP outages.
"""
from __future__ import annotations

import logging

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from .models import Article

logger = logging.getLogger(__name__)

_PREV_STATUS_ATTR = '_prev_status'


@receiver(pre_save, sender=Article)
def _capture_previous_status(sender, instance: Article, **kwargs) -> None:
    """Snapshot the persisted status before save so post_save can detect
    a draft → published transition. New records get None."""
    if not instance.pk:
        setattr(instance, _PREV_STATUS_ATTR, None)
        return
    try:
        prev = Article.objects.only('status').get(pk=instance.pk)
        setattr(instance, _PREV_STATUS_ATTR, prev.status)
    except Article.DoesNotExist:
        setattr(instance, _PREV_STATUS_ATTR, None)


@receiver(post_save, sender=Article)
def _notify_subscribers_on_publish(sender, instance: Article, created: bool, **kwargs) -> None:
    prev_status = getattr(instance, _PREV_STATUS_ATTR, None)
    now_published = instance.status == Article.Status.PUBLISHED

    became_published = now_published and (created or prev_status != Article.Status.PUBLISHED)
    if not became_published:
        return

    try:
        # ADR-009: enfileira via Celery em vez de chamar síncrono.
        # Em prod (Redis broker) o publisher retorna em <10ms; envio real
        # acontece em worker separado com retry policy. Em dev (EAGER),
        # roda síncrono no thread atual — comportamento idêntico ao
        # pre-Celery, com mesmo shape de tests passando.
        from apps.newsletter.tasks import send_article_notification
        send_article_notification.delay(article_id=str(instance.pk))
        logger.info(
            'Article notification task enqueued for %s', instance.slug,
        )
    except Exception:
        # Enqueue failures must never block the publish flow.
        logger.exception('Failed to enqueue notification task for %s', instance.slug)
