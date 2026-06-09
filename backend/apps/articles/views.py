from django.core.cache import cache
from django.db.models import Count, F, Q
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.utils import get_client_ip
from apps.users.permissions import IsOwnerOrAdmin, IsPublisherOrReadOnly
from .models import Article, Category
from .serializers import (
    ArticleDetailSerializer,
    ArticleListSerializer,
    ArticleWriteSerializer,
    CategorySerializer,
)


# IP extraction moved to apps.audit.utils.get_client_ip (C13) — single
# source of truth para extrair IP via X-Forwarded-For.


class CategoryListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class   = CategorySerializer
    queryset           = Category.objects.all()


class ArticleListView(generics.ListCreateAPIView):
    permission_classes = [IsPublisherOrReadOnly]
    # Busca full-text simples (icontains) em title, excerpt, body e autor.
    # SQLite + Postgres ambos suportam — sem dep extra.
    search_fields      = ['title', 'excerpt', 'body', 'author__first_name', 'author__last_name']
    filterset_fields   = ['category__slug', 'status', 'is_featured']
    ordering_fields    = ['published_at', 'view_count', 'created_at']

    def get_queryset(self):
        # .annotate(Count(...)) injeta GROUP BY → Django marca o queryset como
        # "unordered" (QuerySet.ordered=False) mesmo com Meta.ordering, pois
        # ordem default de query agregada é considerada não-confiável. Sem um
        # order_by EXPLÍCITO o paginador do DRF dispara UnorderedObjectListWarning
        # e pode paginar inconsistente. Repete a ordem do Meta de Article.
        qs = Article.objects.select_related('author', 'category').annotate(
            comment_count=Count('comments', filter=Q(comments__is_deleted=False))
        ).order_by('-published_at', '-created_at')
        # Editorial team (admin + editor) enxerga drafts — convenção CMS
        # (WordPress/Ghost): toda equipe vê o estado editorial. Edição/exclusão
        # continua restrita ao próprio autor ou admin (regra no frontend +
        # IsPublisherOrReadOnly no detail view).
        user = self.request.user
        if not (user.is_authenticated and user.can_publish):
            qs = qs.filter(status='published')
        return qs

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ArticleWriteSerializer
        return ArticleListSerializer

    def perform_create(self, serializer):
        data = {}
        if serializer.validated_data.get('status') == 'published':
            data['published_at'] = timezone.now()
        serializer.save(**data)


class ArticleDetailView(generics.RetrieveUpdateDestroyAPIView):
    # IsPublisherOrReadOnly: anon lê (GET), publisher escreve (nível de view).
    # IsOwnerOrAdmin (object-level): só o AUTOR ou admin/dev pode PATCH/DELETE.
    # Sem o segundo, qualquer editor editava/deletava artigo de QUALQUER outro
    # editor via API (a restrição existia só no frontend — trivial de burlar).
    permission_classes = [IsPublisherOrReadOnly, IsOwnerOrAdmin]
    lookup_field       = 'slug'
    queryset           = Article.objects.select_related('author', 'category')

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return ArticleWriteSerializer
        return ArticleDetailSerializer

    def perform_update(self, serializer):
        data = {}
        new_status = serializer.validated_data.get('status')
        obj = self.get_object()
        if new_status == 'published' and obj.status != 'published':
            data['published_at'] = timezone.now()
        serializer.save(**data)


class ArticleViewCountView(APIView):
    """Bump de view_count em artigo publicado, com bucket anti-abuse.

    Bucket: 1 incremento por (slug, IP) a cada 5min. Resposta é sempre 204
    — mesmo quando o bucket bloqueia — porque o frontend não precisa saber
    se o view foi contado ou não (não afeta UX). Atacante que dispara
    `curl POST` em loop não consegue inflar a métrica para o mesmo artigo
    mais que 12×/hora a partir de um único IP.

    Limitação conhecida (até A20 — Redis entrar): em produção com gunicorn
    workers=3, cada worker tem seu próprio LocMemCache → mesmo IP pode
    atingir até 3 buckets distintos = ~36×/hora. Aceitável como melhoria
    intermediária; resolve quando o cache for compartilhado via Redis.

    Item C4 do Improvement-system.md §11.1.
    """
    permission_classes = [AllowAny]

    BUCKET_TTL = 300  # 5 minutos

    def post(self, request, slug):
        bucket_key = f'view_count:{slug}:{get_client_ip(request) or "0.0.0.0"}'
        if cache.get(bucket_key):
            return Response(status=status.HTTP_204_NO_CONTENT)

        # `add` é atômico (returns False se key já existe), evita race entre
        # duas requests simultâneas do mesmo IP que ambas passariam no get().
        if not cache.add(bucket_key, True, timeout=self.BUCKET_TTL):
            return Response(status=status.HTTP_204_NO_CONTENT)

        Article.objects.filter(slug=slug, status='published').update(
            view_count=F('view_count') + 1
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
