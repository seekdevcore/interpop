"""
OG (Open Graph) middleware — render HTML mínimo com meta tags para
crawlers sociais que requisitarem /noticia/<slug> no backend.

Por quê: o frontend é SPA puro. Quando WhatsApp/Twitter/Slack pega
um link, eles fazem GET ao HTML e LÊEM as meta tags antes de qualquer
JS rodar. React não consegue inserir as tags a tempo.

Esse middleware funciona quando o backend ALSO serve as rotas do
frontend (no caso do VPS Hostinger, atrás do Nginx). Em dev (com Vite
em :5173 e backend em :8000 separados), o crawler nunca chega aqui;
mas em produção bate na origem única — então sempre vai funcionar.

Detecta crawlers por User-Agent (facebookexternalhit, Twitterbot,
WhatsApp, LinkedInBot, Slackbot, Discordbot, etc) e só responde com
HTML pra eles. Outras requisições passam batido pro fluxo normal.
"""
import re
from urllib.parse import quote

from django.conf import settings
from django.http import HttpResponse

from .models import Article


# Padrão de detecção de crawlers sociais (User-Agent)
_CRAWLER_RE = re.compile(
    r'(facebookexternalhit|Twitterbot|WhatsApp|LinkedInBot|Slackbot|'
    r'Discordbot|TelegramBot|Pinterest|redditbot|Applebot)',
    re.IGNORECASE,
)

# Padrão de URL de artigo: /noticia/<slug>/?  (com ou sem trailing slash)
_ARTICLE_URL_RE = re.compile(r'^/noticia/([^/]+)/?$')


def _escape(s: str) -> str:
    """HTML-escape conservador para conteúdo dentro de atributos."""
    return (
        s.replace('&', '&amp;')
         .replace('<', '&lt;')
         .replace('>', '&gt;')
         .replace('"', '&quot;')
         .replace("'", '&#39;')
    )


def _render_og_html(article: Article) -> str:
    """Gera HTML mínimo com meta tags OG/Twitter para um artigo."""
    site_url     = getattr(settings, 'SITE_URL', 'http://localhost:5173').rstrip('/')
    article_url  = f'{site_url}/noticia/{quote(article.slug, safe="")}'
    title        = _escape(article.title)
    description  = _escape(article.excerpt[:300])
    image_url    = ''
    if article.cover_image:
        # `cover_image.url` é relativo (/media/...); promover pra absoluto
        rel = article.cover_image.url
        image_url = rel if rel.startswith('http') else f'{site_url}{rel}'

    author = _escape(article.author.full_name) if article.author else 'Interpop'
    section = _escape(article.category.name) if article.category else ''

    return f'''<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>{title} — Interpop</title>
<meta name="description" content="{description}">

<!-- Open Graph -->
<meta property="og:type" content="article">
<meta property="og:url" content="{article_url}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="Interpop">
{f'<meta property="og:image" content="{image_url}">' if image_url else ''}
<meta property="article:author" content="{author}">
{f'<meta property="article:section" content="{section}">' if section else ''}

<!-- Twitter Card -->
<meta name="twitter:card" content="{'summary_large_image' if image_url else 'summary'}">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{description}">
{f'<meta name="twitter:image" content="{image_url}">' if image_url else ''}

<link rel="canonical" href="{article_url}">
</head>
<body>
<h1>{title}</h1>
<p>{description}</p>
<p><a href="{article_url}">Continuar lendo no Interpop →</a></p>
</body>
</html>
'''


class SocialOGMiddleware:
    """Intercepta GET /noticia/<slug> de crawlers sociais e devolve HTML
    com meta tags ricas. Outras requests passam intactas pro próximo handler."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        ua = request.META.get('HTTP_USER_AGENT', '')
        is_crawler = bool(_CRAWLER_RE.search(ua))

        if is_crawler and request.method == 'GET':
            m = _ARTICLE_URL_RE.match(request.path)
            if m:
                slug = m.group(1)
                try:
                    article = Article.objects.select_related('author', 'category').get(
                        slug=slug, status=Article.Status.PUBLISHED,
                    )
                except Article.DoesNotExist:
                    return HttpResponse(status=404)
                return HttpResponse(_render_og_html(article), content_type='text/html; charset=utf-8')

        return self.get_response(request)
