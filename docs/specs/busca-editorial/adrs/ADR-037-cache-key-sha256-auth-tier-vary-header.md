# ADR-037: Cache key `SHA256(canonical+auth_tier)` + invariante de não-mistura auth/anônimo + `Vary: Authorization, Cookie`

- **Status**: Accepted
- **Date**: 2026-06-03
- **Tags**: security, cache, redis, cloudflare, http-vary, cross-user-leak, info-disclosure
- **Stakeholders**: cyber-security-architect (autor da review), backend-architect, code-implementer
- **Layer**: Security / Backend
- **Origin**: SECURITY-REVIEW.md §3 achado **H-04** + §7.4 contestação anti-sycophancy

## Context

DESIGN v2 §2.4 (preservado em v3) propõe `Cache-Control: public, max-age=60, stale-while-revalidate=300` + cache key `SHA256(canonical_query)`. O `cyber-security-architect` contestou (§7.4):

- **Cache key não inclui auth tier**. Resposta cacheada para usuário **A autenticado** (rate `60/min`, eventuais campos personalizados em release futura) pode ser servida a usuário **B anônimo** (rate `30/min`).
- **`Cache-Control: public`** em endpoint com rate-limit por tier é **incoerente** — Cloudflare pode servir mesma resposta no edge para autenticado e anônimo, vazando metadata de tier (Retry-After diferente, rate_limit_remaining diferente, futuros campos personalizados).
- **Sem `Vary: Authorization, Cookie`**, edges e proxies intermediários (incluindo Cloudflare) servem mesma resposta para clientes com Authorization headers distintos — violação de RFC 7234 §4.1.
- Risco amplificador em **release futura**: dev adiciona campo `bookmarked: bool` na resposta sem pensar em cache; leak silencioso.

CWE-524 (cache contendo info sensível) + ASVS V8.3.4.

## Decision Drivers

- **Não-mistura cross-user em cache compartilhado** (Redis + Cloudflare edge).
- **Invariante de função-pura** na resposta: response = f(`q`, `filters`, `cursor`) — sem variável por-usuário.
- **Semântica HTTP correta** — `Vary` header declarado para proxies respeitarem.
- **Defesa em profundidade**: cache key + Vary + invariante de código — três camadas independentes.
- **Decisão consciente sobre edge cache** — `public` vs `private` é trade-off financeiro/performance, não default.

## Considered Options

1. **Manter `Cache-Control: public` + cache key sem tier** (DESIGN v2) — rejeitado por H-04.
2. **Cache key inclui `auth_tier` + `Vary: Authorization, Cookie` + invariante "response não inclui campos personalizados" com comment-lock** ⭐
3. **Mudar para `Cache-Control: private, max-age=60`** (sem edge cache) — mais simples mas perde ganho CDN; complementar, não substitui.
4. **Variar cache por user_id completo** — over-fragmentation; cache hit rate cai drasticamente.

## Decision Outcome

**Chosen: Opção 2** — cache key inclui tier (apenas `anon` vs `user`, não user_id) + `Vary` headers + invariante de código com comment-lock no SearchView.

**Decisão pendente Q2** (SECURITY-REVIEW §8): se PM/ops decidirem que edge cache não traz ganho prático (tráfego MVP baixo), aplicar **adicionalmente** Opção 3 (`private`) — não é mutuamente exclusivo. Este ADR estabelece a base segura; Q2 calibra se `public` ou `private` é o vetor escolhido.

### Cache key concreto

```python
# apps/search/cache.py
import hashlib

def make_cache_key(canonical_query: str, request) -> str:
    """
    Cache key inclui auth_tier para impedir cross-user leak.
    NUNCA inclui user_id — fragmentaria demais e não agrega segurança
    (invariante de "response function-pure" garante mesma resposta por tier).
    Ver SECURITY-REVIEW.md H-04 + ADR-037.
    """
    auth_tier = 'user' if request.user.is_authenticated else 'anon'
    payload = f"{canonical_query}|tier={auth_tier}"
    digest = hashlib.sha256(payload.encode('utf-8')).hexdigest()
    return f"search:v1:{digest}"
```

### Canonical query (determinismo)

```python
def canonicalize(q: str, filters: dict, cursor: str | None) -> str:
    """
    Forma canônica para cache key: ordem fixa de campos + filtros sorted.
    """
    parts = [
        f"q={q}",
        f"cursor={cursor or ''}",
    ]
    for key in sorted(filters):
        parts.append(f"{key}={filters[key]}")
    return "&".join(parts)
```

### SearchView com headers e invariante

```python
# apps/search/views.py
class SearchView(generics.ListAPIView):
    """
    INVARIANTE DE SEGURANÇA (ADR-037):
    A resposta DEVE ser função-pura de (q, filters, cursor, auth_tier).
    NÃO adicionar campos por-usuário (bookmarked, read_history, recommended_for_me).
    Cache compartilhado entre todos os usuários do mesmo tier.
    Ver SECURITY-REVIEW.md H-04.
    """

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        # Vary obriga proxies/CDN a diferenciar por header de auth.
        response['Vary'] = 'Authorization, Cookie'
        # Cache-Control depende de Q2 (SECURITY-REVIEW §8):
        # 'public' se ganho edge justifica + Vary respeitado por todos proxies
        # 'private' se MVP não justifica edge cache (mais simples, menos surface)
        response['Cache-Control'] = settings.SEARCH_CACHE_CONTROL_HEADER
        return response
```

### Settings parametrizado (Q2 calibrável)

```python
# config/settings/base.py
SEARCH_CACHE_CONTROL_HEADER = env(
    'SEARCH_CACHE_CONTROL',
    default='private, max-age=60'  # default conservador; produção decide
)
```

### Comment-lock obrigatório em `apps/search/views.py`

```python
# SECURITY: response é function-pure de (q, filters, cursor, auth_tier).
# NÃO adicionar campos por-usuário (bookmarked, read_history, recommended_for_me).
# Cache compartilhado entre tiers do mesmo nível. NUNCA por user_id.
# Ver SECURITY-REVIEW.md H-04 + ADR-037.
```

### Testes obrigatórios

| Cenário                                                                                                | Asserção                                                                             |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Cliente A anônimo + Cliente B anônimo, mesma `q`                                                       | Mesma resposta + cache hit no 2º (mesma key)                                         |
| Cliente A autenticado + Cliente B anônimo, mesma `q`                                                   | **Respostas podem ser idênticas no body**, mas cache keys distintos; `Vary` presente |
| Inspecionar Redis após request anon: key contém substring `anon` (via debug); após user: contém `user` | Keys diferentes verificáveis                                                         |
| Forçar mock de campo `bookmarked=True` na resposta + asssert presença → falha                          | Garantia da invariante por test                                                      |
| Inspecionar `Vary` header na response                                                                  | `Vary: Authorization, Cookie` presente                                               |

### Positive Consequences

- Cross-user leak eliminado por design — mesmo se dev futuro adicionar campo personalizado por engano, cache keys distintos previnem que A receba dados de B (B veria dados de A apenas se ambos no mesmo tier — invariante de código bloqueia).
- `Vary` declarado → Cloudflare/proxies respeitam → cache no edge é seguro.
- Hit rate ainda alto: top-100 Zipf queries × 2 tiers = 200 hot entries, cabe em Redis trivialmente.
- Decisão `public` vs `private` desacoplada da segurança — calibrável via env sem mudança de código.
- Comment-lock + test invariante → guard contra regressão em PR futuro.

### Negative Consequences

- **Cache hit rate cai ~2×** (fragmenta em 2 tiers). Aceitável: 200 keys ainda é trivial; Redis serve em microssegundos.
- **Risco de proxy intermediário** que ignora `Vary` (raro em 2026 com Cloudflare/Nginx, mas existe). Mitigação: `private` no Cache-Control evita edge cache totalmente.
- **Comment-lock vira tech debt** se não acompanhado de teste — por isso o test invariante é obrigatório.

## Pros and Cons of the Options

### Opção 1 — DESIGN v2 (key sem tier + public)

- 👍 Hit rate máximo.
- 👎 Cross-user leak vetor real.
- 👎 Incompatível com rate-limit por tier (incoerência semântica).

### Opção 2 — Key+tier + Vary + invariante ⭐

- 👍 Segurança em 3 camadas independentes.
- 👍 Compatível com edge cache (se Q2 = public) ou só browser (se private).
- 👎 Hit rate fragmenta em 2 (aceitável).

### Opção 3 — `Cache-Control: private` (sem edge)

- 👍 Mais simples, sem dependência de Vary.
- 👎 Perde ganho CDN; só cache no browser do cliente.
- 👍 **Complementar** — pode coexistir com Opção 2.

### Opção 4 — Cache por `user_id` completo

- 👍 Zero risco cross-user.
- 👎 Fragmenta demais (10k usuários × queries = 10k+ keys hot); destrói Redis.

## Implementation Notes

- **Task ID**: **T30.4.X4** — 🟠 High, Sprint 4
- **Arquivos**: `apps/search/cache.py` (novo) + `apps/search/views.py` (Vary + comment-lock)
- **Settings**: `SEARCH_CACHE_CONTROL_HEADER` env var
- **Testes**: `apps/search/tests/test_cache_isolation.py`:
  - `test_cache_key_includes_tier`
  - `test_anon_and_user_have_distinct_cache_keys`
  - `test_response_does_not_include_per_user_fields` (introspecção de schema)
  - `test_vary_header_present`
- **Coordenação com T30.1.24** (Cache-Control setup) — implementar JUNTO; SECURITY-REVIEW §9 passo 6.
- **Coordenação com ADR-035** (LGPD) — cache não persiste PII por design (response é function-pure → 0 PII).
- **Documentação dev**: `apps/search/README.md` seção "Cache safety" referencia este ADR.

## Open Concerns

- **Decisão final `public` vs `private`** depende de Q2 da SECURITY-REVIEW §8 — PM/ops calibram em produção. ADR estabelece default `private` (conservador) até medição mostrar ganho real de edge cache.
- **Se em release futura houver demanda por campo personalizado** (`bookmarked`), arquitetura precisa pivot: ou (a) endpoint separado autenticado-only (sem cache), ou (b) merge client-side (response cacheada + fetch separado de bookmarks). Decisão postergada até demanda surgir.

## References

- SECURITY-REVIEW.md §3 H-04 + §7.4 (contestação)
- DESIGN.md §2.4 (Cache-Control public — contestado)
- BACKLOG.md T30.4.X4
- ADR-024 (throttling per-tier — origem da incoerência semântica que este ADR resolve)
- ADR-036 (global throttle — camada complementar de DoS defense)
- CWE-524 — Use of Cache Containing Sensitive Information
- OWASP ASVS V8.3.4
- RFC 7234 §4.1 — `Vary` header semantics
- MDN — "Vary header pitfalls"
- Cloudflare docs — Origin Cache-Control & Vary behavior
