"""
Sitemap custom para o Interpop.

Não usamos `django.contrib.sitemaps.Sitemap` porque ele concatena
`request.scheme://request.host` automaticamente — no nosso caso o backend
roda numa origem (`localhost:8000`, `api.interpop.cc`) e o frontend SPA
em outra (`localhost:5173`, `interpop.cc`). Sitemap deve apontar pra
URLs do frontend.

Inclui:
  - Rotas estáticas (home, /noticias, /sobre, /newsletter)
  - Cada artigo publicado em /noticia/<slug>
"""
from django.conf import settings
from django.http import HttpResponse
from django.utils.xmlutils import SimplerXMLGenerator

from .models import Article


def _site_url() -> str:
    return getattr(settings, 'SITE_URL', 'http://localhost:5173').rstrip('/')


STATIC_ROUTES = [
    ('/',           'weekly',  0.6),
    ('/noticias',   'weekly',  0.6),
    ('/sobre',      'monthly', 0.5),
    ('/newsletter', 'monthly', 0.5),
]


def sitemap_xml(request) -> HttpResponse:  # noqa: ARG001 — Django view signature
    """Gera sitemap.xml manualmente, com URLs absolutas para o frontend."""
    base = _site_url()

    response = HttpResponse(content_type='application/xml')
    xml = SimplerXMLGenerator(response, 'utf-8')
    xml.startDocument()
    xml.startElement('urlset', {'xmlns': 'http://www.sitemaps.org/schemas/sitemap/0.9'})

    # ── Rotas estáticas ─────────────────────────────────────────
    for path, changefreq, priority in STATIC_ROUTES:
        xml.startElement('url', {})
        xml.startElement('loc', {});       xml.characters(f'{base}{path}'); xml.endElement('loc')
        xml.startElement('changefreq', {}); xml.characters(changefreq);     xml.endElement('changefreq')
        xml.startElement('priority', {});  xml.characters(str(priority));   xml.endElement('priority')
        xml.endElement('url')

    # ── Artigos publicados ──────────────────────────────────────
    qs = (
        Article.objects
        .filter(status=Article.Status.PUBLISHED)
        .only('slug', 'updated_at', 'published_at')
    )
    for art in qs:
        lastmod = (art.updated_at or art.published_at)
        xml.startElement('url', {})
        xml.startElement('loc', {});       xml.characters(f'{base}/noticia/{art.slug}'); xml.endElement('loc')
        if lastmod:
            xml.startElement('lastmod', {}); xml.characters(lastmod.date().isoformat()); xml.endElement('lastmod')
        xml.startElement('changefreq', {}); xml.characters('monthly'); xml.endElement('changefreq')
        xml.startElement('priority', {});  xml.characters('0.9');     xml.endElement('priority')
        xml.endElement('url')

    xml.endElement('urlset')
    xml.endDocument()
    return response
