"""
Testes do PasswordComplexityValidator.

Política de segurança (alinhada ao checklist do frontend): toda senha nova
precisa ter, além do mínimo de 8 caracteres (MinimumLengthValidator do Django),
ao menos 1 MAIÚSCULA, 1 minúscula, 1 dígito e 1 caractere especial do conjunto
@$!%*?&#. Cobre Register, troca de senha e reset (todos chamam validate_password).
"""
from __future__ import annotations

import pytest
from django.core.exceptions import ValidationError

from apps.users.validators import PasswordComplexityValidator


def _validate(pw: str) -> None:
    PasswordComplexityValidator().validate(pw)


def test_valid_password_passes():
    # upper + lower + dígito + especial, 8+ chars
    _validate('Senha123#')


@pytest.mark.parametrize(
    'pw,faltando',
    [
        ('senha123#', 'maiúscula'),       # sem upper
        ('SENHA123#', 'minúscula'),       # sem lower
        ('SenhaAbc#', 'número'),          # sem dígito
        ('Senha1234', 'especial'),        # sem especial
    ],
)
def test_missing_class_raises(pw, faltando):
    with pytest.raises(ValidationError):
        _validate(pw)


def test_accepts_each_special_char_in_set():
    # Cada caractere do conjunto declarado (@$!%*?&#) satisfaz a regra de especial
    for ch in '@$!%*?&#':
        _validate(f'Senha12{ch}')


def test_error_message_lists_missing_requirements():
    try:
        _validate('senha')  # falta upper, dígito e especial
    except ValidationError as e:
        joined = ' '.join(e.messages).lower()
        assert 'maiúscula' in joined
        assert 'número' in joined or 'dígito' in joined
        assert 'especial' in joined
    else:
        pytest.fail('esperava ValidationError')


@pytest.mark.django_db
def test_wired_into_django_validate_password():
    """O validator está plugado em AUTH_PASSWORD_VALIDATORS (settings)."""
    from django.contrib.auth.password_validation import validate_password

    with pytest.raises(ValidationError):
        validate_password('semcomplexidade')  # sem upper/dígito/especial
    # senha forte passa por todos os validators
    validate_password('Interpop2026#')
