# ADR-024: DRF throttling sobre `django-ratelimit`

- **Status**: Accepted
- **Date**: 2026-06-03
- **Tags**: backend, rate-limit, drf, throttling, dos-defense
- **Stakeholders**: backend-architect (autor), cyber-security-architect, code-implementer
- **Layer**: Backend
- **Decisão alinhada com**: roadmap.sh/backend (rate limiting)

## Context

NFR: rate limit 30 req/min para anônimo, 60 req/min para autenticado. Forças:

- **DRF throttling** é nativo do framework, integra com `SearchView`, suporta `AnonRateThrottle` + `UserRateThrottle` + custom scope, retorna 429 + `Retry-After` automaticamente, integra com cache backend (LocMemCache, Redis).
- **`django-ratelimit`** é mais flexível (decorator com chave customizada), mas exige middleware ou decorator manual em cada view; integração com `ScopedRateThrottle` exige glue code.
- Cloudflare WAF já é primeira camada (rate limit por IP no edge). Camada aplicação é segunda camada (proteção contra Cloudflare bypass via IP origin descoberto).

## Decision Drivers

- Integração nativa com DRF (`SearchView` herda `APIView`)
- Resposta 429 + `Retry-After` padronizada
- Cache backend compartilhado (Redis em prod, LocMem em dev/test)
- Defesa em camadas (Cloudflare WAF + DRF throttle)

## Considered Options

1. **DRF throttling** (`AnonRateThrottle` + `UserRateThrottle` + scoped) ⭐
2. **`django-ratelimit` decorator**
3. **Cloudflare WAF only** — rejeitado (bypass via IP origin)
4. **Custom middleware** — reinventa roda

## Decision Outcome

**Chosen: Opção 1**.

### Configuração (settings/base.py)

```python
REST_FRAMEWORK = {
    ...,
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "30/min",
        "user": "60/min",
        "search_anon": "30/min",
        "search_user": "60/min",
    },
}
```

### SearchView usa `ScopedRateThrottle`

```python
class SearchArticlesView(APIView):
    throttle_classes = [SearchAnonThrottle, SearchUserThrottle]
    throttle_scope = "search"

class SearchAnonThrottle(AnonRateThrottle):
    scope = "search_anon"

class SearchUserThrottle(UserRateThrottle):
    scope = "search_user"
```

### Cache backend

- Dev: `LocMemCache` (por worker — hit ratio cai mas aceitável).
- Prod: Redis cache (chave compartilhada entre workers gunicorn).
- Throttle storage **separado** do cache de busca (key prefix distinto).

### Camadas de defesa

| Camada                   | Tecnologia           | Limite        | Função                      |
| ------------------------ | -------------------- | ------------- | --------------------------- |
| 1. Edge                  | Cloudflare WAF       | 60/min/IP raw | Bloqueia tráfego massivo    |
| 2. Aplicação anônimo     | DRF AnonRateThrottle | 30/min/IP     | Bloqueia bypass Cloudflare  |
| 3. Aplicação autenticado | DRF UserRateThrottle | 60/min/user   | Bloqueia abuso conta válida |

### Throttle global de SearchView (SECURITY-REVIEW achado H-02)

Adicionar throttle global de **300 req/min total** no endpoint para defesa contra ataque distribuído (1 req/min × 1000 IPs). Implementação via cache key fixo (`search_global`). Endereçado em Task T30.4.X3 do SECURITY-REVIEW.

### Positive Consequences

- 429 + `Retry-After` padronizado.
- Integração nativa DRF — zero middleware custom.
- Cache backend Redis compartilha estado entre workers.
- Camadas de defesa explícitas (WAF + DRF).

### Negative Consequences

- LocMemCache em dev causa hit ratio inconsistente (test usar cache fake controlado).
- Throttle global por endpoint é workaround manual (DRF não tem nativo).
- Mudança de janela (min vs h) exige reinício do worker (cache do limit não invalida).

## Pros and Cons of the Options

### Opção 1 — DRF throttling ⭐

- 👍 Nativo, integrado, padrão.
- 👍 Reusa cache backend.
- 👎 Throttle global por endpoint manual.

### Opção 2 — django-ratelimit

- 👍 Decorator flexível.
- 👎 Mais código glue; 2 stacks de rate limit.

## Implementation Notes

- **Task IDs**: T30.4.1 (throttle classes), T30.4.2 (rates), T30.4.3 (Redis backend), T30.4.4 (test 31º request → 429), T30.4.X3 (throttle global — SECURITY-REVIEW)
- **Settings**: `REST_FRAMEWORK.DEFAULT_THROTTLE_RATES`
- **Test**: integration (31 reqs <60s → 31º 429); integration (Retry-After header presente); integration (autenticado tem limite separado)
- **Referência DESIGN.md**: §2.4, §3.4
- **Referência specialist**: `DESIGN-v2-hybrid.md` §2.4

## References

- DESIGN.md §2.4, §3.4
- SECURITY-REVIEW.md §3 H-02 (throttle global)
- ADR-023 (endpoint)
- DRF docs — throttling
- Cloudflare WAF rate limiting rules
