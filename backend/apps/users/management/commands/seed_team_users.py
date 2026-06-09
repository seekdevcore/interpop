"""
Seed das contas oficiais do time Interpop — 1 admin + 3 editores.

Management command idiomático (roda igual em dev e prod via
`manage.py seed_team_users`), idempotente e seguro.

Senhas dos editores: geradas aleatórias no runtime (cripto-seguras, no padrão
de complexidade da app) e impressas UMA vez — você captura, distribui e cada
um troca depois. Login é por e-mail (USERNAME_FIELD='email'); o username é só
o @handle público, editável no perfil.

ATENÇÃO: as senhas são impressas em stdout. NUNCA rode este comando em CI/CD
ou pipeline de deploy — o stdout vira log persistente (GitHub Actions,
journald). É um comando MANUAL/operacional.

Senha da conta oficial (interpop.cc@gmail.com, role=admin):
  - por padrão também é aleatória;
  - para definir uma senha FIXA sem expô-la em `ps`/histórico do shell, use a
    env var INTERPOP_ADMIN_PASSWORD ou a flag --prompt-interpop-password
    (pergunta via getpass, sem eco). NUNCA passe a senha como argumento de CLI;
  - a senha fixa passa por AUTH_PASSWORD_VALIDATORS (mesma política do
    cadastro/troca) — senha fraca é recusada com erro antes de tocar no banco.

Unicidade: e-mail e username são UNIQUE no banco (modelo User). "Senha única"
não existe (hash PBKDF2 tem salt por senha — senhas iguais geram hashes
diferentes); o que garantimos é senha DISTINTA por usuário.

Idempotente: quem já existe (por e-mail) é PULADO (não recria, não mexe em
senha/role/username). --reset-passwords regenera a senha. Cada usuário roda em
seu próprio savepoint: colisão de username (handle já usado por outra conta)
isola aquele item, sem derrubar os demais.

Exemplos:
    uv run python manage.py seed_team_users
    uv run python manage.py seed_team_users --reset-passwords
    INTERPOP_ADMIN_PASSWORD='SenhaForte#2026' uv run python manage.py seed_team_users
    uv run python manage.py seed_team_users --prompt-interpop-password
"""
from __future__ import annotations

import getpass
import os
import secrets
import string

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import IntegrityError, transaction

from apps.users.models import User
from apps.users.validators import SPECIAL_CHARS

# email, username (@handle), nome, role. last_name vazio em conta institucional.
TEAM = [
    {'email': 'interpop.cc@gmail.com',     'username': 'interpop', 'first_name': 'Interpop', 'last_name': '',             'role': User.Role.ADMIN,  'official': True},
    {'email': 'raicabernardo06@gmail.com', 'username': 'raica',    'first_name': 'Raica',    'last_name': 'Bernardo',     'role': User.Role.EDITOR},
    {'email': 'cceciliavp@gmail.com',      'username': 'cecilia',  'first_name': 'Cecília',  'last_name': 'Vieira Pinto', 'role': User.Role.EDITOR},
    {'email': 'davidhrpereira@gmail.com',  'username': 'david',    'first_name': 'David',    'last_name': 'Pereira',      'role': User.Role.EDITOR},
]

_ALPHABET = string.ascii_letters + string.digits + SPECIAL_CHARS


def gen_password(n: int = 16) -> str:
    """Senha aleatória cripto-segura garantindo upper+lower+dígito+especial."""
    while True:
        pw = ''.join(secrets.choice(_ALPHABET) for _ in range(n))
        if (
            any(c.isupper() for c in pw)
            and any(c.islower() for c in pw)
            and any(c.isdigit() for c in pw)
            and any(c in SPECIAL_CHARS for c in pw)
        ):
            return pw


class Command(BaseCommand):
    help = 'Cria as contas oficiais do time (admin + editores) com senhas aleatórias impressas no runtime. Comando manual — não rodar em CI/CD.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset-passwords', action='store_true',
            help='Regenera e imprime a senha mesmo para usuários que já existem.',
        )
        parser.add_argument(
            '--prompt-interpop-password', action='store_true',
            help='Pergunta a senha do admin oficial via getpass (sem eco/argv). '
                 'Alternativa: env INTERPOP_ADMIN_PASSWORD.',
        )

    def _resolve_interpop_password(self, opts) -> str | None:
        """Senha fixa do admin oficial — via env var ou getpass, NUNCA por argv
        (argv vaza em `ps` e no histórico do shell). None => gera aleatória."""
        env = os.environ.get('INTERPOP_ADMIN_PASSWORD')
        if env:
            return env
        if opts['prompt_interpop_password']:
            pw = getpass.getpass('Senha do admin oficial (interpop): ').strip()
            if not pw:
                raise CommandError('Senha vazia — abortado.')
            return pw
        return None

    def handle(self, *args, **opts):
        reset = opts['reset_passwords']
        interpop_pw = self._resolve_interpop_password(opts)

        # Valida a senha fixa do admin ANTES de tocar no banco (fail fast, mesma
        # política dos serializers). Usuário transitório p/ o UserAttribute-
        # SimilarityValidator funcionar (compara senha com email/username/nome).
        if interpop_pw:
            spec = next(s for s in TEAM if s.get('official'))
            probe = User(
                email=spec['email'], username=spec['username'],
                first_name=spec['first_name'], last_name=spec['last_name'],
            )
            try:
                validate_password(interpop_pw, user=probe)
            except DjangoValidationError as e:
                raise CommandError('Senha do interpop inválida: ' + ' '.join(e.messages))

        rows = []
        for spec in TEAM:
            uname = spec['username']
            shown = None
            try:
                # Savepoint por usuário: uma colisão de UNIQUE (username já em
                # uso por OUTRA conta) reverte só este item — não os demais.
                with transaction.atomic():
                    user, created = User.objects.get_or_create(
                        email=spec['email'],
                        defaults={
                            'username':   spec['username'],
                            'first_name': spec['first_name'],
                            'last_name':  spec['last_name'],
                            'role':       spec['role'],
                        },
                    )
                    uname = user.username
                    if created or reset:
                        pw = interpop_pw if (spec.get('official') and interpop_pw) else gen_password()
                        user.set_password(pw)
                        user.save(update_fields=['password', 'updated_at'])
                        shown, status = pw, ('criado' if created else 'senha resetada')
                    else:
                        status = 'já existe (pulado)'
                        if spec.get('official') and interpop_pw:
                            self.stdout.write(self.style.WARNING(
                                '  AVISO: senha do interpop NÃO aplicada — a conta já existe. '
                                'Use --reset-passwords para forçar a troca.'
                            ))
            except IntegrityError:
                status = 'ERRO: username/e-mail já usado por outra conta (pulado)'

            rows.append((status, spec['role'], spec['email'], uname, shown))

        self.stdout.write('')
        self.stdout.write('  STATUS                          | ROLE   | EMAIL                        | USERNAME   | SENHA (anote!)')
        self.stdout.write('  ' + '-' * 110)
        for status, role, email, username, shown in rows:
            self.stdout.write(
                f'  {status:31} | {role:6} | {email:28} | {username:10} | {shown or "—"}'
            )
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(
            'OK. Senhas mostradas só agora — anote e distribua com segurança. '
            'Login é por e-mail; cada um troca senha/username no perfil.'
        ))
