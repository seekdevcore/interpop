"""
Tests da task notify_admins_on_new_ban_request.

Regressão: a query de destinatários filtrava só role=ADMIN, excluindo DEV
(dono, que é admin++ e decide BanRequests). Se o único superusuário fosse
role=dev, ninguém recebia a notificação de solicitação de ban.
"""
from __future__ import annotations

import pytest
from django.core import mail

from apps.moderation.models import BanRequest
from apps.moderation.tasks import notify_admins_on_new_ban_request


@pytest.mark.django_db
def test_notification_includes_dev(dev_user, editor_user, reader_user):
    """Dev (dono) deve receber a notificação de novo BanRequest."""
    br = BanRequest.objects.create(
        target=reader_user, requested_by=editor_user, reason='spam recorrente',
    )
    mail.outbox.clear()  # descarta o que o signal post_save já enviou
    notify_admins_on_new_ban_request(str(br.id))

    recipients = [addr for m in mail.outbox for addr in m.to]
    assert dev_user.email in recipients, (
        f'dev não notificado. Destinatários: {recipients}'
    )


@pytest.mark.django_db
def test_notification_includes_both_admin_and_dev(
    dev_user, admin_user, editor_user, reader_user,
):
    """Admin E dev recebem (ambos decidem BanRequest)."""
    br = BanRequest.objects.create(
        target=reader_user, requested_by=editor_user, reason='conteúdo abusivo',
    )
    mail.outbox.clear()
    notify_admins_on_new_ban_request(str(br.id))

    recipients = [addr for m in mail.outbox for addr in m.to]
    assert dev_user.email in recipients
    assert admin_user.email in recipients
