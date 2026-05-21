"""
Tasks Celery do app users.

Tasks aqui são fire-and-forget pelo view/signal e executam em worker
separado. Em dev (CELERY_TASK_ALWAYS_EAGER=True), rodam síncronas no
request thread — mesmo comportamento do código pré-Celery.

Convenção: task carrega IDs (não objetos), recarrega via DB. Celery
serializa JSON e Django models não são JSON-serializáveis. Bônus: se
o objeto mudar entre enqueue e exec, a task vê o estado atualizado.
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
    retry_backoff_max=300,   # cap em 5min entre tentativas
    retry_jitter=True,        # ±25% pra evitar thundering herd
    max_retries=3,
)
def send_password_reset_email(self, user_email: str, token: str) -> None:
    """Envia email de redefinição de senha.

    Não busca user via DB (token já garante existência no momento do
    enqueue). Só precisa do email + token pra montar o link.

    Retry em qualquer Exception (SMTP timeout, auth fail transiente,
    rate limit do SendGrid). 3 tentativas com backoff exponencial:
    ~60s, ~120s, ~240s. Após 3, dropa silenciosamente — usuário pode
    pedir reset de novo via UI."""
    site_url  = getattr(settings, 'SITE_URL', 'http://localhost:5173')
    reset_url = f'{site_url}/redefinir-senha/{token}'
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@interpop.com')

    send_mail(
        subject='[Interpop] Redefinição de senha',
        message=(
            f'Você solicitou a redefinição da sua senha.\n\n'
            f'Clique no link abaixo para criar uma nova senha '
            f'(válido por 1 hora):\n\n'
            f'{reset_url}\n\n'
            f'Se não foi você, ignore este e-mail.'
        ),
        from_email=from_email,
        recipient_list=[user_email],
        fail_silently=False,   # task captura a exception e retenta
    )
    logger.info('Password reset email enqueued to %s', user_email)
