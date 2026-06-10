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


# ── BUG-1: cover URL absoluta em article notification (CONCERNS / F-40) ──────


@pytest.fixture
def category(db):
    """Pega a primeira Category disponível (seeded em migration 0003).

    Migration 0003 cria 5 categorias com slugify(name, allow_unicode=True).
    Música vira slug 'música' (não 'musica'), por isso buscamos por nome.
    """
    from apps.articles.models import Category
    return Category.objects.get(name='Música')


@pytest.fixture
def author(db):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    return User.objects.create_user(
        username='autora',
        email='autora@interpop.com',
        password='S3nh@Forte!2026',
    )


@pytest.fixture
def article_with_cover(db, category, author):
    """Article com cover_image simulada (sem subir arquivo real)."""
    from apps.articles.models import Article
    from django.utils import timezone
    from django.core.files.uploadedfile import SimpleUploadedFile

    article = Article.objects.create(
        title='K-pop como Soft Power',
        slug='kpop-como-soft-power',
        excerpt='Análise editorial sobre Soft Power asiático.',
        body='Corpo do artigo.',
        author=author,
        category=category,
        status='published',
        published_at=timezone.now(),
    )
    article.cover_image = SimpleUploadedFile(
        'cover.jpg',
        b'\xff\xd8\xff\xe0fake-jpeg',
        content_type='image/jpeg',
    )
    article.save()
    return article


def test_article_notification_uses_absolute_cover_url(
    subscriber, article_with_cover, settings
):
    """Fix BUG-1: cover_image em email deve ser URL ABSOLUTA com SITE_URL.

    Antes do fix: template usava `{{ article.cover_image.url }}` direto, que
    retorna `/media/articles/cover.jpg` (caminho relativo, MEDIA_URL Django).
    Clientes de email NÃO resolvem caminhos relativos contra base — todos os
    subscribers viam placeholder broken-image em TODA notificação.

    Após fix: ctx do service tem `cover_image_absolute_url` = SITE_URL +
    .url. Template usa essa var.
    """
    settings.SITE_URL = 'https://interpop.com'

    from apps.newsletter.services import _dispatch_article_notification_sync

    with patch(
        'apps.newsletter.services.EmailMultiAlternatives'
    ) as mock_msg_cls:
        mock_msg = mock_msg_cls.return_value
        sent, failed = _dispatch_article_notification_sync(
            article_with_cover, subscribers=[subscriber],
        )

    assert sent == 1 and failed == 0

    # Captura o HTML attached para verificar a URL absoluta
    attach_calls = mock_msg.attach_alternative.call_args_list
    assert attach_calls, 'esperado attach_alternative chamado'
    html_body = attach_calls[0][0][0]

    assert 'https://interpop.com/media/' in html_body or (
        f'https://interpop.com{article_with_cover.cover_image.url}' in html_body
    ), (
        f'cover_image deve aparecer com URL absoluta no email. '
        f'HTML render: {html_body[:500]}'
    )
    # E NÃO deve aparecer URL relativa começando com /media/ sem host
    relative_marker = f'src="{article_with_cover.cover_image.url}"'
    assert relative_marker not in html_body, (
        f'cover_image NÃO deve estar como URL relativa. Found: {relative_marker}'
    )
