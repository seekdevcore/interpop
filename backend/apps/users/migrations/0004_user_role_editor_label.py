# Altera o label de exibição da role EDITOR de "Redator" para "Editor".
# Só muda o choices.label (sem DDL — CharField não materializa choices no banco).
#
# Nome propositalmente != "0004_alter_user_role": a squash 0003_user_role_choices
# já reserva esse nome no seu `replaces`, então reusá-lo criaria ciclo no grafo.
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_user_role_choices'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(
                choices=[
                    ('dev',    'Dev'),
                    ('admin',  'Administrador'),
                    ('editor', 'Editor'),
                    ('user',   'Leitor'),
                ],
                db_index=True,
                default='user',
                max_length=10,
            ),
        ),
    ]
