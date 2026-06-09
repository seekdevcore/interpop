"""
Hierarquia de banimento — dev é superadmin e o ÚNICO que bane admins.

Regra (dev > admin > editor > user):
  - dev:         imune a todos (nunca é alvo de ban);
  - admin:       banível APENAS por um dev;
  - editor/user: banível por admin ou dev;
  - ninguém bane a si mesmo; só admin/dev banem diretamente.

Cobre as 3 camadas: model (can_be_banned_by), endpoint (POST /bans/) e o
efeito real (is_banned). O contrário NÃO acontece: admin não bane dev nem
outro admin.
"""
from __future__ import annotations

import pytest

from apps.users.models import User

BANS_URL = '/api/v1/moderation/bans/'


@pytest.fixture
def admin2(db) -> User:
    return User.objects.create_user(
        email='admin2@interpop.test', password='Interpop#2026',
        username='admin2', first_name='Admin', last_name='Dois', role=User.Role.ADMIN,
    )


@pytest.fixture
def dev2(db) -> User:
    return User.objects.create_user(
        email='dev2@interpop.test', password='Interpop#2026',
        username='dev2', first_name='Dev', last_name='Dois', role=User.Role.DEV,
    )


# ── Camada 1: model can_be_banned_by (matriz exaustiva) ──────────────────────

@pytest.mark.django_db
def test_can_be_banned_by_matrix(dev_user, dev2, admin_user, admin2, editor_user, reader_user):
    # dev é imune a TODOS (inclusive outro dev e ele mesmo)
    assert dev_user.can_be_banned_by(admin_user) is False
    assert dev_user.can_be_banned_by(dev2) is False
    assert dev_user.can_be_banned_by(dev_user) is False

    # admin: SÓ por dev
    assert admin_user.can_be_banned_by(dev_user) is True
    assert admin_user.can_be_banned_by(admin2) is False   # outro admin não
    assert admin_user.can_be_banned_by(admin_user) is False  # nem a si mesmo
    assert admin_user.can_be_banned_by(editor_user) is False

    # editor / user: por admin OU dev; não por editor; nem None
    for target in (editor_user, reader_user):
        assert target.can_be_banned_by(admin_user) is True
        assert target.can_be_banned_by(dev_user) is True
        assert target.can_be_banned_by(editor_user) is False
        assert target.can_be_banned_by(None) is False


# ── Camada 2+3: endpoint POST /bans/ (full stack) ────────────────────────────

@pytest.mark.django_db
def test_dev_can_ban_admin(dev_user, admin_user, authed_client_factory):
    api = authed_client_factory(dev_user)
    resp = api.post(BANS_URL, {'user_id': str(admin_user.id), 'reason': 'abuso de poder'}, format='json')
    assert resp.status_code == 201, resp.content
    admin_user.refresh_from_db()
    assert admin_user.is_banned is True


@pytest.mark.django_db
def test_admin_cannot_ban_another_admin(admin_user, admin2, authed_client_factory):
    api = authed_client_factory(admin_user)
    resp = api.post(BANS_URL, {'user_id': str(admin2.id), 'reason': 'x'}, format='json')
    assert resp.status_code == 400
    admin2.refresh_from_db()
    assert admin2.is_banned is False


@pytest.mark.django_db
def test_admin_cannot_ban_dev(admin_user, dev_user, authed_client_factory):
    api = authed_client_factory(admin_user)
    resp = api.post(BANS_URL, {'user_id': str(dev_user.id), 'reason': 'x'}, format='json')
    assert resp.status_code == 400
    dev_user.refresh_from_db()
    assert dev_user.is_banned is False


@pytest.mark.django_db
def test_dev_cannot_ban_another_dev(dev_user, dev2, authed_client_factory):
    api = authed_client_factory(dev_user)
    resp = api.post(BANS_URL, {'user_id': str(dev2.id), 'reason': 'x'}, format='json')
    assert resp.status_code == 400
    dev2.refresh_from_db()
    assert dev2.is_banned is False


@pytest.mark.django_db
def test_admin_can_still_ban_editor(admin_user, editor_user, authed_client_factory):
    """Regressão: comportamento antigo (admin bane editor/user) preservado."""
    api = authed_client_factory(admin_user)
    resp = api.post(BANS_URL, {'user_id': str(editor_user.id), 'reason': 'spam'}, format='json')
    assert resp.status_code == 201, resp.content
    editor_user.refresh_from_db()
    assert editor_user.is_banned is True


@pytest.mark.django_db
def test_editor_cannot_reach_ban_endpoint(editor_user, reader_user, authed_client_factory):
    """Editor não bane direto (IsAdminUser) — só solicita via BanRequest."""
    api = authed_client_factory(editor_user)
    resp = api.post(BANS_URL, {'user_id': str(reader_user.id), 'reason': 'x'}, format='json')
    assert resp.status_code == 403


# ── UNBAN: a hierarquia vale também no sentido inverso ───────────────────────

@pytest.mark.django_db
def test_admin_cannot_unban_dev_placed_ban_on_admin(dev_user, admin_user, admin2, authed_client_factory):
    """Dev bane admin → um admin comum NÃO pode desfazer (DELETE → 403)."""
    from apps.moderation.services import ban_user
    ban = ban_user(target=admin_user, admin=dev_user, reason='abuso')
    api = authed_client_factory(admin2)
    resp = api.delete(f'{BANS_URL}{ban.pk}/')
    assert resp.status_code == 403
    admin_user.refresh_from_db()
    assert admin_user.is_banned is True


@pytest.mark.django_db
def test_dev_can_unban_admin(dev_user, admin_user, authed_client_factory):
    from apps.moderation.services import ban_user
    ban = ban_user(target=admin_user, admin=dev_user, reason='abuso')
    api = authed_client_factory(dev_user)
    resp = api.delete(f'{BANS_URL}{ban.pk}/')
    assert resp.status_code in (200, 204), resp.content
    admin_user.refresh_from_db()
    assert admin_user.is_banned is False


@pytest.mark.django_db
def test_admin_can_unban_editor(admin_user, editor_user, authed_client_factory):
    """Regressão: admin segue podendo desbanir editor/user."""
    from apps.moderation.services import ban_user
    ban = ban_user(target=editor_user, admin=admin_user, reason='spam')
    api = authed_client_factory(admin_user)
    resp = api.delete(f'{BANS_URL}{ban.pk}/')
    assert resp.status_code in (200, 204), resp.content
    editor_user.refresh_from_db()
    assert editor_user.is_banned is False
