from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from apps.articles.robots_view import robots_txt
from apps.articles.sitemaps import sitemap_xml

urlpatterns = [
    path('django-admin/', admin.site.urls),

    # SEO — sitemap.xml + robots.txt expostos no domínio raiz.
    # Sitemap view custom (não usa django.contrib.sitemaps) pra apontar URLs
    # pro frontend SITE_URL, não pro backend host.
    path('sitemap.xml', sitemap_xml, name='sitemap-xml'),
    path('robots.txt',  robots_txt,  name='robots-txt'),

    path('api/auth/', include('apps.users.urls')),
    path('api/', include('apps.articles.urls')),
    path('api/', include('apps.comments.urls')),
    path('api/', include('apps.moderation.urls')),
    path('api/', include('apps.newsletter.urls')),
    path('api/', include('apps.audit.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
