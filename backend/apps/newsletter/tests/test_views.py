"""
Testes E2E do app newsletter — subscribe + unsubscribe + welcome email + reativação.

Cobertura prioritária (D2 do reorganization-proposal):
- Subscribe: cria active=True + dispara welcome via Celery (EAGER em dev/test).
- Subscribe duplicado (mesmo email): retorna 200 + reativa se estava inactive.
- Unsubscribe via token: marca is_active=False (NÃO deleta — preserva audit).
- Unsubscribe com token inválido: 400.
- Subscribe normaliza email: lowercase + strip.

Regressões prevenidas:
- Subscribe 2× com mesmo email NÃO duplica linha (get_or_create).
- Email já cancelado pode ser re-subscrito.
- Token "queimado" (já usado) não permite double-unsubscribe que vazaria 500.
"""
from __future__ import annotations

from unittest.mock import patch

from apps.newsletter.models import NewsletterSubscriber

SUBSCRIBE_URL   = '/api/v1/newsletter/subscribe/'
UNSUBSCRIBE_URL = '/api/v1/newsletter/unsubscribe/'


# ── Subscribe ────────────────────────────────────────────────────────────────


def test_subscribe_creates_active_subscriber(db, client):
    resp = client.post(SUBSCRIBE_URL, {'email': 'novo@interpop.test'}, content_type='application/json')
    assert resp.status_code == 200
    assert 'sucesso' in resp.json()['detail'].lower()

    sub = NewsletterSubscriber.objects.get(email='novo@interpop.test')
    assert sub.is_active is True
    assert sub.unsubscribe_token is not None


def test_subscribe_normalizes_email_lowercase_strip(db, client):
    """REGRESSÃO: emails com case-mix ou whitespace devem normalizar antes
    do get_or_create — senão 'GabrielTest@x.com' e 'gabrieltest@x.com'
    viram dois registros diferentes."""
    client.post(SUBSCRIBE_URL, {'email': '  GabrielTest@INTERPOP.test  '}, content_type='application/json')
    # Salvo normalizado (lowercase + strip)
    assert NewsletterSubscriber.objects.filter(email='gabrieltest@interpop.test').exists()
    # NÃO existe versão com case original
    assert not NewsletterSubscriber.objects.filter(email='GabrielTest@INTERPOP.test').exists()


def test_subscribe_duplicate_email_returns_200_and_does_not_duplicate(db, client):
    """Subscribe 2× com mesmo email: idempotente — não cria registro extra."""
    NewsletterSubscriber.objects.create(email='ja-tem@interpop.test')
    resp = client.post(SUBSCRIBE_URL, {'email': 'ja-tem@interpop.test'}, content_type='application/json')
    assert resp.status_code == 200
    assert NewsletterSubscriber.objects.filter(email='ja-tem@interpop.test').count() == 1


def test_subscribe_reactivates_inactive_subscriber(db, client):
    """Cancelei → mudei de ideia → re-subscrevo: deve reativar a MESMA linha
    (preservando token original) em vez de criar nova."""
    old = NewsletterSubscriber.objects.create(
        email='voltou@interpop.test', is_active=False,
    )
    resp = client.post(SUBSCRIBE_URL, {'email': 'voltou@interpop.test'}, content_type='application/json')
    assert resp.status_code == 200

    old.refresh_from_db()
    assert old.is_active is True
    # Mensagem distinta para reativação (UX informa que estava cancelado)
    assert 'reativ' in resp.json()['detail'].lower() or 'já' in resp.json()['detail'].lower()


def test_subscribe_invalid_email_returns_400(db, client):
    resp = client.post(SUBSCRIBE_URL, {'email': 'nao-eh-email'}, content_type='application/json')
    assert resp.status_code == 400


def test_subscribe_missing_email_returns_400(db, client):
    resp = client.post(SUBSCRIBE_URL, {}, content_type='application/json')
    assert resp.status_code == 400


def test_subscribe_dispatches_welcome_email_task(db, client):
    """ADR-009: welcome email vai via Celery task.
    Patch o .delay() pra confirmar enqueue + payload correto."""
    with patch('apps.newsletter.views.send_welcome_email.delay') as mock_delay:
        resp = client.post(SUBSCRIBE_URL, {'email': 'welcome@interpop.test'}, content_type='application/json')
        assert resp.status_code == 200
        # Task enfileirada exatamente uma vez com subscriber_id
        assert mock_delay.call_count == 1
        # subscriber_id é a UUID stringificada
        sub = NewsletterSubscriber.objects.get(email='welcome@interpop.test')
        mock_delay.assert_called_once_with(subscriber_id=str(sub.pk))


# ── Unsubscribe ──────────────────────────────────────────────────────────────


def test_unsubscribe_with_valid_token_marks_inactive(db, client):
    sub = NewsletterSubscriber.objects.create(email='tchau@interpop.test')
    resp = client.post(
        UNSUBSCRIBE_URL,
        {'token': str(sub.unsubscribe_token)},
        content_type='application/json',
    )
    assert resp.status_code == 200
    sub.refresh_from_db()
    assert sub.is_active is False
    # NÃO deletado — audit preserved
    assert NewsletterSubscriber.objects.filter(pk=sub.pk).exists()


def test_unsubscribe_with_invalid_token_returns_400(db, client):
    import uuid
    resp = client.post(
        UNSUBSCRIBE_URL,
        {'token': str(uuid.uuid4())},
        content_type='application/json',
    )
    assert resp.status_code == 400


def test_unsubscribe_already_cancelled_token_returns_400(db, client):
    """REGRESSÃO: double-unsubscribe NÃO pode levantar 500.
    Token já queimado (subscriber.is_active=False) deve retornar 400
    com mensagem amigável."""
    sub = NewsletterSubscriber.objects.create(
        email='ja-cancelou@interpop.test', is_active=False,
    )
    resp = client.post(
        UNSUBSCRIBE_URL,
        {'token': str(sub.unsubscribe_token)},
        content_type='application/json',
    )
    assert resp.status_code == 400


def test_unsubscribe_missing_token_returns_400(db, client):
    resp = client.post(UNSUBSCRIBE_URL, {}, content_type='application/json')
    assert resp.status_code == 400


def test_unsubscribe_malformed_token_returns_400(db, client):
    resp = client.post(
        UNSUBSCRIBE_URL,
        {'token': 'not-a-uuid'},
        content_type='application/json',
    )
    assert resp.status_code == 400


# ── End-to-end: subscribe → unsubscribe → resubscribe ────────────────────────


def test_subscribe_unsubscribe_resubscribe_full_cycle(db, client):
    """Ciclo completo: a UUID do token DEVE permanecer estável entre
    cancelamento e reativação (o link da newsletter antiga continua válido
    em qualquer email já enviado)."""
    email = 'cycle@interpop.test'
    # 1. Subscribe
    client.post(SUBSCRIBE_URL, {'email': email}, content_type='application/json')
    sub = NewsletterSubscriber.objects.get(email=email)
    original_token = sub.unsubscribe_token

    # 2. Unsubscribe
    client.post(
        UNSUBSCRIBE_URL, {'token': str(original_token)}, content_type='application/json',
    )
    sub.refresh_from_db()
    assert sub.is_active is False
    assert sub.unsubscribe_token == original_token  # token preservado

    # 3. Re-subscribe (reativa mesma linha)
    client.post(SUBSCRIBE_URL, {'email': email}, content_type='application/json')
    sub.refresh_from_db()
    assert sub.is_active is True
    assert sub.unsubscribe_token == original_token  # token AINDA preservado
