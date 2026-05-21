"""
Signals do app moderation.

post_save em BanRequest PENDING enfileira task Celery que envia email
pros admins ativos. Lógica de montagem do email vive em
apps/moderation/tasks.py — signal aqui só decide *quando* enfileirar.

Falha silenciosa no enqueue: erro de Redis/broker não deve impedir o
redator de submeter a solicitação (ela vai aparecer no /admin de
qualquer jeito).
"""
import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import BanRequest

logger = logging.getLogger(__name__)


@receiver(post_save, sender=BanRequest)
def notify_admins_on_new_request(
    sender, instance: BanRequest, created: bool, **kwargs,
) -> None:
    """Enfileira task de notificação quando BanRequest PENDING nasce."""
    if not created or instance.status != BanRequest.Status.PENDING:
        return

    try:
        from apps.moderation.tasks import notify_admins_on_new_ban_request
        notify_admins_on_new_ban_request.delay(ban_request_id=str(instance.pk))
    except Exception:
        logger.exception('Failed to enqueue BanRequest notification task')
