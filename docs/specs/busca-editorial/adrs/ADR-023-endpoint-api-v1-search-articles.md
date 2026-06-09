# ADR-023: Endpoint `GET /api/v1/search/articles/` (não `/articles/search/`)

- **Status**: Accepted
- **Date**: 2026-06-03
- **Tags**: backend, api-design, rest, url-versioning, drf
- **Stakeholders**: backend-architect (autor), software-architect, frontend-architect, code-implementer
- **Layer**: Backend
- **Decisão alinhada com**: roadmap.sh/backend (API design — resource modeling), ADR-010 do projeto (`/api/v1/`)

## Context

A busca tem dois shapes de URL candidatos:

- `GET /api/v1/articles/search/?q=...` — "ação search sobre o recurso article"
- `GET /api/v1/search/articles/?q=...` — "search é recurso próprio; `articles` é subtipo"

Forças:

- DESIGN.md §2.1 (ADR-015) estabelece **busca como bounded context separado** (`apps.search`). URL deve refletir essa decisão.
- DESIGN.md §2.4 (backend-architect) e §3 antecipam endpoints futuros: `/search/comments/`, `/search/all/`, `/search/suggest/`. Se o primeiro for `/articles/search/`, abrir `/comments/search/` reforça padrão errado.
- REST: search é capability transversal (filtrar + ranquear corpus), não método de recurso article. Padrão `/search/<corpus>/` é consagrado (Elasticsearch indices, Algolia indices, GitHub `/search/repositories/`).
- Frontend SSOT da URL: `/buscar?q=...` consome `/api/v1/search/articles/`. Consistência semântica.

## Decision Drivers

- Alinhamento com ADR-015 (bounded context separado)
- Extensibilidade futura (`/search/comments/`, `/search/all/`)
- Consistência com padrões REST consagrados (GitHub, Algolia)
- Versionamento via URL (ADR-010 do projeto: `/api/v1/`)

## Considered Options

1. **`GET /api/v1/articles/search/`** — search como sub-action de article.
2. **`GET /api/v1/search/articles/`** ⭐ — search como recurso; articles como subtipo.
3. **`GET /api/v1/search/?type=articles`** — search com type param.

## Decision Outcome

**Chosen: Opção 2**.

### Endpoint contract (sketch)

```
GET /api/v1/search/articles/
  ?q=kpop                      (required, 2-200 chars after strip)
  &author=<uuid>               (optional)
  &category=<int>              (optional)
  &de=<iso8601>                (optional, lower bound published_at)
  &ate=<iso8601>               (optional, upper bound)
  &cursor=<base64-hmac>        (optional, opaque pagination cursor)
  &per_page=20                 (optional, default 20, max 50)

Response 200 application/json:
{
  "results": [
    {
      "id": "<uuid>",
      "title": "...",
      "excerpt": "...",
      "slug": "...",
      "published_at": "2026-...",
      "author": { "id": "...", "display_name": "...", "slug": "..." },
      "category": { "id": 12, "name": "K-pop", "slug": "k-pop" },
      "cover_url": "https://..." | null,
      "score": 0.473128
    }
  ],
  "next_cursor": "AbCd..." | null,
  "total_estimate": 142,
  "query_terms_expanded": ["cantor", "brasil"]
}

Response 400: { "error": "validation_error" | "query_too_short" | "query_too_long" | "query_too_complex" | "cursor_invalid" | "refine_query" | "query_timeout", "detail": "..." }
Response 429: { "error": "rate_limit_exceeded", "retry_after": 23 }
Response 503: { "error": "feature_disabled" }  # quando SEARCH_FEATURE_ENABLED=False
```

### URL routing

```python
# apps/search/urls.py
urlpatterns = [
    path("articles/", SearchArticlesView.as_view(), name="search-articles"),
    # futuros: path("comments/", ...), path("suggest/", ...)
]

# config/urls.py
path("api/v1/search/", include("apps.search.urls")),
```

### Cache HTTP

```
Cache-Control: public, max-age=60, stale-while-revalidate=300
Vary: Authorization, Accept-Encoding
```

`Vary: Authorization` separa cache anônimo vs autenticado (SECURITY-REVIEW.md achado H-02 valida).

### Positive Consequences

- Coerência total com bounded context (`apps.search` ↔ `/api/v1/search/`).
- Endpoints futuros encaixam sem refactor.
- Padrão alinhado a REST consagrado.
- Documentação OpenAPI (via `drf-spectacular`) gera grupo "search" no Swagger UI.

### Negative Consequences

- Refactor leve no frontend se ele esperava `/articles/search/` (não é o caso — frontend ainda não existe).
- Newsletter (segundo cliente) consome `SearchService.query()` direto (não HTTP) — URL não afeta.

## Pros and Cons of the Options

### Opção 1 — `/articles/search/`

- 👍 Path "perto" do recurso.
- 👎 Sub-action ≠ recurso REST; padrão fica errado quando `/comments/search/` aparecer.
- 👎 Acopla URL ao app errado (`apps.articles` vs `apps.search`).

### Opção 2 — `/search/articles/` ⭐

- 👍 Bounded context = URL prefix.
- 👍 Extensível.
- 👎 (-)

### Opção 3 — `/search/?type=articles`

- 👍 Único endpoint.
- 👎 Validação mais complexa (type required + dispatch interno).
- 👎 Cache key + Vary mais difícil.

## Implementation Notes

- **Task IDs**: T30.1.8 (SearchView), T30.1.9 (SearchQuerySerializer)
- **OpenAPI**: `drf-spectacular` gera schema; CI gate via `npm run typecheck` regenera tipos TS
- **Frontend service**: `src/pages/Buscar/services/searchService.ts` consome este endpoint
- **Test**: contract (OpenAPI schema validation), integration (200/400/429/503), e2e Playwright (rota /buscar consome endpoint)
- **Referência DESIGN.md**: §2.4 (preservado v2 do backend-architect)
- **Referência specialist**: `DESIGN-v2-hybrid.md` §2.4

## References

- DESIGN.md §2.4, §3.1
- ADR-010 do projeto (`/api/v1/` versioning)
- ADR-015 (bounded context)
- ADR-024 (throttling), ADR-025 (total_estimate)
- ADR-035+ (SECURITY-REVIEW: Vary, cache key)
- GitHub Search API design
- Algolia Search indices pattern
