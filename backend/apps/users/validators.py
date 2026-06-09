"""
Validators de senha customizados.

PasswordComplexityValidator: exige diversidade de classes de caractere além do
mínimo de comprimento (esse fica a cargo do MinimumLengthValidator do Django).
Espelha o checklist mostrado no frontend para que front e back falhem pelos
MESMOS critérios — senha que passa na UI não pode ser recusada pela API e
vice-versa.
"""
from __future__ import annotations

import re

from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _

# Conjunto de especiais aceitos — idêntico ao regex do frontend (@$!%*?&#).
SPECIAL_CHARS = '@$!%*?&#'


class PasswordComplexityValidator:
    """Requer ao menos 1 maiúscula, 1 minúscula, 1 dígito e 1 caractere especial."""

    def validate(self, password, user=None):
        faltando = []
        if not re.search(r'[A-Z]', password):
            faltando.append(_('uma letra maiúscula'))
        if not re.search(r'[a-z]', password):
            faltando.append(_('uma letra minúscula'))
        if not re.search(r'\d', password):
            faltando.append(_('um número'))
        if not re.search(rf'[{re.escape(SPECIAL_CHARS)}]', password):
            faltando.append(_('um caractere especial (%(chars)s)') % {'chars': SPECIAL_CHARS})

        if faltando:
            raise ValidationError(
                _('A senha precisa conter %(itens)s.') % {'itens': ', '.join(faltando)},
                code='password_no_complexity',
            )

    def get_help_text(self):
        return _(
            'Sua senha precisa conter ao menos uma letra maiúscula, uma minúscula, '
            'um número e um caractere especial (%(chars)s).'
        ) % {'chars': SPECIAL_CHARS}
