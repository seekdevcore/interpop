"""SearchArticlesView — endpoint ``GET /api/v1/search/articles/``.

Stack DRF: APIView GET-only + 3 throttles + permissão AllowAny.
Feature flag: ``SEARCH_FEATURE_ENABLED`` (TX-13 / T30.1.X4). False → 503
+ ``Retry-After`` para cutover deliberado em prod.

Cache HTTP (ADR-023):
    Cache-Control: public, max-age=60, stale-while-revalidate=300
    Vary: Authorization, Accept-Encoding

Cache Redis (ADR-037 / H-04):
    Key: search:v1:<auth_tier>:<sha256> — anon e user separados.

SECURITY (comment-locks):
    - Response é function-pure de (q, filters, cursor). NÃO adicionar
      campos por-usuário (bookmarked, read). H-04.
    - Queries usam parametrização (cursor.execute params). NÃO .extra(),
      NÃO RawSQL(). M-01.
"""
from __future__ import annotations

import logging
from typing import Final

from django.conf import settings
from django.core.cache import cache
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .cache import build_cache_key
from .cursors import InvalidCursorError
from .serializers import SearchQuerySerializer, SearchResultPageSerializer
from .services import SearchService, TooManyTokensError
from .throttles import (
    SearchAnonThrottle,
    SearchGlobalThrottle,
    SearchUserThrottle,
)


logger = logging.getLogger('interpop.search.view')


# Cache HTTP header (ADR-023). NÃO uses `private` — depende de auth_tier
# isolation no Redis (ADR-037) + Vary para CDN.
_CACHE_CONTROL_HEADER: Final[str] = (
    'public, max-age=60, stale-while-revalidate=300'
)
# Vary: Authorization separa cache de anon/user em CDN (Cloudflare).
# Accept-Encoding para preservar compressão.
_VARY_HEADER: Final[str] = 'Authorization, Accept-Encoding'


class SearchArticlesView(APIView):
    """``GET /api/v1/search/articles/`` — busca editorial full-text.

    Permissões: AllowAny (anônimo OK; autenticado tem tier 60/min vs 30/min).
    Throttles: anon + user + global (defesa H-03 botnet ADR-036).
    """

    http_method_names = ['get']
    permission_classes = [AllowAny]
    throttle_classes = [
        SearchAnonThrottle,
        SearchUserThrottle,
        SearchGlobalThrottle,
    ]

    def get(self, request) -> Response:
        # ── Feature flag (T30.1.X4) ────────────────────────────────────────
        if not settings.SEARCH_FEATURE_ENABLED:
            response = Response(
                {'error': 'feature_disabled',
                 'detail': 'Busca temporariamente indisponível'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
            response['Retry-After'] = '60'
            return response

        # ── Validação da query ─────────────────────────────────────────────
        serializer = SearchQuerySerializer(data=request.query_params)
        if not serializer.is_valid():
            # Pega primeiro erro estruturado para resposta consistente.
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        spec = serializer.to_query_spec()

        # ── Cache HIT antes de bater no DB (ADR-037 H-04) ──────────────────
        auth_tier = 'user' if request.user.is_authenticated else 'anon'
        cache_key = build_cache_key(spec, auth_tier=auth_tier)
        cached = cache.get(cache_key)
        if cached is not None:
            response = Response(cached, status=status.HTTP_200_OK)
            self._apply_cache_headers(response)
            response['X-Cache'] = 'HIT'
            return response

        # ── Service ────────────────────────────────────────────────────────
        service = SearchService()
        try:
            page = service.query(spec)
        except InvalidCursorError as exc:
            logger.info(
                'search.cursor_invalid', extra={'detail': str(exc)},
            )
            return Response(
                {'error': 'cursor_invalid',
                 'detail': 'Cursor inválido. Recomece a paginação.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except TooManyTokensError as exc:
            return Response(
                {'error': 'query_too_complex',
                 'detail': str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Serializa + grava em cache ─────────────────────────────────────
        body = SearchResultPageSerializer(page).data
        cache.set(cache_key, body, timeout=settings.SEARCH_CACHE_TTL_SECONDS)

        response = Response(body, status=status.HTTP_200_OK)
        self._apply_cache_headers(response)
        response['X-Cache'] = 'MISS'
        return response

    @staticmethod
    def _apply_cache_headers(response: Response) -> None:
        """Aplica Cache-Control + Vary + X-Robots-Tag (T30.4.X11)."""
        response['Cache-Control'] = _CACHE_CONTROL_HEADER
        response['Vary'] = _VARY_HEADER
        # Busca não é indexável (T30.4.X11 / L-05 SECURITY-REVIEW).
        response['X-Robots-Tag'] = 'noindex, nofollow'
