/**
 * Tipos do contrato `/api/v1/search/articles/` (ADR-023 / DESIGN-v3 §2.4).
 *
 * Cross-layer rule (DESIGN-v3 §3.1): zero drift FE ↔ BE. Quando o
 * `openapi-typescript` (TX-07) entrar em CI, este arquivo passa a ser
 * GERADO. Até lá, declaramos manual aqui — espelhando o que o
 * `SearchResultPageSerializer` (backend/apps/search/serializers.py)
 * realmente emite. Qualquer mudança aqui exige PR no backend também.
 */

export interface SearchAuthor {
  id: string;
  name: string;
}

export interface SearchCategory {
  id: number;
  name: string;
  slug: string;
}

export interface SearchResultItem {
  /** UUID do artigo. Backend usa `source='article_id'`. */
  id: string;
  title: string;
  slug: string;
  /** Excerpt já truncado e sanitizado pelo backend. */
  excerpt: string;
  /** ISO 8601 UTC. */
  published_at: string;
  author: SearchAuthor;
  /** Pode ser null quando o artigo está em editoria removida (ON DELETE SET NULL). */
  category: SearchCategory | null;
  /** URL absoluta da cover, ou null para placeholder por iniciais. */
  cover_url: string | null;
  /** Score combinado `ts_rank_cd` + recency (ADR-021). Não exibido. */
  score: number;
}

export interface SearchResultPage {
  results: SearchResultItem[];
  /**
   * Cursor HMAC base64 da próxima página, OU `null` quando esgotou.
   * Bug 6 do refino v3: TanStack precisa de `undefined` (não `null`) em
   * `getNextPageParam` para parar — o hook `useSearch` aplica `?? undefined`.
   */
  next_cursor: string | null;
  /** Estimativa via EXPLAIN ROWS (ADR-025), com floor por `len(results)`. */
  total_estimate: number;
  /** Stems pt-BR via `ts_lexize` (Invariant #11) — usado pelo `<HighlightedText>`. */
  query_terms_expanded: string[];
  /** Latência do service (DB + CTE + encode) em ms. Sem usar na UI MVP. */
  took_ms: number;
}

/**
 * Envelope de erro 4xx/5xx do backend (apps/search/views.py).
 * `detail` é livre; `error` é o discriminator estável para a UI.
 */
export interface SearchErrorBody {
  error:
    | 'validation_error'
    | 'query_too_short'
    | 'query_too_long'
    | 'query_too_complex'
    | 'invalid_chars'
    | 'cursor_invalid'
    | 'refine_query'
    | 'query_timeout'
    | 'rate_limit_exceeded'
    | 'feature_disabled';
  detail: string;
  /** Em 429 o backend devolve segundos até liberar (também em header `Retry-After`). */
  retry_after?: number;
}

/**
 * Argumentos do client. `q` é obrigatório e o componente garante len ≥ 2
 * via `enabled` do useInfiniteQuery (não chamar com q curto).
 */
export interface FetchSearchInput {
  q: string;
  author?: string;
  category?: number;
  de?: string;
  ate?: string;
  cursor?: string;
  per_page?: number;
}
