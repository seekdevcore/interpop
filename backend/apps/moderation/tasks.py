"""
Tasks Celery do app moderation.

notify_admins_on_new_ban_request: signal post_save de BanRequest
PENDING delega pra cá. Antes era send_mail síncrono no request thread
do redator — atrasava o submit. Agora retorna instantâneo, email vai
em background.
"""
from __future__ import annotations

import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    max_retries=3,
)
def notify_admins_on_new_ban_request(self, ban_request_id: str) -> None:
    """Carrega BanRequest pelo ID e envia 1 email pra cada admin ativo.

    Carrega via DB porque o signal pode disparar antes da transação
    commitar — recarregar dentro da task garante estado consistente."""
    from apps.users.models import User
    from apps.moderation.models import BanRequest

    try:
        request_obj = BanRequest.objects.select_related('target', 'requested_by').get(
            pk=ban_request_id,
        )
    except BanRequest.DoesNotExist:
        logger.warning('BanRequest %s not found — likely rejected before task ran', ban_request_id)
        return

    # Inclui DEV (dono): por design dev é "admin++" e decide BanRequest. Sem
    # ele, se o único superusuário for role=dev, NINGUÉM recebe a notificação.
    admins = list(
        User.objects.filter(
            role__in=[User.Role.ADMIN, User.Role.DEV], is_active=True
        ).values_list('email', flat=True)
    )
    if not admins:
        logger.info('No active admins/devs to notify of BanRequest %s', ban_request_id)
        return

    requester = (
        request_obj.requested_by.full_name if request_obj.requested_by else 'Sistema'
    )
    target = request_obj.target.full_name if request_obj.target else 'usuário'
    target_email = request_obj.target.email if request_obj.target else '—'
    site_url = getattr(settings, 'SITE_URL', 'http://localhost:5173')

    subject = f'[Interpop] Nova solicitação de banimento — {target}'
    body = (
        f'Uma nova solicitação de banimento foi criada e aguarda decisão.\n\n'
        f'Solicitada por: {requester}\n'
        f'Alvo:           {target} ({target_email})\n\n'
        f'Motivo:\n{request_obj.reason}\n\n'
        + (
            f'Mensagem que originou:\n{request_obj.trigger_message}\n\n'
            if request_obj.trigger_message else ''
        )
        + f'Revisar em: {site_url}/admin (aba Solicitações)\n'
    )

    send_mail(
        subject=subject,
        message=body,
        from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@interpop.com'),
        recipient_list=admins,
        fail_silently=False,  # task captura e retenta
    )
    logger.info(
        'Notified %d admin(s) of BanRequest %s', len(admins), ban_request_id,
    )
