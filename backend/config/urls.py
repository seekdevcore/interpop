from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from apps.articles.robots_view import robots_txt
from apps.articles.sitemaps import sitemap_xml
from apps.audit.health_view import healthz

urlpatterns = [
    path('django-admin/', admin.site.urls),

    # SEO — sitemap.xml + robots.txt expostos no domínio raiz.
    # Sitemap view custom (não usa django.contrib.sitemaps) pra apontar URLs
    # pro frontend SITE_URL, não pro backend host.
    path('sitemap.xml', sitemap_xml, name='sitemap-xml'),
    path('robots.txt',  robots_txt,  name='robots-txt'),

    # Health check — root path, sem versioning (monitor externo +
    # nginx upstream check + smoke test do deploy).
    path('healthz/', healthz, name='healthz'),
    path('healthz',  healthz),  # alias sem trailing slash

    # API v1 — todos os endpoints da aplicação ficam sob /api/v1/.
    # Decisão formalizada em ADR-010 do Improvement-system.md §11.0.
    # Versioning desde o dia 1 evita migração coordenada dolorosa quando
    # houver primeira breaking change (mudança de shape de payload,
    # renomeação de campo, paginação diferente). Custo de adicionar agora:
    # ~1h. Custo depois com produção rodando: dias + downtime.
    # NUNCA criar /api/v2/ antes de ter /api/v1/ deprecado anunciado com
    # 90 dias de antecedência no header `Sunset` + página de migração.
    path('api/v1/auth/', include('apps.users.urls')),
    path('api/v1/', include('apps.articles.urls')),
    path('api/v1/', include('apps.comments.urls')),
    path('api/v1/', include('apps.moderation.urls')),
    path('api/v1/', include('apps.newsletter.urls')),
    path('api/v1/', include('apps.audit.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
