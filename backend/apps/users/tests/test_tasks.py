"""
Testes da task send_password_reset_email — security flow crítico
(A20-A22 do Improvement-system §11.2 + ADR-009).

Em EAGER mode (default em dev/CI), task roda síncrona no thread do test.
Capturamos o envio via django.core.mail.outbox (mailbox in-memory).
"""
from __future__ import annotations

import pytest
from django.core import mail

from apps.users.tasks import send_password_reset_email

# CELERY_TASK_ALWAYS_EAGER=True está no development.py default.
pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _use_locmem_email_backend(settings):
    """Força locmem backend nos testes deste módulo — guarda mails em
    mail.outbox em vez de tentar enviar via console/SMTP. Aplica a todos
    os testes do arquivo via autouse."""
    settings.EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'


def test_send_password_reset_email_dispatches_to_target():
    """Task com email + token válidos envia 1 message com link de reset."""
    mail.outbox.clear()
    send_password_reset_email.delay(
        user_email='alvo@interpop.test',
        token='abc-123-fake-uuid',
    )

    assert len(mail.outbox) == 1
    msg = mail.outbox[0]
    assert msg.to == ['alvo@interpop.test']
    assert 'Interpop' in msg.subject
    assert 'abc-123-fake-uuid' in msg.body
    assert '/redefinir-senha/' in msg.body


def test_send_password_reset_email_includes_validity_warning():
    """Body deve mencionar prazo de 1h (security hygiene — usuário sabe
    que link expira) e o disclaimer 'se não foi você ignore'."""
    mail.outbox.clear()
    send_password_reset_email.delay(
        user_email='outro@interpop.test',
        token='xyz-fake',
    )
    body = mail.outbox[0].body
    assert '1 hora' in body or '1h' in body
    assert 'ignore' in body.lower()


def test_send_password_reset_email_called_via_view_eager(client, reader_user):
    """Smoke E2E: POST no endpoint público dispara o flow inteiro até
    o mail.outbox em EAGER mode. Sem precisar tocar a task diretamente."""
    mail.outbox.clear()
    resp = client.post(
        '/api/v1/auth/password-reset/',
        data={'email': 'leitor@interpop.test'},
        content_type='application/json',
    )
    assert resp.status_code == 200
    # Response NÃO confirma se enviou (anti-enumeration) — confirmamos via outbox
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ['leitor@interpop.test']


def test_send_password_reset_email_not_sent_for_unknown_user(client, db):
    """Email inexistente: response 200 (anti-enumeration), MAS nenhum
    email é enviado — defesa em profundidade (PasswordResetRequestSerializer
    NÃO cria token pra user inexistente)."""
    mail.outbox.clear()
    resp = client.post(
        '/api/v1/auth/password-reset/',
        data={'email': 'naoexiste@interpop.test'},
        content_type='application/json',
    )
    assert resp.status_code == 200
    assert len(mail.outbox) == 0
