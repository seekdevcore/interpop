import uuid
from django.conf import settings
from django.db import models


class BanRequest(models.Model):
    """Solicitação de banimento criada por um redator (role=editor).

    Fluxo:
      1. Redator cria com status=PENDING (não cria Ban ainda)
      2. Admin revisa → APPROVED (cria Ban automaticamente) ou REJECTED
      3. Estado terminal não muda mais

    Diferente de Ban direto: redator NÃO consegue banir sozinho. Só admin
    aprova. Email pros admins é disparado por signal post_save em pending.
    """
    class Status(models.TextChoices):
        PENDING  = 'pending',  'Pendente'
        APPROVED = 'approved', 'Aprovada'
        REJECTED = 'rejected', 'Rejeitada'

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    target     = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ban_requests_received',
        help_text='Usuário-alvo da solicitação.',
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='ban_requests_made',
        help_text='Redator que solicitou (null se conta excluída).',
    )

    reason          = models.TextField(help_text='Motivação da solicitação.')
    trigger_message = models.TextField(
        blank=True,
        help_text='Mensagem/conteúdo específico que originou a solicitação.',
    )

    status          = models.CharField(max_length=10, choices=Status.choices,
                                       default=Status.PENDING, db_index=True)
    decided_by      = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='ban_requests_decided',
    )
    decided_at      = models.DateTimeField(null=True, blank=True)
    decision_note   = models.TextField(blank=True, help_text='Justificativa do admin ao decidir.')

    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ban_requests'
        ordering = ['-created_at']
        indexes  = [models.Index(fields=['status', '-created_at'])]

    def __str__(self):
        return f'BanRequest({self.target_id}, {self.status})'


class Ban(models.Model):
    """
    One active ban per user.
    - reason:          admin's textual explanation (always required).
    - trigger_message: copy of the specific content (comment/post) that led to
                       the ban — optional, shown highlighted in the admin UI.
    """
    id       = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user     = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ban',
    )
    banned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='bans_issued',
    )

    reason          = models.TextField(help_text='Motivo formal do banimento.')
    trigger_message = models.TextField(
        blank=True,
        help_text='Mensagem/conteúdo específico que originou o banimento (exibido em destaque).',
    )

    created_at  = models.DateTimeField(auto_now_add=True)
    expires_at  = models.DateTimeField(null=True, blank=True, help_text='Null = permanente.')
    is_active   = models.BooleanField(default=True, db_index=True)

    unbanned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bans_reversed',
    )
    unbanned_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'bans'
        ordering = ['-created_at']
        indexes  = [models.Index(fields=['is_active', '-created_at'])]

    def __str__(self):
        return f'Ban({self.user_id})'
