# Squash de 0003+0004+0005 (C15 do reorganization-proposal).
#
# As 3 migrations originais alteravam o mesmo campo User.role:
#   0003: adicionou choices [admin, editor, user]
#   0004: renomeou label 'user' display "Usuário" → "Leitor"
#   0005: adicionou role 'dev' como primeira opção
#
# `replaces` permite que ambientes que já rodaram 0003-0005 reconheçam
# esta migration como já-aplicada (Django marca como done sem re-executar).
# Ambientes fresh aplicam só esta com o estado final.
from django.db import migrations, models


class Migration(migrations.Migration):

    replaces = [
        ('users', '0003_alter_user_role'),
        ('users', '0004_alter_user_role'),
        ('users', '0005_alter_user_role'),
    ]

    dependencies = [
        ('users', '0002_passwordresettoken'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(
                choices=[
                    ('dev',    'Dev'),
                    ('admin',  'Administrador'),
                    ('editor', 'Redator'),
                    ('user',   'Leitor'),
                ],
                db_index=True,
                default='user',
                max_length=10,
            ),
        ),
    ]
