"""
Tests para AdminMetricsView — endpoint de dashboard /api/v1/admin/metrics/.

D3 do reorganization-proposal (A36 do Improvement-system) — view de 229 LOC
sem cobertura. Bug aqui = decisão editorial errada baseada em métrica
fantasma (engagement_rate, period delta, bucket alignment).

Cobertura prioritária:
- Permissões: AllowAny → 401; user comum → 403; admin → 200.
- Estrutura do payload (chaves obrigatórias: totals, period_stats,
  previous_period_stats, per_article, time_series, category_breakdown).
- Lifetime totals refletem DB completo (não filtra por período).
- period_stats filtra pelo intervalo correto.
- previous_period_stats cobre a janela imediatamente anterior do mesmo tamanho.
- engagement_rate = (comments + likes) / views, com 4 decimais.
- engagement_rate = 0.0 quando views=0 (não DivisionByZero).
- _generate_buckets adapta granularidade conforme period (day=hour, year=month).
- category_breakdown inclui categorias com 0 artigos (palette completa).
- active_users = união de commenters ∪ likers (não soma — deduplica).
- per_article limita a 20 (PER_ARTICLE_LIMIT) ordenado por view_count desc.
"""
from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone
from freezegun import freeze_time

from apps.articles.models import Article, Category
from apps.audit.views import _generate_buckets, _period_stats
from apps.comments.models import Comment, CommentLike
from apps.newsletter.models import NewsletterSubscriber


METRICS_URL = '/api/v1/admin/metrics/'


# ── Fixtures ─────────────────────────────────────────────────────────────────


@pytest.fixture
def category(db):
    obj, _ = Category.objects.get_or_create(
        slug='metrics-test', defaults={'name': 'Metrics Test'},
    )
    return obj


@pytest.fixture
def make_article(db, category):
    import uuid as _uuid
    def _make(author, status=Article.Status.PUBLISHED, view_count=0, title='Metrics Article', **kw):
        # Slug com UUID curto evita colisão quando o mesmo title é passado
        # várias vezes no mesmo teste (caso comum com fixtures ad-hoc).
        slug = kw.pop('slug', None) or f"{title.lower().replace(' ', '-')}-{_uuid.uuid4().hex[:8]}"
        return Article.objects.create(
            author=author,
            category=category,
            title=title,
            slug=slug,
            excerpt=kw.pop('excerpt', 'Excerpt.'),
            body=kw.pop('body', 'Body.'),
            status=status,
            view_count=view_count,
            **kw,
        )
    return _make


# ── Permissões ───────────────────────────────────────────────────────────────


def test_metrics_anon_returns_401(client):
    resp = client.get(METRICS_URL)
    assert resp.status_code == 401


def test_metrics_reader_user_returns_403(reader_user, authed_client_factory):
    api = authed_client_factory(reader_user)
    resp = api.get(METRICS_URL)
    assert resp.status_code == 403


def test_metrics_editor_user_returns_403(editor_user, authed_client_factory):
    """Editor publica mas NÃO vê métricas — só admin."""
    api = authed_client_factory(editor_user)
    resp = api.get(METRICS_URL)
    assert resp.status_code == 403


def test_metrics_admin_returns_200(admin_user, authed_client_factory):
    api = authed_client_factory(admin_user)
    resp = api.get(METRICS_URL)
    assert resp.status_code == 200


def test_metrics_dev_returns_200(dev_user, authed_client_factory):
    """Dev é admin++ — acesso garantido."""
    api = authed_client_factory(dev_user)
    resp = api.get(METRICS_URL)
    assert resp.status_code == 200


# ── Estrutura do payload ─────────────────────────────────────────────────────


def test_metrics_payload_has_required_top_level_keys(admin_user, authed_client_factory):
    api = authed_client_factory(admin_user)
    resp = api.get(METRICS_URL)
    body = resp.json()
    for key in (
        'period', 'since', 'now',
        'totals',
        'period_stats', 'previous_period_stats',
        'per_article', 'time_series', 'category_breakdown',
    ):
        assert key in body, f'Chave {key!r} faltando no payload'


def test_metrics_totals_has_all_lifetime_counters(admin_user, authed_client_factory):
    api = authed_client_factory(admin_user)
    resp = api.get(METRICS_URL)
    totals = resp.json()['totals']
    for key in ('users', 'subscribers', 'articles', 'views', 'comments', 'likes'):
        assert key in totals
        assert isinstance(totals[key], int)


def test_metrics_period_defaults_to_week(admin_user, authed_client_factory):
    """?period= ausente → 'week' (default)."""
    api = authed_client_factory(admin_user)
    resp = api.get(METRICS_URL)
    assert resp.json()['period'] == 'week'


def test_metrics_period_invalid_falls_back_to_week(admin_user, authed_client_factory):
    """Period inválido NÃO levanta 500 — silently falls back (default dict)."""
    api = authed_client_factory(admin_user)
    resp = api.get(METRICS_URL + '?period=invalid')
    assert resp.status_code == 200
    # Eco do query param (mesmo inválido)
    assert resp.json()['period'] == 'invalid'


# ── Lifetime totals refletem DB completo ─────────────────────────────────────


def test_totals_reflects_all_data_regardless_of_period(
    admin_user, editor_user, make_article, authed_client_factory,
):
    """Lifetime totals NÃO filtram por período — somam tudo."""
    make_article(editor_user, status=Article.Status.PUBLISHED, view_count=100)
    make_article(editor_user, status=Article.Status.PUBLISHED, view_count=200)
    make_article(editor_user, status=Article.Status.DRAFT)  # NÃO conta em totals.articles
    NewsletterSubscriber.objects.create(email='a@x.test', is_active=True)
    NewsletterSubscriber.objects.create(email='b@x.test', is_active=False)  # NÃO conta

    api = authed_client_factory(admin_user)
    body = api.get(METRICS_URL).json()
    totals = body['totals']
    assert totals['articles'] == 2  # só published
    assert totals['views'] == 300   # 100 + 200
    assert totals['subscribers'] == 1  # só active


def test_totals_views_zero_when_no_articles(admin_user, authed_client_factory):
    """REGRESSÃO: Sum vazio retorna None — code path tem `or 0` para evitar None vazar."""
    api = authed_client_factory(admin_user)
    body = api.get(METRICS_URL).json()
    assert body['totals']['views'] == 0  # int, não None


# ── period_stats vs previous_period_stats ────────────────────────────────────


def test_period_stats_filters_by_window(
    admin_user, editor_user, reader_user, make_article, authed_client_factory,
):
    """new_users/new_articles/etc filtram pelo intervalo [since, now)."""
    now = timezone.now()

    # Article criado AGORA — entra no period_stats (week)
    fresh = make_article(editor_user, title='Fresh', view_count=10)

    # Article criado há 100 dias — NÃO entra no period_stats (week)
    old = make_article(editor_user, title='Old', view_count=10)
    Article.objects.filter(pk=old.pk).update(created_at=now - timedelta(days=100))

    api = authed_client_factory(admin_user)
    body = api.get(METRICS_URL + '?period=week').json()
    # period_stats.new_articles = 1 (só fresh; old está fora da janela)
    assert body['period_stats']['new_articles'] == 1
    # Lifetime totals.articles = 2 (ambos)
    assert body['totals']['articles'] == 2


def test_previous_period_stats_covers_immediately_prior_window(
    admin_user, editor_user, make_article, authed_client_factory,
):
    """previous_period_stats cobre [since - delta, since) — mesmo tamanho
    da janela atual, imediatamente antes. Necessário para delta vs.
    período anterior na UI."""
    now = timezone.now()

    # Article há 10 dias — fora da semana atual, dentro da semana ANTERIOR
    a = make_article(editor_user, title='Past week', view_count=5)
    Article.objects.filter(pk=a.pk).update(created_at=now - timedelta(days=10))

    api = authed_client_factory(admin_user)
    body = api.get(METRICS_URL + '?period=week').json()
    assert body['period_stats']['new_articles'] == 0  # nada na semana atual
    assert body['previous_period_stats']['new_articles'] == 1  # 1 na semana anterior


def test_active_users_dedupes_commenters_and_likers(
    admin_user, editor_user, reader_user, make_article, authed_client_factory,
):
    """REGRESSÃO: active_users = |commenters ∪ likers|, NÃO soma.
    Usuário que comentou E curtiu conta UMA vez."""
    article = make_article(editor_user, title='AU Test', view_count=10)
    c1 = Comment.objects.create(article=article, author=reader_user, content='x')
    # Mesmo user também curte
    CommentLike.objects.create(comment=c1, user=reader_user)

    api = authed_client_factory(admin_user)
    body = api.get(METRICS_URL + '?period=week').json()
    # reader_user contou 1 vez no active_users (apesar de aparecer em
    # commenters E em likers)
    assert body['period_stats']['active_users'] == 1


# ── Per-article ranking + engagement_rate ────────────────────────────────────


def test_per_article_includes_engagement_rate_4_decimals(
    admin_user, editor_user, reader_user, make_article, authed_client_factory,
):
    article = make_article(editor_user, title='Engagement', view_count=100)
    # 2 comments + 3 likes = engagement 5; views = 100 → rate = 0.05
    for i in range(2):
        c = Comment.objects.create(article=article, author=reader_user, content=f'c{i}')
        CommentLike.objects.create(comment=c, user=reader_user)
    # +1 like extra num comment já existente (overshadow likes do user no mesmo comment)
    c_extra = Comment.objects.create(article=article, author=reader_user, content='x')
    CommentLike.objects.create(comment=c_extra, user=reader_user)

    api = authed_client_factory(admin_user)
    body = api.get(METRICS_URL).json()
    art_row = next(a for a in body['per_article'] if a['title'] == 'Engagement')

    expected_engagement = art_row['comment_count'] + art_row['like_count']
    expected_rate = round(expected_engagement / art_row['view_count'], 4)
    assert art_row['engagement_rate'] == expected_rate


def test_per_article_engagement_rate_zero_when_views_zero(
    admin_user, editor_user, reader_user, make_article, authed_client_factory,
):
    """REGRESSÃO: views=0 NÃO pode levantar DivisionByZero — retorna 0.0."""
    article = make_article(editor_user, title='Unwatched', view_count=0)
    Comment.objects.create(article=article, author=reader_user, content='lonely')

    api = authed_client_factory(admin_user)
    body = api.get(METRICS_URL).json()
    art_row = next(a for a in body['per_article'] if a['title'] == 'Unwatched')
    assert art_row['engagement_rate'] == 0.0


def test_per_article_ordered_by_views_desc(
    admin_user, editor_user, make_article, authed_client_factory,
):
    make_article(editor_user, title='Low',  view_count=10)
    make_article(editor_user, title='High', view_count=500)
    make_article(editor_user, title='Mid',  view_count=100)

    api = authed_client_factory(admin_user)
    body = api.get(METRICS_URL).json()
    titles = [a['title'] for a in body['per_article']]
    assert titles[0] == 'High'
    # Low fica antes de Mid? Mid tem 100, Low tem 10 — Mid antes
    assert titles.index('Mid') < titles.index('Low')


def test_per_article_limited_to_20(
    admin_user, editor_user, make_article, authed_client_factory,
):
    """PER_ARTICLE_LIMIT = 20 — view não vaza lista inteira em catálogos grandes."""
    for i in range(25):
        make_article(editor_user, title=f'Art {i:02d}', view_count=i)

    api = authed_client_factory(admin_user)
    body = api.get(METRICS_URL).json()
    assert len(body['per_article']) == 20


def test_per_article_only_published(
    admin_user, editor_user, make_article, authed_client_factory,
):
    """Drafts NÃO aparecem no ranking (status='published' filter)."""
    make_article(editor_user, title='Hidden Draft', view_count=999, status=Article.Status.DRAFT)
    make_article(editor_user, title='Visible Pub',  view_count=10,  status=Article.Status.PUBLISHED)

    api = authed_client_factory(admin_user)
    body = api.get(METRICS_URL).json()
    titles = [a['title'] for a in body['per_article']]
    assert 'Hidden Draft' not in titles
    assert 'Visible Pub' in titles


def test_per_article_like_count_excludes_likes_on_deleted_comments(
    admin_user, editor_user, reader_user, make_article, authed_client_factory,
):
    """REGRESSÃO: like_count NÃO conta curtidas de comentários soft-deleted.

    comment_count já exclui deletados (filter is_deleted=False); like_count
    precisa ser consistente, senão engagement_rate infla com curtidas em
    conteúdo OCULTO (comment deletado some da tela mas seu like contava)."""
    article = make_article(editor_user, title='DelLikes', view_count=100)

    alive = Comment.objects.create(article=article, author=reader_user, content='vivo')
    CommentLike.objects.create(comment=alive, user=reader_user)  # like válido

    dead = Comment.objects.create(
        article=article, author=reader_user, content='morto', is_deleted=True,
    )
    CommentLike.objects.create(comment=dead, user=editor_user)  # like em comment oculto

    api = authed_client_factory(admin_user)
    body = api.get(METRICS_URL).json()
    row = next(a for a in body['per_article'] if a['title'] == 'DelLikes')
    assert row['comment_count'] == 1  # só o "vivo"
    assert row['like_count'] == 1     # like do comment deletado NÃO conta


# ── category_breakdown ───────────────────────────────────────────────────────


def test_category_breakdown_includes_categories_with_zero_articles(
    admin_user, editor_user, make_article, authed_client_factory,
):
    """REGRESSÃO: editoria SEM artigos publicados ainda aparece no donut
    (palette completa do brand). count=0 esperado."""
    Category.objects.get_or_create(slug='empty-ed', defaults={'name': 'Empty Editoria'})
    make_article(editor_user, title='Has art')  # outra categoria

    api = authed_client_factory(admin_user)
    body = api.get(METRICS_URL).json()
    slugs = {c['slug']: c['count'] for c in body['category_breakdown']}
    assert 'empty-ed' in slugs
    assert slugs['empty-ed'] == 0


# ── _generate_buckets unit tests ─────────────────────────────────────────────


@freeze_time('2026-06-15 14:30:00')
def test_generate_buckets_day_produces_24_to_25_hourly():
    """period=day → ~24 buckets hourly. Pode ser 24 ou 25 dependendo
    de onde 'now' cai dentro da hora — cur começa em HH:00 e step de 1h
    até cur < until_local. Label HH:00."""
    now = timezone.now()
    since = now - timedelta(days=1)
    buckets = _generate_buckets(since, now, 'day')
    assert 24 <= len(buckets) <= 25
    # Labels são strings HH:00
    for _, label in buckets:
        assert ':00' in label


@freeze_time('2026-06-15 14:30:00')
def test_generate_buckets_week_produces_7_to_8_daily():
    """period=week → ~7 buckets daily. 7 ou 8 dependendo de onde 'now'
    cai dentro do dia (boundary diário em hour=0)."""
    now = timezone.now()
    since = now - timedelta(days=7)
    buckets = _generate_buckets(since, now, 'week')
    assert 7 <= len(buckets) <= 8
    # Labels DD/MM
    for _, label in buckets:
        assert '/' in label


@freeze_time('2026-06-15 14:30:00')
def test_generate_buckets_month_produces_30_daily():
    now = timezone.now()
    since = now - timedelta(days=30)
    buckets = _generate_buckets(since, now, 'month')
    # 30 dias = 30 ou 31 buckets dependendo de boundary
    assert 29 <= len(buckets) <= 31


@freeze_time('2026-06-15 14:30:00')
def test_generate_buckets_year_produces_monthly():
    now = timezone.now()
    since = now - timedelta(days=365)
    buckets = _generate_buckets(since, now, 'year')
    # ~12 monthly buckets
    assert 11 <= len(buckets) <= 13
    # Labels formato "Mês/AA"
    for _, label in buckets:
        assert '/' in label


# ── _period_stats unit test ──────────────────────────────────────────────────


def test_period_stats_excludes_soft_deleted_comments(
    db, editor_user, reader_user,
):
    """Comments soft-deleted NÃO entram em new_comments."""
    from apps.articles.models import Article, Category
    cat, _ = Category.objects.get_or_create(slug='ps-test', defaults={'name': 'PS Test'})
    article = Article.objects.create(
        author=editor_user, category=cat, title='PS Art', slug='ps-art',
        excerpt='x', body='y', status=Article.Status.PUBLISHED,
    )
    Comment.objects.create(article=article, author=reader_user, content='vivo')
    Comment.objects.create(
        article=article, author=reader_user, content='morto', is_deleted=True,
    )

    now = timezone.now()
    since = now - timedelta(days=7)
    stats = _period_stats(since, now)
    assert stats['new_comments'] == 1  # só o "vivo"
