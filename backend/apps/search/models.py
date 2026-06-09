"""Models do app de busca editorial.

Os models aqui são **managed = False** porque a tabela ``search_index`` é
criada e mantida via SQL puro nas migrations (extension ``unaccent``,
``CONFIGURATION pt_unaccent``, função ``articles_search_config`` e trigger SQL
``trg_articles_sync_search`` — ADR-018, ADR-019). O ORM Django apenas mapeia a
tabela para uso em queries, mas NÃO controla seu schema (ADR-018 deixa a
trigger como fonte de verdade da consistência).

Por que ``managed = False``:
    - Schema tem extensions, configurations e funções SQL que o ORM não
      consegue expressar.
    - O conjunto de índices é definido em ``RunSQL`` (CONCURRENTLY, partial,
      INCLUDE) — também fora do alcance do ORM.
    - Trigger é a fonte de verdade da sincronia; ORM não deve "achar" que é
      dono do schema.

Em ambientes SQLite-dev (DESIGN §3.6 / ADR-020), a tabela é criada via fallback
mínimo na migration 0001 (sem extension, sem trigger, sem GIN). O SearchService
faz fallback ``__icontains`` quando ``connection.vendor != 'postgresql'``.
"""
from __future__ import annotations

from django.conf import settings
from django.db import models


class SearchIndex(models.Model):
    """Read-projection de :class:`apps.articles.models.Article` otimizada para FTS.

    Esta tabela é populada exclusivamente pela trigger Postgres
    ``trg_articles_sync_search`` (ADR-018). Código Python NUNCA escreve aqui
    diretamente — qualquer write é violação do ADR.

    Campos:
        article_id: FK 1:1 para ``articles.id`` (UUID). Chave primária da projeção.
        search_vector: ``tsvector`` composto por ``setweight`` A/B/C (título,
            excerpt, body) usando a configuration ``pt_unaccent`` (ADR-019).
        title_text/excerpt_text/body_text: cópias do texto original (usados em
            highlighting via ``ts_headline`` server-side, se decidido — DESIGN
            §3.7).
        author_id: cópia de ``Article.author_id`` (UUID) para filtros sem JOIN.
        category_id: cópia de ``Article.category_id`` (BIGINT, nullable) para
            filtros sem JOIN.
        published_at: cópia para ordenação por recência (recency decay).
        indexed_at: timestamp do último upsert pela trigger (debug/diagnóstico).
    """

    article_id = models.UUIDField(primary_key=True, db_column='article_id')
    # search_vector é tsvector em Postgres. SQLite-dev mapeia para TEXT (NULL)
    # apenas para que o ORM não exploda; queries reais ficam Postgres-only.
    search_vector = models.TextField(db_column='search_vector', null=True, blank=True)
    title_text = models.TextField(db_column='title_text')
    excerpt_text = models.TextField(db_column='excerpt_text', blank=True, default='')
    body_text = models.TextField(db_column='body_text')
    author_id = models.UUIDField(db_column='author_id')
    category_id = models.BigIntegerField(db_column='category_id', null=True, blank=True)
    published_at = models.DateTimeField(db_column='published_at')
    indexed_at = models.DateTimeField(db_column='indexed_at')

    class Meta:
        managed = False  # Schema controlado por migration SQL pura.
        db_table = 'search_index'
        verbose_name = 'Entrada do índice de busca'
        verbose_name_plural = 'Entradas do índice de busca'

    def __str__(self) -> str:
        return f'SearchIndex(article_id={self.article_id})'


class SearchLog(models.Model):
    """Log estruturado de buscas para analytics e troubleshooting.

    Retenção 7 dias (LGPD — RNF e cyber-security). Purga via cron (Celery
    Beat) ou TX externa. Cada linha registra uma busca executada, sem PII do
    usuário (apenas ``user_id`` opcional, que é UUID interno).
    """

    id = models.BigAutoField(primary_key=True)
    query_text = models.TextField(blank=True, default='')
    query_norm = models.TextField(
        blank=True,
        default='',
        help_text='Query normalizada (lower, strip, sem operadores tsquery).',
    )
    filters_json = models.JSONField(
        blank=True,
        default=dict,
        help_text='Snapshot dos filtros aplicados (autor, categoria, datas).',
    )
    results_count = models.IntegerField(default=0)
    total_estimate = models.IntegerField(
        default=0,
        help_text='Estimativa via EXPLAIN ROWS (algorithms §2.3).',
    )
    duration_ms = models.IntegerField(default=0)
    cache_hit = models.BooleanField(default=False)
    user_id = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        managed = False  # Criada em migration 0001 via RunSQL.
        db_table = 'search_log'
        verbose_name = 'Log de busca'
        verbose_name_plural = 'Logs de busca'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'SearchLog({self.query_text!r}, {self.results_count} results)'
