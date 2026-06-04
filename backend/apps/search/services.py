"""SearchService — query orquestrada full-text com 12 invariantes.

Esta é a implementação canônica dos 12 invariantes do
``_specialist-outputs/02-algorithms-architect.md §8``. Cada bloco abaixo
referencia o número da invariante que ele defende.

Fluxo (algorithms §7):

    1. Decode cursor (Inv 5) — InvalidCursorError → 400 no view.
    2. Normalize q (Inv 2) — função única em ``apps.search.utils``.
    3. Validate token cap (Inv 8) — TooManyTokensError → 400.
    4. Empty-tsquery early-exit (Inv 7) — 0 hits Postgres.
    5. SQLite fallback: __icontains via Article queryset (ADR-020).
    6. Postgres: CTE candidates (LIMIT 500 M1) + scored (recency boost
       Inv 10) + cursor tuple compare (Inv 6 ROUND 6).
    7. SET LOCAL statement_timeout (Inv 12).
    8. plainto_tsquery (Inv 3) — operadores ignorados.
    9. Status filter sempre (Inv 4) — drafts/agendados nunca vazam.
   10. Side-fetch Article side-relation via in_bulk (anti N+1).
   11. ts_lexize portuguese_stem → query_terms_expanded (Inv 11).
   12. estimate_total via plan_rows ou floor (ADR-025).
   13. Cap depth 50 (Inv 9) — encoded no novo cursor.

Inv #1 (determinismo) emerge: DTOs frozen + função pura + ORDER BY
tie-breaker (score DESC, published_at DESC, article_id ASC) → mesma
input → mesma ordem.

SECURITY:
    - Queries SEMPRE via parametrização (`cursor.execute(sql, params)`
      ou QuerySet .filter). NUNCA `.extra(where=)` ou `raw()` aqui.
      (Comment-lock M-01 do SECURITY-REVIEW.)
    - Response é function-pure de (q, filters, cursor). NÃO adicionar
      campos por-usuário (bookmarked, read_history) sem rever ADR-037
      (H-04 cross-tier leak).
"""
from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime
from typing import Final

from django.conf import settings
from django.db import connection

from apps.articles.models import Article

from .cursors import decode_cursor, encode_cursor
from .dto import CursorPayload, QuerySpec, ResultItem, SearchResultPage
from .utils import normalize_search_text


logger = logging.getLogger('interpop.search.service')


# Stopwords pt-BR mínimas para o early-exit Inv #7. Lista canônica vive
# no Postgres (`portuguese.stop`), mas precisamos de uma checagem barata
# em Python para abortar antes de bater no DB. Conjunto pequeno cobre o
# adversarial input típico ("o de da que e em").
_PT_BR_STOPWORDS: Final[frozenset[str]] = frozenset({
    'a', 'o', 'e', 'é', 'em', 'de', 'da', 'do', 'das', 'dos',
    'um', 'uma', 'uns', 'umas', 'que', 'se', 'no', 'na', 'nos',
    'nas', 'por', 'para', 'com', 'como', 'mas', 'ou',
})


class TooManyTokensError(ValueError):
    """Inv #8 — cap de tokens excedido. View traduz para 400 query_too_complex."""


# ── Helpers públicos ─────────────────────────────────────────────────────────


def estimate_total(
    *, results_len: int, per_page: int, plan_rows: int, page_count: int,
) -> int:
    """ADR-025 — total_estimate com floor por evidência empírica.

    Args:
        results_len: tamanho dos resultados desta página.
        per_page: page size.
        plan_rows: estimativa do EXPLAIN (heurística do planner).
        page_count: nº da página atual (1-indexed).

    Returns:
        ``max(plan_rows, (page_count - 1) * per_page + results_len)``.

        O floor garante que ``total_estimate`` nunca seja menor que a
        evidência empírica de páginas já vistas (planner pode subestimar).
    """
    floor = (page_count - 1) * per_page + results_len
    return max(plan_rows, floor)


def _significant_tokens(normalized: str) -> list[str]:
    """Tokens significativos = não stopwords e não vazios."""
    return [t for t in normalized.split() if t and t not in _PT_BR_STOPWORDS]


def _is_empty_tsquery(normalized: str) -> bool:
    """Inv #7 — empty se string vazia OU só stopwords."""
    return not _significant_tokens(normalized)


# ── SearchService ────────────────────────────────────────────────────────────


class SearchService:
    """Serviço de busca editorial — entry point público (ADR-017).

    Sem Repository abstrato (DJango ORM já é Repository). Sem state
    interno — instâncias podem ser criadas livremente; teste e prod
    compartilham a mesma classe.

    Uso::

        page = SearchService().query(QuerySpec(q='kpop'))
    """

    def query(self, spec: QuerySpec) -> SearchResultPage:
        """Executa a busca conforme a spec.

        Erros conhecidos (view captura cada um para retornar 400):

            - :exc:`apps.search.cursors.InvalidCursorError` — cursor ruim.
            - :exc:`TooManyTokensError` — > SEARCH_MAX_TOKENS tokens.
        """
        t0 = time.perf_counter()

        # 1. Decode cursor — Inv 5 (InvalidCursorError propaga).
        cursor_payload: CursorPayload | None = None
        if spec.cursor:
            cursor_payload = decode_cursor(spec.cursor)

        # 2. Normalize — Inv 2 (simétrico com signal e indexing).
        q_norm = normalize_search_text(spec.q)

        # 3. Validação de tokens significativos — Inv 8.
        sig_tokens = _significant_tokens(q_norm)
        if len(sig_tokens) > settings.SEARCH_MAX_TOKENS:
            raise TooManyTokensError(
                f'{len(sig_tokens)} tokens significativos — '
                f'cap é {settings.SEARCH_MAX_TOKENS}'
            )

        # 4. Empty tsquery early-exit — Inv 7.
        if _is_empty_tsquery(q_norm):
            took_ms = int((time.perf_counter() - t0) * 1000)
            return SearchResultPage(
                results=(),
                next_cursor=None,
                total_estimate=0,
                query_terms_expanded=(),
                took_ms=took_ms,
            )

        # 5. Bifurca por vendor (ADR-020).
        if connection.vendor != 'postgresql':
            return self._query_sqlite_fallback(spec, q_norm, t0)

        # 6. Postgres path — CTE + recency + cursor + side-fetch.
        return self._query_postgres(spec, q_norm, sig_tokens, cursor_payload, t0)

    # ── SQLite-dev fallback (ADR-020) ──────────────────────────────────────

    def _query_sqlite_fallback(
        self, spec: QuerySpec, q_norm: str, t0: float,
    ) -> SearchResultPage:
        """Fallback __icontains para SQLite-dev. Sem FTS real, sem ranking
        sofisticado — apenas garante que o pipeline roda end-to-end em dev.

        Mantém Inv #4 (status filter), Inv #1 (determinismo via ORDER BY).
        """
        qs = (
            Article.objects.filter(
                status=Article.Status.PUBLISHED,
                published_at__isnull=False,
            )
            .filter(title__icontains=spec.q)
            .select_related('author', 'category')
            .order_by('-published_at', 'id')[: spec.per_page + 1]
        )
        rows = list(qs)
        has_more = len(rows) > spec.per_page
        rows = rows[: spec.per_page]

        items = tuple(_article_to_result(row, score=0.0) for row in rows)
        took_ms = int((time.perf_counter() - t0) * 1000)

        next_cursor: str | None = None
        if has_more and rows:
            last = rows[-1]
            next_cursor = encode_cursor(CursorPayload(
                score=0.0,
                published_at=last.published_at,
                article_id=last.id,
                depth=1,
            ))

        return SearchResultPage(
            results=items,
            next_cursor=next_cursor,
            total_estimate=estimate_total(
                results_len=len(items),
                per_page=spec.per_page,
                plan_rows=len(items),  # SQLite — sem EXPLAIN ROWS
                page_count=1,
            ),
            query_terms_expanded=tuple(q_norm.split()),
            took_ms=took_ms,
        )

    # ── Postgres path (algorithms §7 SQL completo) ─────────────────────────

    def _query_postgres(
        self,
        spec: QuerySpec,
        q_norm: str,
        sig_tokens: list[str],
        cursor: CursorPayload | None,
        t0: float,
    ) -> SearchResultPage:  # pragma: no cover — exercitado em integration
        """Path Postgres: CTE candidates + scored + cursor tuple compare."""
        # Inv 12 — statement_timeout por TX (defesa T30.4.X9, independente
        # do role Postgres).
        self._apply_statement_timeout()

        page_count = (cursor.depth + 1) if cursor else 1

        # SECURITY M-01: queries com parametrização posicional.
        sql = """
        WITH q AS (
            SELECT plainto_tsquery('portuguese', %(q_norm)s) AS query
        ),
        candidates AS (
            SELECT si.article_id, si.published_at,
                   si.author_id, si.category_id,
                   ts_rank_cd(si.search_vector, q.query, 32) AS rank_raw
            FROM search_index si, q
            WHERE
                si.search_vector @@ q.query
                AND q.query IS DISTINCT FROM ''::tsquery
                AND (%(author_id)s::uuid IS NULL OR si.author_id = %(author_id)s::uuid)
                AND (%(cat_id)s::bigint IS NULL OR si.category_id = %(cat_id)s::bigint)
                AND (%(de)s::timestamptz IS NULL OR si.published_at >= %(de)s::timestamptz)
                AND (%(ate)s::timestamptz IS NULL OR si.published_at <= %(ate)s::timestamptz)
            ORDER BY rank_raw DESC
            LIMIT %(candidates_limit)s
        ),
        scored AS (
            SELECT article_id, published_at,
                   ROUND(
                     (rank_raw * exp(-EXTRACT(EPOCH FROM (NOW() - published_at))
                                      / (86400.0 * %(half_life)s)))::numeric, 6
                   )::float AS score
            FROM candidates
        )
        SELECT article_id, score, published_at
        FROM scored
        WHERE
            %(cursor_score)s::float IS NULL
            OR (score, published_at, article_id)
               < (%(cursor_score)s::float,
                  %(cursor_pub)s::timestamptz,
                  %(cursor_id)s::uuid)
        ORDER BY score DESC, published_at DESC, article_id ASC
        LIMIT %(limit)s;
        """

        params = {
            'q_norm': q_norm,
            'author_id': str(spec.author_id) if spec.author_id else None,
            'cat_id': spec.category_id,
            'de': spec.de,
            'ate': spec.ate,
            'candidates_limit': settings.SEARCH_CANDIDATES_LIMIT,
            'half_life': settings.SEARCH_RECENCY_HALF_LIFE_DAYS,
            'cursor_score': cursor.score if cursor else None,
            'cursor_pub': cursor.published_at if cursor else None,
            'cursor_id': str(cursor.article_id) if cursor else None,
            'limit': spec.per_page + 1,  # +1 para detectar has_more
        }

        with connection.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()

        has_more = len(rows) > spec.per_page
        rows = rows[: spec.per_page]

        # Side-fetch artigos (anti N+1).
        ids = [r[0] for r in rows]
        articles = (
            Article.objects.filter(id__in=ids)
            .select_related('author', 'category')
            .in_bulk(field_name='id')
        )
        # Preserva ordem do ranking.
        items: list[ResultItem] = []
        for article_id, score, _pub in rows:
            article = articles.get(article_id)
            if article is None:
                continue  # raríssimo (drift entre search_index e articles)
            items.append(_article_to_result(article, score=score))

        # Inv #11 — query_terms_expanded via ts_lexize portuguese_stem
        terms = self._expand_stems(sig_tokens)

        # Próximo cursor (Inv 9 — cap em decode_cursor)
        next_cursor: str | None = None
        if has_more and rows:
            last_id, last_score, last_pub = rows[-1]
            next_cursor = encode_cursor(CursorPayload(
                score=last_score,
                published_at=last_pub,
                article_id=uuid.UUID(str(last_id)),
                depth=page_count,
            ))

        # ADR-025 — total_estimate
        plan_rows = self._explain_estimate(sql, params)
        total = estimate_total(
            results_len=len(items),
            per_page=spec.per_page,
            plan_rows=plan_rows,
            page_count=page_count,
        )

        took_ms = int((time.perf_counter() - t0) * 1000)
        return SearchResultPage(
            results=tuple(items),
            next_cursor=next_cursor,
            total_estimate=total,
            query_terms_expanded=tuple(terms),
            took_ms=took_ms,
        )

    # ── Internal helpers ───────────────────────────────────────────────────

    def _apply_statement_timeout(self) -> None:  # pragma: no cover — Postgres
        """Inv #12 — SET LOCAL statement_timeout por TX (defesa T30.4.X9).

        Independente do role Postgres (defesa em profundidade).
        """
        ms = settings.SEARCH_STATEMENT_TIMEOUT_MS
        with connection.cursor() as cur:
            cur.execute(f"SET LOCAL statement_timeout = '{int(ms)}ms';")

    def _expand_stems(self, tokens: list[str]) -> list[str]:  # pragma: no cover — Postgres
        """Inv #11 — ts_lexize('portuguese_stem', token) por token."""
        if not tokens:
            return []
        with connection.cursor() as cur:
            cur.execute(
                "SELECT ts_lexize('portuguese_stem', t) FROM unnest(%s::text[]) AS t;",
                [tokens],
            )
            rows = cur.fetchall()
        # ts_lexize retorna text[] (None se stopword)
        expanded: list[str] = []
        seen: set[str] = set()
        for row in rows:
            lex_array = row[0] or []
            for stem in lex_array:
                if stem and stem not in seen:
                    seen.add(stem)
                    expanded.append(stem)
        return expanded

    def _explain_estimate(self, sql: str, params: dict) -> int:  # pragma: no cover — Postgres
        """ADR-025 — extrai Plan Rows do EXPLAIN (FORMAT JSON)."""
        try:
            with connection.cursor() as cur:
                cur.execute(f'EXPLAIN (FORMAT JSON) {sql}', params)
                result = cur.fetchone()
            if not result:
                return 0
            plan = result[0][0]['Plan']
            return int(plan.get('Plan Rows', 0))
        except Exception:  # noqa: BLE001 — EXPLAIN é best-effort
            logger.exception('search.estimate.explain_failed')
            return 0


# ── ResultItem mapper ────────────────────────────────────────────────────────


def _article_to_result(article: Article, *, score: float) -> ResultItem:
    """Mapeia Article ORM → ResultItem frozen.

    Author/category são dicts pequenos (não entidades) — anti coupling.
    """
    author = {
        'id': str(article.author_id),
        'display_name': (
            article.author.get_full_name() or article.author.username
        ),
        'slug': getattr(article.author, 'username', ''),
    }
    category = None
    if article.category_id:
        category = {
            'id': article.category_id,
            'name': article.category.name,
            'slug': article.category.slug,
        }
    cover_url: str | None = None
    if article.cover_image:
        try:
            cover_url = article.cover_image.url
        except (ValueError, AttributeError):
            cover_url = None

    published_at: datetime = article.published_at  # type: ignore[assignment]
    return ResultItem(
        article_id=article.id,
        title=article.title,
        slug=article.slug,
        excerpt=article.excerpt,
        published_at=published_at,
        author=author,
        category=category,
        cover_url=cover_url,
        score=float(score),
    )
