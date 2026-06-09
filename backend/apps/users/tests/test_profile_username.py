"""
Testes da edição de username via PATCH /api/v1/auth/me/.

Regras: username é editável no perfil, case é PRESERVADO (Intetsu_Gabe fica
Intetsu_Gabe), unicidade é case-insensitive, e o próprio usuário pode reenviar
o seu username atual sem falso conflito (self-exclusion).
"""
from __future__ import annotations

import pytest

ME_URL = '/api/v1/auth/me/'


@pytest.mark.django_db
def test_user_can_change_own_username_case_preserved(reader_user, authed_client_factory):
    api = authed_client_factory(reader_user)
    resp = api.patch(ME_URL, {'username': 'Intetsu_Gabe'}, format='json')
    assert resp.status_code == 200, resp.content
    assert resp.json()['username'] == 'Intetsu_Gabe'  # case preservado
    reader_user.refresh_from_db()
    assert reader_user.username == 'Intetsu_Gabe'


@pytest.mark.django_db
def test_username_uniqueness_is_case_insensitive(reader_user, editor_user, authed_client_factory):
    # editor_user já tem um username; reader tenta tomar uma variante só-de-caixa
    taken = editor_user.username
    api = authed_client_factory(reader_user)
    resp = api.patch(ME_URL, {'username': taken.upper()}, format='json')
    assert resp.status_code == 400
    assert 'username' in resp.json()


@pytest.mark.django_db
def test_user_can_resubmit_own_username(reader_user, authed_client_factory):
    # Reenviar o próprio username (self-exclusion) não pode dar conflito
    reader_user.username = 'Intetsu_Gabe'
    reader_user.save(update_fields=['username'])
    api = authed_client_factory(reader_user)
    resp = api.patch(ME_URL, {'username': 'Intetsu_Gabe'}, format='json')
    assert resp.status_code == 200, resp.content


@pytest.mark.django_db
def test_username_rejects_spaces_and_symbols(reader_user, authed_client_factory):
    api = authed_client_factory(reader_user)
    resp = api.patch(ME_URL, {'username': 'nome com espaco'}, format='json')
    assert resp.status_code == 400
    assert 'username' in resp.json()
