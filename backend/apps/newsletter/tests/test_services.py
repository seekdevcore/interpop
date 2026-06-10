"""Tests do `apps.newsletter.services`.

Foco: garantir que `send_welcome` PROPAGA exceções (fix BUG-2 do CONCERNS).

Antes do fix: `send_welcome` envolvia `msg.send(fail_silently=False)` num
`try/except Exception: return False`. Resultado: falhas de SMTP eram
engolidas E **matavam o `autoretry_for=(Exception,)`** do wrapper Celery
`send_welcome_email`. Subscriber nunca recebia welcome e ninguém sabia.

Após o fix: exceções propagam para o Celery autoretry (3 tentativas com
backoff). Se todas as 3 falham, registro Sentry alerta. Logs ficam
explícitos. Operador entende que SMTP está quebrado.
"""
from __future__ import annotations

from unittest.mock import patch

import pytest

from apps.newsletter.models import NewsletterSubscriber
from apps.newsletter.services import send_welcome


@pytest.fixture
def subscriber(db) -> NewsletterSubscriber:
    return NewsletterSubscriber.objects.create(
        email='leitor@example.com',
        is_active=True,
    )


def test_send_welcome_returns_true_on_success(subscriber):
    """Caminho feliz: SMTP entrega → retorna True."""
    with patch(
        'apps.newsletter.services.EmailMultiAlternatives.send',
        return_value=1,
    ) as mock_send:
        assert send_welcome(subscriber) is True
        # Confirma que fail_silently=False (queremos que erros propaguem)
        mock_send.assert_called_once_with(fail_silently=False)


def test_send_welcome_propagates_smtp_error_to_caller(subscriber):
    """Fix BUG-2: falha SMTP deve propagar para o Celery autoretry pegar.

    Antes: try/except Exception engolia tudo e retornava False, matando
    o autoretry_for=(Exception,) do wrapper task `send_welcome_email`.
    Agora: exceção escapa, Celery faz retry conforme política.
    """
    from smtplib import SMTPServerDisconnected

    with patch(
        'apps.newsletter.services.EmailMultiAlternatives.send',
        side_effect=SMTPServerDisconnected('Connection unexpectedly closed'),
    ):
        with pytest.raises(SMTPServerDisconnected):
            send_welcome(subscriber)


def test_send_welcome_propagates_generic_exception(subscriber):
    """Defesa em profundidade: qualquer Exception propaga (não só SMTP)."""
    with patch(
        'apps.newsletter.services.render_to_string',
        side_effect=RuntimeError('template malformado'),
    ):
        with pytest.raises(RuntimeError, match='template malformado'):
            send_welcome(subscriber)
