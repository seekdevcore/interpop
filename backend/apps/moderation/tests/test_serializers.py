"""
Testes de defesa em profundidade dos serializers de moderation.

Hierarquia de banimento (dev > admin > editor > user) — agora RELACIONAL no
ban direto:
  - dev:         imune a todos (superadmin, nunca é alvo);
  - admin:       banível APENAS por um dev;
  - editor/user: banível por admin ou dev.

3 camadas de defesa no ban DIRETO (BanSerializer):
  1. Queryset ator-aware do PrimaryKeyRelatedField — só lista alvos que o ATOR
     pode banir (dev vê admins; admin não).
  2. validate_user_id chama user.can_be_banned_by(actor) — barra escalation
     mesmo se a camada 1 for relaxada.
  3. service ban_user re-checa (test_services / test_ban_hierarchy).

O BanRequest (editor solicita) continua restrito a user/editor via
is_immune_to_ban — editor não solicita ban de dev/admin.
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest

from apps.moderation.serializers import BanRequestSerializer, BanSerializer


def _ctx(actor):
    """Contexto mínimo de serializer com o ator (request.user)."""
    return {'request': SimpleNamespace(user=actor)}


# ── Camada 1: queryset ator-aware ────────────────────────────────────────────

@pytest.mark.parametrize('actor_fixture', ['admin_user', 'dev_user'])
def test_queryset_excludes_dev_target_for_any_actor(request, actor_fixture, dev_user):
    """Dev NUNCA é alvo, nem para um ator dev."""
    actor = request.getfixturevalue(actor_fixture)
    s = BanSerializer(data={'user_id': str(dev_user.id), 'reason': 'x'}, context=_ctx(actor))
    assert not s.is_valid()
    assert 'user_id' in s.errors


def test_queryset_excludes_admin_target_for_admin_actor(admin_user, db):
    """Admin não pode nem selecionar outro admin (só dev pode)."""
    from apps.users.models import User
    target = User.objects.create_user(
        email='admin2@interpop.test', password='Interpop#2026',
        username='admin2', first_name='Admin', last_name='Dois', role=User.Role.ADMIN,
    )
    s = BanSerializer(data={'user_id': str(target.id), 'reason': 'x'}, context=_ctx(admin_user))
    assert not s.is_valid()
    assert 'user_id' in s.errors


def test_queryset_includes_admin_target_for_dev_actor(dev_user, admin_user):
    """Dev (superadmin) PODE banir admin — admin aparece no queryset."""
    s = BanSerializer(data={'user_id': str(admin_user.id), 'reason': 'abuso'}, context=_ctx(dev_user))
    assert s.is_valid(), s.errors


# ── Camada 2: validate_user_id (relacional, defesa em profundidade) ──────────

def test_validate_blocks_admin_banning_admin_even_if_queryset_relaxed(admin_user, db):
    """Mesmo relaxando o queryset, validate barra admin→admin."""
    from apps.users.models import User
    target = User.objects.create_user(
        email='admin3@interpop.test', password='Interpop#2026',
        username='admin3', first_name='Admin', last_name='Três', role=User.Role.ADMIN,
    )
    s = BanSerializer(data={'user_id': str(target.id), 'reason': 'x'}, context=_ctx(admin_user))
    s.fields['user_id'].queryset = User.objects.all()  # bypass camada 1
    assert not s.is_valid()
    msg = str(s.errors['user_id']).lower()
    assert 'dev' in msg or 'imune' in msg


def test_validate_blocks_banning_dev_even_for_dev_actor(dev_user):
    """Dev é imune a todos — inclusive a outro dev / a si mesmo."""
    from apps.users.models import User
    s = BanSerializer(data={'user_id': str(dev_user.id), 'reason': 'x'}, context=_ctx(dev_user))
    s.fields['user_id'].queryset = User.objects.all()
    assert not s.is_valid()
    assert 'user_id' in s.errors


# ── Casos felizes: editor e reader são alvos legítimos (ator admin) ──────────

@pytest.mark.parametrize('target_fixture', ['editor_user', 'reader_user'])
def test_admin_can_target_editor_and_reader(request, target_fixture, admin_user):
    target = request.getfixturevalue(target_fixture)
    s = BanSerializer(
        data={'user_id': str(target.id), 'reason': 'spam de fato'},
        context=_ctx(admin_user),
    )
    assert s.is_valid(), s.errors


# ── Defensivo: usuário já banido não pode ser banido duas vezes ──────────────

def test_ban_serializer_rejects_already_banned_user(reader_user, admin_user):
    from apps.moderation.services import ban_user
    ban_user(target=reader_user, admin=admin_user, reason='first')
    s = BanSerializer(
        data={'user_id': str(reader_user.id), 'reason': 'second'},
        context=_ctx(admin_user),
    )
    # Queryset filtra is_banned=False → usuário banido nem aparece (camada 1).
    assert not s.is_valid()


# ── BanRequestSerializer: editor não solicita ban de dev/admin (inalterado) ──

@pytest.mark.parametrize('fixture_name', ['dev_user', 'admin_user'])
def test_ban_request_serializer_rejects_immune_target(request, fixture_name):
    target = request.getfixturevalue(fixture_name)
    serializer = BanRequestSerializer(data={
        'target_id': str(target.id),
        'reason': 'test',
    })
    assert not serializer.is_valid()
    assert 'target_id' in serializer.errors


def test_ban_request_serializer_rejects_duplicate_pending(reader_user, editor_user):
    from apps.moderation.models import BanRequest
    BanRequest.objects.create(target=reader_user, requested_by=editor_user, reason='spam')
    serializer = BanRequestSerializer(data={
        'target_id': str(reader_user.id),
        'reason': 'spam 2',
    })
    assert not serializer.is_valid()
    msg = str(serializer.errors['target_id'])
    assert 'pendente' in msg.lower(), f'Mensagem inesperada: {msg}'
