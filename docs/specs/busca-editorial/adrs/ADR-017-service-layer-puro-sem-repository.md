# ADR-017: Service Layer puro sem Repository abstrato

- **Status**: Accepted
- **Date**: 2026-06-03
- **Tags**: software-architecture, service-layer, repository-pattern, ddd, anti-over-engineering
- **Stakeholders**: software-architect (autor), code-implementer, backend-architect
- **Layer**: Software
- **Depends on**: ADR-015, ADR-016

## Context

ADR-015 cria `apps.search`; ADR-016 cria `SearchIndex` como read-projection. Falta decidir **padrão de acesso a dados** dentro de `apps.search`:

- O Django ORM já implementa **Repository pattern de fato** — `Model.objects.filter().select_related()` é exatamente a interface de Repository (encapsula query, retorna entidades).
- Adicionar uma camada `SearchRepository` abstrata em cima do ORM agora é **over-engineering** (YAGNI): há **um único data source** (Postgres com FTS) e **um único cliente principal** (SearchService).
- Quando uma 2ª fonte entrar (Elasticsearch, Meilisearch, vector store para embeddings), Repository abstrato faz sentido como porta de strategy. Hoje não há sinal de 2ª fonte.
- `backend-architect` precisa de entry point único e testável (`SearchService.query(spec)`) — service layer puro entrega isso sem Repository.

## Decision Drivers

- YAGNI (You Aren't Gonna Need It): não criar abstração para necessidade especulativa.
- Testabilidade: `SearchService.query()` é mockável diretamente; não precisa de `SearchRepository` intermediário.
- Entry point único: newsletter, view DRF, management command — todos consomem `SearchService.query(spec)`.
- Frozen dataclasses (`QuerySpec`, `SearchResultPage`) garantem contrato imutável sem precisar de DTO injetado.
- Defer repository abstraction até segundo data source concreto entrar em pauta.

## Considered Options

1. **Service Layer + Repository abstrato** — `SearchService` recebe `ISearchRepository` injetado; implementação `PostgresSearchRepository` agora; futuro `ElasticsearchRepository`.
2. **Service Layer puro sobre ORM Django** — `SearchService.query(spec)` chama `SearchIndex.objects.annotate(...).filter(...)` diretamente.
3. **Manager Django custom** — `SearchIndex.objects.search(spec)` faz tudo; sem service layer.

## Decision Outcome

**Chosen option**: **Opção 2 — Service Layer puro sobre ORM Django**, porque:

- Hoje há 1 data source. Abstração para hipótese futura = custo agora sem benefício comprovado.
- ORM Django já é Repository. Camada adicional é repetição.
- `SearchService` exposto como única façade pública de `apps.search` — contrato claro com newsletter, view, command.
- Quando 2º data source entrar, refator é local (somente dentro de SearchService) — boundaries de ADR-015 não mudam.

### Estrutura concreta

```python
# apps/search/services.py
from dataclasses import dataclass
from .dto import QuerySpec, SearchResultPage
from .models import SearchIndex

class SearchService:
    """Entry point público de apps.search. Consumido por:
       - apps.search.views (SearchView DRF)
       - apps.newsletter (geração de digest)
       - management/commands/reindex_search.py (uso indireto)
    """

    @staticmethod
    def query(spec: QuerySpec) -> SearchResultPage:
        # 1. Cache lookup (Redis canonical key)
        # 2. Postgres FTS query via SearchIndex.objects (ts_rank_cd + recency boost)
        # 3. Side-fetch dos Articles via select_related (anti N+1)
        # 4. Cursor encoding (HMAC-signed)
        # 5. Return SearchResultPage (frozen dataclass)
        ...

    @staticmethod
    def query_terms_expanded(q_norm: str) -> list[str]:
        """Para highlight client-side (ADR-022). Usa ts_lexize('portuguese_stem', token)."""
        ...


# apps/search/dto.py — frozen dataclasses, imutáveis
@dataclass(frozen=True)
class QuerySpec:
    q: str                         # normalizado, cap 8 tokens
    author_id: str | None
    category_id: int | None
    de: datetime | None
    ate: datetime | None
    cursor: str | None             # base64 HMAC
    per_page: int                  # ≤50

@dataclass(frozen=True)
class SearchResultPage:
    results: list[ArticleDTO]
    next_cursor: str | None
    has_more: bool
    total_estimate: int
    query_echo: str
    query_terms_expanded: list[str]
    took_ms: int
```

### Positive Consequences

- Código mínimo viável. Sem indireção desnecessária.
- Testabilidade: mock `SearchIndex.objects` (Django test client) ou `SearchService.query` (unit).
- Newsletter consome `SearchService.query(spec)` — contrato estável.
- Refator futuro (quando 2º data source surgir) é localizado: vira ADR superseding este com strategy pattern.

### Negative Consequences (trade-offs)

- Se 2º data source surgir, refator não é trivial — toda a query lógica está no service. Mitigação: o service é um arquivo pequeno e testado; refator é gerenciável.
- Tentação de poluir `SearchService` com lógica de outros recursos (`/search/comments/`). Mitigação: ADR futura criando `CommentSearchService` se necessário.

## Pros and Cons of the Options

### Opção 1 — Service + Repository abstrato

- 👍 Pronto para 2º data source.
- 👎 Abstração para necessidade especulativa.
- 👎 +1 nível de indireção em todos os testes.
- 👎 Refator futuro só ganha 20% (a maior parte do trabalho é portar lógica de scoring/cursor).

### Opção 2 — Service puro sobre ORM ⭐

- 👍 Código mínimo viável; YAGNI respeitado.
- 👍 ORM Django já é Repository de fato.
- 👍 Newsletter, view, command consomem 1 entry point.
- 👎 Refator futuro exige cirurgia no service (custo aceito).

### Opção 3 — Manager Django custom

- 👍 Idiomático Django.
- 👎 Mistura layer de persistência com regra de negócio (scoring, cursor).
- 👎 Newsletter importaria `SearchIndex.objects` — vaza model fora do app.

## Implementation Notes

- **Task IDs**: T30.1.7 (SearchService.query), T30.1.X3 (estimate_total helper), T30.1.X4 (feature flag SEARCH_FEATURE_ENABLED)
- **DESIGN.md**: §2.1, §2.4
- **Specialist outputs**: `DESIGN-v2-hybrid.md` §2.1 linhas 48-57
- **Test**: `apps/search/tests/test_service.py` com mock de `SearchIndex.objects`
- **Re-avaliação**: quando 2º data source entrar em RFC (ex.: embeddings via pgvector, Meilisearch), abrir ADR superseding este com strategy/repository.

## References

- DESIGN.md §2.1
- `DESIGN-v2-hybrid.md` §2.1
- ADR-015 (bounded context base)
- ADR-016 (SearchIndex como read-projection)
- ADR-023 (endpoint /api/v1/search/articles/ consome SearchService)
- _Patterns of Enterprise Application Architecture_, Fowler — Service Layer
- roadmap.sh/backend — Service Layer; YAGNI
