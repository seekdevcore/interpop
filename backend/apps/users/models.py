import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone

from .managers import UserManager


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        ADMIN  = 'admin',  'Administrador'   # poder total — incluindo banir
        EDITOR = 'editor', 'Redator'          # publica artigos + solicita ban
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
    def is_admin(self) -> bool:
        return self.role == self.Role.ADMIN

    @property
    def is_editor(self) -> bool:
        return self.role == self.Role.EDITOR

    @property
    def can_publish(self) -> bool:
        """Admin e editor podem publicar artigos. Usuário leitor não."""
        return self.role in (self.Role.ADMIN, self.Role.EDITOR)


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
