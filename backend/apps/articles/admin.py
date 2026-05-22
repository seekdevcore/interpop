from django.contrib import admin, messages

from apps.newsletter.tasks import send_article_notification

from .models import Article, Category


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display  = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display   = ('title', 'author', 'category', 'status', 'is_featured', 'view_count', 'published_at')
    list_filter    = ('status', 'is_featured', 'category')
    search_fields  = ('title', 'author__email')
    prepopulated_fields = {'slug': ('title',)}
    readonly_fields = ('view_count', 'created_at', 'updated_at')
    # Resend action kept as a manual fallback (e.g. SMTP outage at publish
    # time, edit of a recently published post). The default flow auto-notifies
    # via the post_save signal in apps/articles/signals.py.
    #
    # C12: troca de chamada síncrona para `.delay()` — não bloqueia o request
    # admin (1k subscribers em SendGrid = ~30s travados antes). Worker Celery
    # processa em background; admin recebe acknowledge imediato.
    actions = ['resend_notification']

    @admin.action(description='Reenviar notificação aos assinantes (manual)')
    def resend_notification(self, request, queryset):
        enqueued = skipped = 0
        for article in queryset:
            if article.status != Article.Status.PUBLISHED:
                skipped += 1
                continue
            send_article_notification.delay(article_id=str(article.pk))
            enqueued += 1

        if enqueued:
            self.message_user(
                request,
                f'{enqueued} artigo(s) enfileirado(s) para reenvio. '
                f'O worker processa em background.',
                level=messages.SUCCESS,
            )
        if skipped:
            self.message_user(
                request,
                f'{skipped} ignorado(s) (não publicados).',
                level=messages.INFO,
            )
