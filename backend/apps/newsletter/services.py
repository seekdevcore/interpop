"""
Newsletter sending helpers — build branded HTML + plain-text emails from
the templates in `apps/newsletter/templates/newsletter/emails/`.

Both helpers always send a **multipart/alternative** message (HTML + plain
text) for deliverability: spam filters penalize HTML-only messages.

The article notification helper is intentionally *not* triggered by a
post_save signal — per-article alerts spam subscribers. It's invoked
manually from a Django admin action, so the editor decides which posts
warrant a push.
"""
from __future__ import annotations

from typing import Iterable

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

from .models import NewsletterSubscriber


def _site_url() -> str:
    return getattr(settings, 'SITE_URL', 'http://localhost:5173')


def _from_email() -> str:
    return getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@interpop.com')


def _unsubscribe_url(subscriber: NewsletterSubscriber) -> str:
    return f"{_site_url()}/newsletter/cancelar/{subscriber.unsubscribe_token}"


def send_welcome(subscriber: NewsletterSubscriber) -> bool:
    """Send the welcome / confirmation email to a single subscriber.

    Returns True on success, False on any failure (errors are swallowed so
    a misconfigured SMTP server can never break the public subscribe flow).
    """
    ctx = {
        'site_url':        _site_url(),
        'unsubscribe_url': _unsubscribe_url(subscriber),
    }
    try:
        html = render_to_string('newsletter/emails/welcome.html', ctx)
        text = render_to_string('newsletter/emails/welcome.txt',  ctx)
        msg = EmailMultiAlternatives(
            subject='Bem-vindo(a) ao Interpop',
            body=text,
            from_email=_from_email(),
            to=[subscriber.email],
        )
        msg.attach_alternative(html, 'text/html')
        msg.send(fail_silently=False)
        return True
    except Exception:
        return False


def _dispatch_article_notification_sync(
    article,
    *,
    subscribers: Iterable[NewsletterSubscriber] | None = None,
) -> tuple[int, int]:
    """Send a single-article alert to active subscribers (SYNCHRONOUS).

    Underscore prefix + `_sync` suffix sinaliza que este helper bloqueia
    o caller no envio SMTP. NÃO chamar de views ou handlers HTTP — use
    a task Celery `apps.newsletter.tasks.send_article_notification`
    (`.delay(article_id=...)`). Este helper existe para a task wrapper
    poder reusar a lógica de render + loop de envio.

    Rename feito no C11 da reorganization-proposal: antes era homônimo
    da task (`send_article_notification` em ambos services + tasks),
    forçando alias awkward em importadores.

    `subscribers` lets the caller scope the send (e.g. a single test
    address). Default = every active subscriber.

    Returns `(sent_count, failed_count)`.
    """
    site_url   = _site_url()
    article_url = f"{site_url}/noticia/{article.slug}"
    from_email = _from_email()
    if subscribers is None:
        subscribers = NewsletterSubscriber.objects.filter(is_active=True)

    sent = 0
    failed = 0
    for sub in subscribers:
        ctx = {
            'article':         article,
            'article_url':     article_url,
            'site_url':        site_url,
            'unsubscribe_url': _unsubscribe_url(sub),
        }
        try:
            html = render_to_string('newsletter/emails/article_notification.html', ctx)
            text = render_to_string('newsletter/emails/article_notification.txt',  ctx)
            msg = EmailMultiAlternatives(
                subject=article.title,
                body=text,
                from_email=from_email,
                to=[sub.email],
            )
            msg.attach_alternative(html, 'text/html')
            msg.send(fail_silently=False)
            sent += 1
        except Exception:
            failed += 1
    return sent, failed
