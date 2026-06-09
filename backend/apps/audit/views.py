"""
Admin dashboard metrics — aggregate endpoint used by the /admin Métricas
page. Read-only. Designed to be cheap (single query per metric, no N+1).

Period filter (`?period=day|week|month|year`) controls:
  - "period_stats": activity inside the selected window
  - "previous_period_stats": same window length, immediately before "since"
    → consumer renders delta vs. previous period (Linear/Vercel pattern)
  - "active_users": users who commented or liked inside the window

Lifetime totals are returned unconditionally so the dashboard can show
both "all-time" and "this period" alongside each other.

Per-article metrics include engagement_rate = (comments + likes) / views,
the editorial KPI that contextualizes raw view counts.
"""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDay, TruncHour, TruncMonth
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.articles.models import Article, Category
from apps.comments.models import Comment, CommentLike
from apps.newsletter.models import NewsletterSubscriber
from apps.users.permissions import IsAdminUser


PERIOD_DELTAS = {
    'day':   timedelta(days=1),
    'week':  timedelta(days=7),
    'month': timedelta(days=30),
    'year':  timedelta(days=365),
}
PER_ARTICLE_LIMIT = 20


def _generate_buckets(since, until, period_key):
    """Generate (bucket_start_datetime, label) pairs that cover [since, until).

    Bucket granularity adapts to the selected window so the resulting time
    series stays readable on a chart:
      - day   → 24 hourly buckets (label = "13:00")
      - week  → 7 daily buckets    (label = "13/05")
      - month → ~30 daily buckets  (label = "13/05")
      - year  → 12 monthly buckets (label = "Mai/26")

    All boundaries are computed in the *project* timezone (TIME_ZONE setting)
    so they align with Django's `Trunc*` aggregates, which honor the same
    setting. Mixing UTC + local-tz boundaries silently makes every bucket
    count return 0.
    """
    # Move into local tz so day/month boundaries align with Trunc* output.
    since_local = timezone.localtime(since)
    until_local = timezone.localtime(until)

    if period_key == 'day':
        cur = since_local.replace(minute=0, second=0, microsecond=0)
        fmt = '%H:00'
        step = 'hour'
    elif period_key == 'year':
        cur = since_local.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        fmt = '%b/%y'
        step = 'month'
    else:  # week, month
        cur = since_local.replace(hour=0, minute=0, second=0, microsecond=0)
        fmt = '%d/%m'
        step = 'day'

    buckets = []
    while cur < until_local:
        buckets.append((cur, cur.strftime(fmt)))
        if step == 'hour':
            cur = cur + timedelta(hours=1)
        elif step == 'day':
            cur = cur + timedelta(days=1)
        else:  # month
            y, m = cur.year, cur.month
            cur = cur.replace(year=y + 1, month=1) if m == 12 else cur.replace(month=m + 1)

    return buckets


def _trunc_for(period_key):
    if period_key == 'day':
        return TruncHour
    if period_key == 'year':
        return TruncMonth
    return TruncDay


def _bucket_counts(queryset, date_field, buckets, trunc_cls):
    """Run a single grouped-count query and align it to the bucket list."""
    counts = dict(
        queryset.annotate(_b=trunc_cls(date_field))
                .values('_b')
                .annotate(c=Count('id'))
                .values_list('_b', 'c')
    )
    return [counts.get(b, 0) for b, _ in buckets]


def _period_stats(since, until):
    """Return the period-scoped counters between `since` and `until`."""
    User = get_user_model()
    active_commenters = set(
        Comment.objects
        .filter(created_at__gte=since, created_at__lt=until, is_deleted=False)
        .values_list('author_id', flat=True)
    )
    active_likers = set(
        CommentLike.objects
        .filter(created_at__gte=since, created_at__lt=until)
        .values_list('user_id', flat=True)
    )
    return {
        'new_users':       User.objects.filter(date_joined__gte=since, date_joined__lt=until).count(),
        'new_subscribers': NewsletterSubscriber.objects
                            .filter(subscribed_at__gte=since, subscribed_at__lt=until, is_active=True)
                            .count(),
        'new_articles':    Article.objects.filter(created_at__gte=since, created_at__lt=until).count(),
        'new_comments':    Comment.objects.filter(created_at__gte=since, created_at__lt=until, is_deleted=False).count(),
        'new_likes':       CommentLike.objects.filter(created_at__gte=since, created_at__lt=until).count(),
        'active_users':    len(active_commenters | active_likers),
    }


class AdminMetricsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        period_key = request.query_params.get('period', 'week')
        delta = PERIOD_DELTAS.get(period_key, PERIOD_DELTAS['week'])

        now = timezone.now()
        since = now - delta
        previous_since = since - delta  # same window length immediately before

        User = get_user_model()

        # ── Per-article ranking (published only, ordered by views desc).
        # engagement_rate = (comments + likes) / views, computed in Python
        # because Django ORM divisions on integer fields can be brittle.
        per_article = list(
            Article.objects
            .filter(status=Article.Status.PUBLISHED)
            .annotate(
                comment_count=Count(
                    'comments',
                    filter=Q(comments__is_deleted=False),
                    distinct=True,
                ),
                # Mesmo filtro de is_deleted que comment_count: curtidas em
                # comentários soft-deleted (ocultos da tela) não devem entrar
                # no engagement. distinct evita a inflação do JOIN cartesiano
                # comments × likes.
                like_count=Count(
                    'comments__likes',
                    filter=Q(comments__is_deleted=False),
                    distinct=True,
                ),
            )
            .order_by('-view_count')
            .values('slug', 'title', 'view_count', 'comment_count', 'like_count', 'published_at')
            [:PER_ARTICLE_LIMIT]
        )
        for a in per_article:
            views = a['view_count'] or 0
            engagement = a['comment_count'] + a['like_count']
            a['engagement_rate'] = round(engagement / views, 4) if views > 0 else 0.0

        # ── Time series for the dashboard view ────────────────────────────
        buckets = _generate_buckets(since, now, period_key)
        trunc_cls = _trunc_for(period_key)
        labels = [lbl for _, lbl in buckets]
        time_series = {
            'labels':      labels,
            'comments':    _bucket_counts(
                Comment.objects.filter(created_at__gte=since, created_at__lt=now, is_deleted=False),
                'created_at', buckets, trunc_cls),
            'likes':       _bucket_counts(
                CommentLike.objects.filter(created_at__gte=since, created_at__lt=now),
                'created_at', buckets, trunc_cls),
            'subscribers': _bucket_counts(
                NewsletterSubscriber.objects.filter(subscribed_at__gte=since, subscribed_at__lt=now, is_active=True),
                'subscribed_at', buckets, trunc_cls),
            'users':       _bucket_counts(
                User.objects.filter(date_joined__gte=since, date_joined__lt=now),
                'date_joined', buckets, trunc_cls),
            'articles':    _bucket_counts(
                Article.objects.filter(created_at__gte=since, created_at__lt=now),
                'created_at', buckets, trunc_cls),
        }

        # ── Category breakdown (donut) ────────────────────────────────────
        # Only published articles count toward the visible editorial mix.
        category_counts = dict(
            Article.objects
                .filter(status=Article.Status.PUBLISHED, category__isnull=False)
                .values_list('category__slug')
                .annotate(c=Count('id'))
                .values_list('category__slug', 'c')
        )
        # Return every category (even with 0) so the donut always shows the
        # full editorial palette — empty editorias are still part of the brand.
        category_breakdown = [
            {'slug': c.slug, 'name': c.name, 'count': category_counts.get(c.slug, 0)}
            for c in Category.objects.order_by('name')
        ]

        return Response({
            'period': period_key,
            'since':  since.isoformat(),
            'now':    now.isoformat(),

            # ── Lifetime totals ────────────────────────────────────────────
            'totals': {
                'users':       User.objects.count(),
                'subscribers': NewsletterSubscriber.objects.filter(is_active=True).count(),
                'articles':    Article.objects.filter(status=Article.Status.PUBLISHED).count(),
                'views':       Article.objects.aggregate(s=Sum('view_count'))['s'] or 0,
                'comments':    Comment.objects.filter(is_deleted=False).count(),
                'likes':       CommentLike.objects.count(),
            },

            # ── Period-scoped counts (current window + previous for delta) ─
            'period_stats':          _period_stats(since, now),
            'previous_period_stats': _period_stats(previous_since, since),

            'per_article':        per_article,
            'time_series':        time_series,
            'category_breakdown': category_breakdown,
        })
