import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone

from .managers import UserManager


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        DEV    = 'dev',    'Dev'              # dono/criador — todo poder do admin + IMUNE a ban
        ADMIN  = 'admin',  'Administrador'   # poder total — incluindo banir (também imune a ban)
        EDITOR = 'editor', 'Editor'           # publica artigos + solicita ban
        USER   = 'user',   'Leitor'           # cadastro público; só lê/comenta/curte

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email      = models.EmailField(unique=True, db_index=True)
    username   = models.CharField(max_length=150, unique=True, db_index=True)
    first_name = models.CharField(max_length=150)
    last_name  = models.CharField(max_length=150)
    role       = models.CharField(max_length=10, choices=Role.choices, default=Role.USER, db_index=True)
    bio        = models.TextField(blank=True)
    avatar     = models.ImageField(upload_to='avatars/%Y/%m/', null=True, blank=True)

    is_active  = models.BooleanField(default=True)
    is_staff   = models.BooleanField(default=False)
    is_banned  = models.BooleanField(default=False, db_index=True)

    date_joined = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']

    objects = UserManager()

    class Meta:
        db_table = 'users'
        ordering = ['-date_joined']
        indexes = [
            models.Index(fields=['role', 'is_active', 'is_banned']),
        ]

    def __str__(self) -> str:
        return self.email

    @property
    def full_name(self) -> str:
        return f'{self.first_name} {self.last_name}'.strip()

    @property
    def avatar_initial(self) -> str:
        return (self.first_name[:1] or self.email[:1]).upper()

    @property
    def is_dev(self) -> bool:
        return self.role == self.Role.DEV

    @property
    def is_admin(self) -> bool:
        """Inclui Dev: dev é admin++. Endpoints com IsAdminUser aceitam ambos."""
        return self.role in (self.Role.ADMIN, self.Role.DEV)

    @property
    def is_editor(self) -> bool:
        return self.role == self.Role.EDITOR

    @property
    def can_publish(self) -> bool:
        """Dev, admin e editor podem publicar artigos. Usuário leitor não."""
        return self.role in (self.Role.DEV, self.Role.ADMIN, self.Role.EDITOR)

    @property
    def is_immune_to_ban(self) -> bool:
        """Imune a SOLICITAÇÃO de ban (BanRequest, feita por editor): dev e
        admin nunca podem ser alvo de pedido de banimento. O ban DIRETO usa a
        regra relacional `can_be_banned_by` (dev pode banir admin)."""
        return self.role in (self.Role.DEV, self.Role.ADMIN)

    def can_be_banned_by(self, actor: 'User | None') -> bool:
        """Quem pode banir quem, na hierarquia dev > admin > editor > user:
          - dev:        NUNCA banível (superadmin, imune a todos);
          - admin:      banível APENAS por um dev;
          - editor/user: banível por admin ou dev.
        O banidor precisa ser admin/dev e ninguém bane a si mesmo. Esta é a
        regra do ban DIRETO — relacional (depende do ator, não só do alvo)."""
        if actor is None or not getattr(actor, 'is_authenticated', False):
            return False
        if actor.pk == self.pk:
            return False
        if not actor.is_admin:            # só admin/dev banem diretamente
            return False
        if self.role == self.Role.DEV:    # dev é imune a todos
            return False
        if self.role == self.Role.ADMIN:  # admin só pode ser banido por um dev
            return actor.is_dev
        return True                        # editor/user: ok para admin ou dev

    def can_be_unbanned_by(self, actor: 'User | None') -> bool:
        """Quem pode DESBANIR quem — mesma hierarquia do ban (por role do alvo):
        admin só é desbanível por dev; editor/user por admin ou dev. Impede que
        um admin comum DESFAÇA a punição que um dev aplicou sobre um admin
        (anularia a regra pelo lado inverso)."""
        return self.can_be_banned_by(actor)


class PasswordResetToken(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user       = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='password_reset_tokens',
    )
    token      = models.UUIDField(unique=True, default=uuid.uuid4, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used    = models.BooleanField(default=False, db_index=True)

    class Meta:
        db_table = 'password_reset_tokens'
        indexes  = [models.Index(fields=['token', 'is_used'])]

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=1)
        super().save(*args, **kwargs)

    @property
    def is_valid(self) -> bool:
        return not self.is_used and timezone.now() < self.expires_at

    def __str__(self):
        return f'PasswordResetToken for {self.user_id}'
