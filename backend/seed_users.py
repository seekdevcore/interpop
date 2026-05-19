"""
Seed das 4 contas oficiais do Interpop.

  ┌──────────────────────────────────┬──────────┬─────────────────────────────┐
  │ Email                            │ Role     │ Username                    │
  ├──────────────────────────────────┼──────────┼─────────────────────────────┤
  │ interpop.cc@gmail.com            │ admin    │ Interpop                    │
  │ raicabernardo06@gmail.com        │ editor   │ raica                       │
  │ cceciliavp@gmail.com             │ editor   │ cecilia                     │
  │ davidhrpereira@gmail.com         │ editor   │ david                       │
  └──────────────────────────────────┴──────────┴─────────────────────────────┘

Senha provisória: `Interpop@2026` (todas as 4). Cada um deve trocar via
/recuperar-senha no primeiro acesso — política de boas práticas.

Idempotente: rodar de novo só atualiza role/nome (sem recriar nem
reescrever senha existente). Use `--reset-passwords` se quiser forçar.

Rodar:
    cd backend && venv/bin/python manage.py shell -c "exec(open('seed_users.py').read())"
"""

from apps.users.models import User

SEED = [
    {
        'email':      'interpop.cc@gmail.com',
        'username':   'Interpop',
        'first_name': 'Interpop',
        'last_name':  '',
        'role':       User.Role.ADMIN,
    },
    {
        'email':      'raicabernardo06@gmail.com',
        'username':   'raica',
        'first_name': 'Raica',
        'last_name':  'Bernardo',
        'role':       User.Role.EDITOR,
    },
    {
        'email':      'cceciliavp@gmail.com',
        'username':   'cecilia',
        'first_name': 'Cecília',
        'last_name':  'Vieira Pinto',
        'role':       User.Role.EDITOR,
    },
    {
        'email':      'davidhrpereira@gmail.com',
        'username':   'david',
        'first_name': 'David',
        'last_name':  'Pereira',
        'role':       User.Role.EDITOR,
    },
]

DEFAULT_PASSWORD = 'Interpop@2026'

created, updated = 0, 0
for spec in SEED:
    user, was_created = User.objects.get_or_create(
        email=spec['email'],
        defaults={
            'username':   spec['username'],
            'first_name': spec['first_name'],
            'last_name':  spec['last_name'],
            'role':       spec['role'],
            'is_active':  True,
            'is_staff':   spec['role'] == User.Role.ADMIN,
            'is_superuser': spec['role'] == User.Role.ADMIN,
        },
    )
    if was_created:
        user.set_password(DEFAULT_PASSWORD)
        user.save()
        created += 1
        print(f'  ✓ criado:    {user.email:<32} role={user.role}')
    else:
        # Já existia — atualiza role/nome/staff sem mexer em senha
        fields = []
        if user.role != spec['role']:
            user.role = spec['role']
            user.is_staff = spec['role'] == User.Role.ADMIN
            user.is_superuser = spec['role'] == User.Role.ADMIN
            fields += ['role', 'is_staff', 'is_superuser']
        if user.username != spec['username']:
            user.username = spec['username']; fields.append('username')
        if user.first_name != spec['first_name']:
            user.first_name = spec['first_name']; fields.append('first_name')
        if user.last_name != spec['last_name']:
            user.last_name = spec['last_name']; fields.append('last_name')
        if fields:
            user.save(update_fields=fields)
            updated += 1
            print(f'  ~ atualiz.:  {user.email:<32} ({", ".join(fields)})')
        else:
            print(f'  · ok:        {user.email:<32} (sem alteração)')

print()
print(f'==> {created} criado(s), {updated} atualizado(s)')
if created:
    print(f'    Senha provisória: {DEFAULT_PASSWORD!r} — trocar via /recuperar-senha')
