from django.db.models import Count, F, Q
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.permissions import IsPublisherOrReadOnly
from .models import Article, Category
from .serializers import (
    ArticleDetailSerializer,
    ArticleListSerializer,
    ArticleWriteSerializer,
    CategorySerializer,
)


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
        qs = Article.objects.select_related('author', 'category').annotate(
            comment_count=Count('comments', filter=Q(comments__is_deleted=False))
        )
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
    permission_classes = [IsPublisherOrReadOnly]
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
    permission_classes = [AllowAny]

    def post(self, request, slug):
        Article.objects.filter(slug=slug, status='published').update(
            view_count=F('view_count') + 1
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
