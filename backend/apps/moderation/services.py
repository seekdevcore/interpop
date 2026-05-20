"""Ban / unban business logic, isolated from views.

Política de integridade transacional (ADR-012):
Todos os services abaixo que escrevem ≥2 rows são decorados com
`@transaction.atomic`. Sem isso, um crash entre a primeira e a
segunda escrita deixava estado inconsistente (ex.: Ban gravado mas
User.is_banned ainda False, ou vice-versa). Item C3 do
Improvement-system.md §11.1.

`approve_ban_request` chama `ban_user` internamente — atomic aninhado
é seguro no Django (usa savepoints automaticamente).
"""
from django.db import transaction
from django.utils import timezone
from apps.users.models import User
from .models import Ban, BanRequest


@transaction.atomic
def ban_user(target: User, admin: User, reason: str, trigger_message: str = '') -> Ban:
    """Bane o usuário. Idempotente quanto a histórico: como `Ban.user` é
    OneToOne (1 registro por usuário no banco), re-banir alguém que já
    foi banido e depois desbanido REATIVA o registro existente em vez
    de tentar inserir duplicata (que estouraria UNIQUE constraint).

    Trade-off conhecido: perdemos o histórico individual de cada ciclo
    ban→unban (sobrescrevemos campos). Se quisermos auditoria completa
    de cada ciclo no futuro, a saída é migrar `Ban.user` p/ ForeignKey +
    UniqueConstraint(condition=Q(is_active=True)).
    """
    ban, _created = Ban.objects.update_or_create(
        user=target,
        defaults={
            'banned_by':       admin,
            'reason':          reason,
            'trigger_message': trigger_message,
            'is_active':       True,
            'unbanned_by':     None,
            'unbanned_at':     None,
        },
    )
    User.objects.filter(pk=target.pk).update(is_banned=True)
    return ban


@transaction.atomic
def unban_user(ban: Ban, admin: User) -> Ban:
    ban.is_active   = False
    ban.unbanned_by = admin
    ban.unbanned_at = timezone.now()
    ban.save(update_fields=['is_active', 'unbanned_by', 'unbanned_at'])
    User.objects.filter(pk=ban.user_id).update(is_banned=False)
    return ban


# ── BanRequest (solicitação de banimento por redator) ─────────────────────

@transaction.atomic
def approve_ban_request(request_obj: BanRequest, admin: User, decision_note: str = '') -> Ban:
    """Admin aprova solicitação → cria Ban real + marca como APPROVED.

    Reutiliza ban_user() pra que o efeito (User.is_banned=True) seja idêntico
    a um banimento direto. Idempotente: se já APPROVED, retorna o Ban
    existente sem duplicar.
    """
    if request_obj.status == BanRequest.Status.APPROVED:
        # Idempotência — pode ter sido aprovada em race condition
        return Ban.objects.filter(user=request_obj.target, is_active=True).first()

    ban = ban_user(
        target=request_obj.target,
        admin=admin,
        reason=request_obj.reason,
        trigger_message=request_obj.trigger_message,
    )
    request_obj.status        = BanRequest.Status.APPROVED
    request_obj.decided_by    = admin
    request_obj.decided_at    = timezone.now()
    request_obj.decision_note = decision_note
    request_obj.save(update_fields=['status', 'decided_by', 'decided_at', 'decision_note'])
    return ban


def reject_ban_request(request_obj: BanRequest, admin: User, decision_note: str = '') -> BanRequest:
    """Admin rejeita → só atualiza status, NÃO cria Ban."""
    request_obj.status        = BanRequest.Status.REJECTED
    request_obj.decided_by    = admin
    request_obj.decided_at    = timezone.now()
    request_obj.decision_note = decision_note
    request_obj.save(update_fields=['status', 'decided_by', 'decided_at', 'decision_note'])
    return request_obj
