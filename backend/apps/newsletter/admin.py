"""
Django admin para NewsletterSubscriber.

A31 do reorganization-proposal. Sem visibilidade admin antes deste registro:
- Nenhuma forma de inspecionar quem inscreveu / quando / token de unsubscribe.
- Compliance LGPD/GDPR comprometida (data subject access request via /django-admin
  era impossível — exigia shell direto no banco).
- Sem como bouncar spam (email descartável persistente, conta zumbi).

Read-mostly: edição manual de email/token não faz sentido — desinscrever
deve passar pelo fluxo público (token URL) que mantém audit trail.
"""
from django.contrib import admin

from .models import NewsletterSubscriber


@admin.register(NewsletterSubscriber)
class NewsletterSubscriberAdmin(admin.ModelAdmin):
    list_display     = ('email', 'is_active', 'subscribed_at')
    list_filter      = ('is_active', 'subscribed_at')
    search_fields    = ('email',)
    readonly_fields  = ('subscribed_at', 'unsubscribe_token')
    ordering         = ('-subscribed_at',)
    list_per_page    = 50

    actions = ['mark_inactive', 'mark_active']

    @admin.action(description='Desativar (soft-unsubscribe)')
    def mark_inactive(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f'{updated} subscriber(s) desativados.')

    @admin.action(description='Reativar')
    def mark_active(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f'{updated} subscriber(s) reativados.')
