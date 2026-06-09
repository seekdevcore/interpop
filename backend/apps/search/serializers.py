"""Serializers DRF do endpoint ``/api/v1/search/articles/``.

Composição:

    - :class:`SearchQuerySerializer` valida QUERY STRING (q, filtros,
      cursor, per_page) → :class:`apps.search.dto.QuerySpec`.
    - :class:`SearchResultItemSerializer` projeta :class:`ResultItem` no JSON
      contratual (ADR-023).
    - :class:`SearchResultPageSerializer` envelopa o page final.

Defesa H-01 (SECURITY-REVIEW): ``q`` é validado contra whitelist
alfanumérico + acento + espaço + hífen. Chars HTML levantam 400
``invalid_chars``. ``normalize_search_text`` aplica camada redundante.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Final

from django.conf import settings
from rest_framework import serializers

from .dto import QuerySpec


# Whitelist alinhada com `utils._ALLOWED_CHARS_RE` (camadas redundantes).
# Aqui o teste é ESTRITO (qualquer char fora → 400) para garantir input
# limpo já no serializer — defesa H-01 sem depender da normalização.
_Q_ALLOWED_RE: Final[re.Pattern[str]] = re.compile(r'^[a-zA-ZÀ-ſ0-9\s\-]+$')


class SearchQuerySerializer(serializers.Serializer):
    """Serializa a query string em :class:`QuerySpec`.

    Validação aderente a ADR-023 + DESIGN §2.4:

        - ``q``: required, 2 ≤ len ≤ 200, whitelist chars (H-01 defesa)
        - ``author``: UUID opcional
        - ``category``: int opcional
        - ``de``, ``ate``: ISO8601 opcionais
        - ``cursor``: string opcional
        - ``per_page``: int default 20, max 50
    """

    q = serializers.CharField(
        required=True, allow_blank=False, trim_whitespace=True,
    )
    author = serializers.UUIDField(required=False, allow_null=True)
    category = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    de = serializers.DateTimeField(required=False, allow_null=True)
    ate = serializers.DateTimeField(required=False, allow_null=True)
    cursor = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    per_page = serializers.IntegerField(
        required=False,
        min_value=1,
        # Limit aplicado em validate_per_page para usar settings, não literal.
    )

    def validate_q(self, value: str) -> str:
        """Whitelist H-01 + bounds 2..200 chars."""
        if len(value) < settings.SEARCH_MIN_Q_LENGTH:
            raise serializers.ValidationError(
                {'error': 'query_too_short',
                 'detail': f'mínimo {settings.SEARCH_MIN_Q_LENGTH} caracteres'},
                code='query_too_short',
            )
        if len(value) > settings.SEARCH_MAX_Q_LENGTH:
            raise serializers.ValidationError(
                {'error': 'query_too_long',
                 'detail': f'máximo {settings.SEARCH_MAX_Q_LENGTH} caracteres'},
                code='query_too_long',
            )
        if not _Q_ALLOWED_RE.match(value):
            # Defesa H-01 — chars HTML (<, >, /, &, ") rejeitados.
            raise serializers.ValidationError(
                {'error': 'invalid_chars',
                 'detail': 'caracteres não permitidos (apenas letras, '
                           'números, acentos, espaço e hífen)'},
                code='invalid_chars',
            )
        return value

    def validate_per_page(self, value: int) -> int:
        if value > settings.SEARCH_MAX_PER_PAGE:
            raise serializers.ValidationError(
                {'error': 'per_page_too_large',
                 'detail': f'máximo {settings.SEARCH_MAX_PER_PAGE}'},
                code='per_page_too_large',
            )
        return value

    def validate(self, attrs: dict) -> dict:
        """Validações cruzadas: de ≤ ate."""
        de: datetime | None = attrs.get('de')
        ate: datetime | None = attrs.get('ate')
        if de and ate and de > ate:
            raise serializers.ValidationError(
                {'error': 'invalid_date_range',
                 'detail': '`de` deve ser ≤ `ate`'},
                code='invalid_date_range',
            )
        return attrs

    def to_query_spec(self) -> QuerySpec:
        """Converte para DTO frozen (após is_valid())."""
        data = self.validated_data
        return QuerySpec(
            q=data['q'],
            author_id=data.get('author'),
            category_id=data.get('category'),
            de=data.get('de'),
            ate=data.get('ate'),
            cursor=data.get('cursor') or None,
            per_page=data.get('per_page', settings.SEARCH_DEFAULT_PER_PAGE),
        )


# ── Output ───────────────────────────────────────────────────────────────────


class _AuthorSerializer(serializers.Serializer):
    id = serializers.CharField()
    display_name = serializers.CharField()
    slug = serializers.CharField()


class _CategorySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    slug = serializers.CharField()


class SearchResultItemSerializer(serializers.Serializer):
    """Projeta :class:`ResultItem` no JSON do ADR-023."""

    id = serializers.UUIDField(source='article_id')
    title = serializers.CharField()
    slug = serializers.CharField()
    excerpt = serializers.CharField()
    published_at = serializers.DateTimeField()
    author = _AuthorSerializer()
    category = _CategorySerializer(allow_null=True)
    cover_url = serializers.CharField(allow_null=True)
    score = serializers.FloatField()


class SearchResultPageSerializer(serializers.Serializer):
    """Envelopa :class:`SearchResultPage` em resposta JSON.

    Inclui ``query_terms_expanded`` (Inv #11) para highlighting client-side
    correto com stems pt-BR.
    """

    results = SearchResultItemSerializer(many=True)
    next_cursor = serializers.CharField(allow_null=True)
    total_estimate = serializers.IntegerField()
    query_terms_expanded = serializers.ListField(
        child=serializers.CharField(),
    )
    took_ms = serializers.IntegerField()
