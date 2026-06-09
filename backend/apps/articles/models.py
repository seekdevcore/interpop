import uuid
from django.conf import settings
from django.db import models
from django.utils.text import slugify


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True, blank=True)

    class Meta:
        db_table  = 'categories'
        ordering  = ['name']
        verbose_name_plural = 'categorias'

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name, allow_unicode=True)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Article(models.Model):
    class Status(models.TextChoices):
        DRAFT     = 'draft',     'Rascunho'
        PUBLISHED = 'published', 'Publicado'

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title       = models.CharField(max_length=500)
    slug        = models.SlugField(max_length=520, unique=True, blank=True, db_index=True)
    excerpt     = models.TextField(max_length=1000)
    body        = models.TextField()
    cover_image = models.ImageField(upload_to='covers/%Y/%m/', null=True, blank=True)
    # Legenda da capa (padrão G1 / Folha / Estadão):
    # "Pessoa retratada — Foto: Agência / Fotógrafo"
    cover_caption = models.CharField(
        max_length=300,
        blank=True,
        default='',
        help_text='Legenda da imagem de capa (autor da foto, contexto).',
    )
    author      = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='articles',
    )
    category    = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='articles',
    )
    status      = models.CharField(max_length=12, choices=Status.choices, default=Status.DRAFT, db_index=True)
    is_featured = models.BooleanField(default=False, db_index=True)
    view_count  = models.PositiveIntegerField(default=0)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'articles'
        ordering = ['-published_at', '-created_at']
        indexes  = [
            models.Index(fields=['status', '-published_at']),
            models.Index(fields=['author', 'status']),
        ]

    def _unique_slug(self) -> str:
        base = slugify(self.title, allow_unicode=True)[:500]
        slug, n = base, 1
        while Article.objects.filter(slug=slug).exclude(pk=self.pk).exists():
            slug, n = f'{base}-{n}', n + 1
        return slug

    def save(self, *args, **kwargs):
        from django.db import transaction

        if not self.slug:
            self.slug = self._unique_slug()
        # Destaque único: marcar este como featured desmarca todos os outros.
        # Padrão NYT/Substack — só 1 matéria ocupa o hero da home. Sem isso,
        # Home.tsx (find(is_featured)) pegaria um featured arbitrário quando
        # houvesse 2+. 2 writes (save + update) → atomic por ADR-012.
        with transaction.atomic():
            super().save(*args, **kwargs)
            if self.is_featured:
                Article.objects.filter(is_featured=True).exclude(pk=self.pk).update(
                    is_featured=False
                )

    def __str__(self):
        return self.title
