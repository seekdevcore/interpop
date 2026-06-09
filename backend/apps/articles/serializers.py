from rest_framework import serializers
from apps.users.serializers import UserPublicSerializer
from .models import Article, Category


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model  = Category
        fields = ['id', 'name', 'slug']


class ArticleListSerializer(serializers.ModelSerializer):
    author   = UserPublicSerializer(read_only=True)
    category = CategorySerializer(read_only=True)
    # Read from queryset annotation (set by ArticleListView) — zero extra queries.
    comment_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model  = Article
        fields = [
            'id', 'slug', 'title', 'excerpt', 'cover_image',
            'author', 'category', 'status', 'is_featured',
            'view_count', 'comment_count', 'published_at', 'created_at',
        ]


class ArticleDetailSerializer(ArticleListSerializer):
    class Meta(ArticleListSerializer.Meta):
        # cover_caption só na detail view — não inflate o payload da listagem.
        fields = ArticleListSerializer.Meta.fields + ['body', 'cover_caption', 'updated_at']


class ArticleWriteSerializer(serializers.ModelSerializer):
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), source='category', required=False, allow_null=True
    )
    # Legenda obrigatória: todo artigo publicado precisa de crédito da capa
    # (padrão G1/Folha — "Foto: Agência"). Model permite blank por
    # retrocompat com artigos antigos, mas a escrita via API exige.
    cover_caption = serializers.CharField(
        max_length=300, required=True, allow_blank=False,
        error_messages={
            'blank': 'A legenda da capa é obrigatória (ex.: "Foto: Agência").',
            'required': 'A legenda da capa é obrigatória.',
        },
    )

    class Meta:
        model  = Article
        fields = [
            'title', 'excerpt', 'body', 'cover_image', 'cover_caption',
            'category_id', 'status', 'is_featured',
        ]

    def validate(self, attrs):
        # Imagem de capa obrigatória NA CRIAÇÃO — legenda sem imagem é
        # incoerente. No update (partial), não força reenvio da imagem
        # existente. self.instance é None em create.
        is_create = self.instance is None
        if is_create and not attrs.get('cover_image'):
            raise serializers.ValidationError(
                {'cover_image': 'A imagem de capa é obrigatória.'}
            )
        return attrs

    def create(self, validated_data):
        validated_data['author'] = self.context['request'].user
        return super().create(validated_data)
