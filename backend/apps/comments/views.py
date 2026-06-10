from django.db.models import Count, Exists, OuterRef, Prefetch
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.articles.models import Article
from apps.users.permissions import IsNotBanned, IsOwnerOrAdmin
from .models import Comment, CommentLike
from .serializers import CommentSerializer


def _reply_qs(user):
    qs = Comment.objects.filter(is_deleted=False).select_related('author').annotate(
        likes_count=Count('likes', distinct=True),
    )
    if user and user.is_authenticated:
        qs = qs.annotate(
            is_liked=Exists(CommentLike.objects.filter(comment=OuterRef('pk'), user=user))
        )
    return qs.order_by('created_at')


class CommentListCreateView(generics.ListCreateAPIView):
    serializer_class = CommentSerializer

    # S-07 (CONCERNS / F-20 CA12): anti-flood em POST. Scope 'comments_create'
    # configurado em base.py com 10/min. `get_throttles()` retorna lista vazia
    # em GET — listagem permanece sob throttle global 'user'/'anon' default.
    throttle_scope = 'comments_create'

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated(), IsNotBanned()]

    def get_throttles(self):
        if self.request.method == 'POST':
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def get_article(self):
        return generics.get_object_or_404(Article, slug=self.kwargs['slug'], status='published')

    def get_queryset(self):
        user = self.request.user
        qs = Comment.objects.filter(
            article__slug=self.kwargs['slug'],
            is_deleted=False,
            parent=None,
        ).select_related('author').prefetch_related(
            Prefetch('replies', queryset=_reply_qs(user))
        ).annotate(
            likes_count=Count('likes', distinct=True),
        )
        if user and user.is_authenticated:
            qs = qs.annotate(
                is_liked=Exists(CommentLike.objects.filter(comment=OuterRef('pk'), user=user))
            )
        return qs.order_by('-created_at')

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['article'] = self.get_article()
        return ctx


class CommentDestroyView(generics.DestroyAPIView):
    permission_classes = [IsAuthenticated, IsOwnerOrAdmin]
    queryset           = Comment.objects.all()
    lookup_field       = 'pk'

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.deleted_at = timezone.now()
        instance.deleted_by = self.request.user
        instance.save(update_fields=['is_deleted', 'deleted_at', 'deleted_by'])


class CommentLikeToggleView(APIView):
    permission_classes = [IsAuthenticated, IsNotBanned]

    def post(self, request, pk):
        comment = generics.get_object_or_404(Comment, pk=pk, is_deleted=False)
        like, created = CommentLike.objects.get_or_create(comment=comment, user=request.user)
        if not created:
            like.delete()
            liked = False
        else:
            liked = True
        likes_count = CommentLike.objects.filter(comment=comment).count()
        return Response({'liked': liked, 'likes_count': likes_count}, status=status.HTTP_200_OK)
