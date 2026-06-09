from rest_framework import serializers
from apps.users.serializers import UserPublicSerializer
from .models import Comment


class ReplySerializer(serializers.ModelSerializer):
    author      = UserPublicSerializer(read_only=True)
    likes_count = serializers.IntegerField(read_only=True, default=0)
    is_liked    = serializers.BooleanField(read_only=True, default=False)

    class Meta:
        model  = Comment
        fields = ['id', 'author', 'content', 'created_at', 'likes_count', 'is_liked']
        read_only_fields = fields


class CommentSerializer(serializers.ModelSerializer):
    author        = UserPublicSerializer(read_only=True)
    likes_count   = serializers.IntegerField(read_only=True, default=0)
    is_liked      = serializers.BooleanField(read_only=True, default=False)
    replies_count = serializers.SerializerMethodField()
    replies       = ReplySerializer(many=True, read_only=True)
    parent_id     = serializers.UUIDField(write_only=True, required=False, allow_null=True)

    class Meta:
        model  = Comment
        fields = [
            'id', 'author', 'content', 'parent_id',
            'created_at', 'likes_count', 'is_liked',
            'replies_count', 'replies',
        ]
        read_only_fields = [
            'id', 'author', 'created_at',
            'likes_count', 'is_liked', 'replies_count', 'replies',
        ]

    def get_replies_count(self, obj) -> int:
        # `replies` vem prefetchado (Prefetch em CommentListCreateView) — len()
        # usa o cache, zero query extra. Sem try/except: se o prefetch quebrar
        # num refactor, queremos o erro VISÍVEL, não um 0 silencioso mascarando
        # bug (o except Exception engolia TudoDoesNotExist/AttributeError).
        return len(obj.replies.all())

    def validate_parent_id(self, value):
        if value is None:
            return value
        article = self.context.get('article')
        if not Comment.objects.filter(pk=value, article=article, is_deleted=False, parent=None).exists():
            raise serializers.ValidationError('Comentário pai inválido ou não encontrado.')
        return value

    def create(self, validated_data):
        parent_id = validated_data.pop('parent_id', None)
        validated_data['author']  = self.context['request'].user
        validated_data['article'] = self.context['article']
        if parent_id:
            validated_data['parent_id'] = parent_id
        return super().create(validated_data)
