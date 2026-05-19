"""
Signals do app moderation.

Dispara email pros admins quando uma nova BanRequest entra em status PENDING.
Falha silenciosa: erro de SMTP não deve impedir o redator de submeter a
solicitação (ela vai aparecer no /admin de qualquer jeito).
"""
import logging

from django.conf import settings
from django.core.mail import send_mail
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.users.models import User
from .models import BanRequest

logger = logging.getLogger(__name__)


@receiver(post_save, sender=BanRequest)
def notify_admins_on_new_request(sender, instance: BanRequest, created: bool, **kwargs) -> None:
    """Envia 1 email pra cada admin ativo quando uma BanRequest PENDING nasce."""
    if not created or instance.status != BanRequest.Status.PENDING:
        return

    admins = list(
        User.objects
        .filter(role=User.Role.ADMIN, is_active=True)
        .values_list('email', flat=True)
    )
    if not admins:
        return

    requester = instance.requested_by.full_name if instance.requested_by else 'Sistema'
    target    = instance.target.full_name if instance.target else 'usuário'
    site_url  = getattr(settings, 'SITE_URL', 'http://localhost:5173')

    subject = f'[Interpop] Nova solicitação de banimento — {target}'
    body    = (
        f'Uma nova solicitação de banimento foi criada e aguarda decisão.\n\n'
        f'Solicitada por: {requester}\n'
        f'Alvo:           {target} ({instance.target.email if instance.target else "—"})\n\n'
        f'Motivo:\n{instance.reason}\n\n'
        + (f'Mensagem que originou:\n{instance.trigger_message}\n\n' if instance.trigger_message else '')
        + f'Revisar em: {site_url}/admin (aba Solicitações)\n'
    )

    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@interpop.com'),
            recipient_list=admins,
            fail_silently=True,
        )
    except Exception:
        logger.exception('Falha ao notificar admins de nova BanRequest')
