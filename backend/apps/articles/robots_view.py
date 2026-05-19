"""
robots.txt dinâmico — permite indexação ampla e aponta pro sitemap.
"""
from django.conf import settings
from django.http import HttpResponse


def robots_txt(request) -> HttpResponse:
    site_url = getattr(settings, 'SITE_URL', 'http://localhost:5173').rstrip('/')
    content = (
        'User-agent: *\n'
        'Allow: /\n'
        'Disallow: /api/\n'
        'Disallow: /django-admin/\n'
        '\n'
        f'Sitemap: {site_url}/sitemap.xml\n'
    )
    return HttpResponse(content, content_type='text/plain')
