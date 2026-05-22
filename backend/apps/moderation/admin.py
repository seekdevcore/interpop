"""
Django admin de moderation: Ban (write) + BanRequest (read-only).

BanRequest é read-only no admin (A32 do reorganization-proposal):
- Editor solicita via API → admin decide via API.
- Painel admin existe apenas para audit/observabilidade — não há fluxo
  de "criar BanRequest direto pelo admin" (editor é o único autorizado).
- Aprovação/rejeição passa pelo endpoint /api/v1/ban-requests/<id>/decide/
  que registra audit trail e cria Ban automaticamente em caso de approve.
  Editar status pelo admin pula a service layer e quebra invariantes.
"""
from django.contrib import admin

from .models import Ban, BanRequest


@admin.register(Ban)
class BanAdmin(admin.ModelAdmin):
    list_display  = ('user', 'banned_by', 'is_active', 'created_at', 'expires_at')
    list_filter   = ('is_active',)
    search_fields = ('user__email', 'reason')
    readonly_fields = ('created_at', 'unbanned_at')


@admin.register(BanRequest)
class BanRequestAdmin(admin.ModelAdmin):
    """Read-only — decisões devem passar pela API (service layer)."""
    list_display    = ('target', 'requested_by', 'status', 'created_at', 'decided_at')
    list_filter     = ('status', 'created_at')
    search_fields   = ('target__email', 'requested_by__email', 'reason')
    ordering        = ('-created_at',)
    list_per_page   = 50

    readonly_fields = (
        'id', 'target', 'requested_by', 'reason', 'trigger_message',
        'status', 'decided_by', 'decided_at', 'decision_note', 'created_at',
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False  # read-only — decisão é via API

    def has_delete_permission(self, request, obj=None):
        return False
