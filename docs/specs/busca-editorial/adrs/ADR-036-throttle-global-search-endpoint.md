# ADR-036: Throttle global do endpoint de busca (`SearchGlobalThrottle 500/min`) somado ao per-IP/user

- **Status**: Accepted
- **Date**: 2026-06-03
- **Tags**: security, dos-defense, drf-throttling, rate-limit, search-endpoint, botnet
- **Stakeholders**: cyber-security-architect (autor da review), backend-architect, database-architect, code-implementer
- **Layer**: Security / Backend
- **Origin**: SECURITY-REVIEW.md §3 achado **H-03** + §7.2 contestação anti-sycophancy

## Context

DESIGN v3 §3.4 (linha 436) afirma "rate limit em 2 camadas: DRF throttle (30/min anon · 60/min user) + Cloudflare WAF". O `cyber-security-architect` contestou (§7.2):

- As duas camadas atacam a **mesma classe** de ataque (per-IP rate). Botnet distribuído passa pelas duas (cada IP < threshold, Cloudflare WAF padrão sem regra custom não detecta).
- Vetor concreto (H-03): **1000 IPs × 1 req/min = 1000 req/min**. Cada IP fica abaixo de 30/min (não trigger DRF) e abaixo do threshold Cloudflare default. Total: ~16/s.
- Cada request é **Zipf-head com filtros que invalidam cache key** (`q=cultura&de=2025-01-01&ate=2025-01-02`) → Redis miss 100%.
- Cada miss = `plainto_tsquery` + GIN scan + CTE 500 + heap fetch + `ts_rank_cd` (50-200ms). 16/s × 200ms = 3.2s/s de DB-time → single Postgres satura em ~5 cores efetivos.
- `statement_timeout` (ADR-021b M4) mata queries individuais mas **não previne saturação de conexões / IO bandwidth / shared_buffers**.
- Resultado: degradação de p95 para usuários legítimos sob ataque distribuído subliminar.

Nenhum dos throttles atuais (`SearchThrottleAnon 30/min`, `SearchThrottleUser 60/min` — ADR-024) age sobre o **endpoint inteiro** como agregado.

## Decision Drivers

- **Cobrir vetor distribuído coordenado** — não confiar só em per-IP.
- **Defesa em camadas reais** (CWE-770) — cada camada cobre classe distinta de ataque.
- **Resposta tipada 503 + `Retry-After`** ao usuário (não 502/504 silencioso).
- **Manter UX para usuários legítimos** — ataque saturando endpoint não cria falso positivo em volume normal.
- **Implementação idiomática DRF** — extensão `BaseThrottle`/`SimpleRateThrottle`.

## Considered Options

1. **Confiar nos throttles per-IP + Cloudflare** (DESIGN v2) — rejeitado por H-03.
2. **Adicionar `ScopedRateThrottle scope='search_global'`** com cache key fixo (`search:global`) e limite 500/min ⭐
3. **Mover defesa só para Cloudflare WAF** custom rule — rejeitado (origin bypass M-08 reativa H-03; defesa só no edge é insuficiente).
4. **Circuit breaker baseado em p95** (adaptive degradation) — útil mas adicional, não substitui throttle global.

## Decision Outcome

**Chosen: Opção 2** — `SearchGlobalThrottle` somado às throttles existentes. Threshold inicial **500 req/min** (≈ 8 req/s sustained), calibrado a partir do tráfego esperado MVP (10-50 req/min em baseline; 500/min é 10-50× o esperado). Revisitar threshold em monitoramento real (Sprint 5+).

### Implementação concreta

```python
# apps/search/throttling.py
from rest_framework.throttling import SimpleRateThrottle

class SearchGlobalThrottle(SimpleRateThrottle):
    """
    Throttle global do endpoint de busca como agregado.
    Cache key fixo — todas as requisições compartilham contador.
    Defesa contra DoS distribuído coordenado (botnet sub-rate-limit).
    Ver SECURITY-REVIEW.md H-03 + ADR-036.
    """
    scope = 'search_global'
    rate = '500/min'  # configurável em settings; threshold inicial MVP

    def get_cache_key(self, request, view):
        return 'throttle_search_global'  # KEY ÚNICO E FIXO — propósito intencional


# apps/search/views.py
class SearchView(generics.ListAPIView):
    throttle_classes = [
        SearchThrottleAnon,        # 30/min por IP (ADR-024)
        SearchThrottleUser,        # 60/min por user (ADR-024)
        SearchGlobalThrottle,      # 500/min global (este ADR)
    ]
    # DRF executa TODOS — primeiro que estoura → 429
```

### Settings parametrizados

```python
# config/settings/base.py
REST_FRAMEWORK = {
    'DEFAULT_THROTTLE_RATES': {
        'search_anon': '30/min',
        'search_user': '60/min',
        'search_global': env('SEARCH_GLOBAL_RATE', default='500/min'),
    },
}
```

### Resposta ao cliente

Quando `SearchGlobalThrottle` dispara:

```http
HTTP/1.1 503 Service Unavailable
Retry-After: 60
Content-Type: application/json

{
  "code": "search_global_overload",
  "detail": "O serviço de busca está em alta demanda. Tente novamente em 60 segundos.",
  "retry_after_seconds": 60
}
```

Por que **503** e não 429: 429 = "você (cliente) fez demais"; 503 = "o serviço como agregado está sobrecarregado". Convenção semântica RFC 6585 + RFC 7231.

### Métrica + alerta

- Sentry custom event `search_global_overload` toda vez que throttle dispara.
- Grafana panel `interpop_search_global_throttle_hits_per_minute` (via `django-prometheus`).
- Alerta: > 5 hits em 10min → notificação operacional (provavelmente ataque ou pico legítimo precisando capacity).

### Defesa em profundidade (camadas complementares — não substituem este ADR)

- **TX-20** (documentação Cloudflare WAF custom rules por ASN) — cobre vetor edge.
- **TX-21** (Postgres role `interpop_search_reader` com `connection_limit` separado) — cobre saturação de pool.
- **ADR-021b M4** (`statement_timeout=500ms`) — cobre query individual patológica.
- **Adaptive degradation** futuro (Sprint 6+) — circuit breaker se p95 > 800ms por 30s.

### Positive Consequences

- Botnet distribuído com 1000 IPs × 1 req/min é detectado e bloqueado quando o **agregado** ultrapassa 500/min.
- Per-IP/user throttles continuam protegendo contra abuso single-IP (Zipf head local).
- Semântica HTTP correta: 429 vs 503 sinalizam coisas diferentes.
- Threshold parametrizável via env — calibrável sem redeploy de código.

### Negative Consequences

- **Pico legítimo viral** (ex.: matéria sobre Beyoncé bombando) pode acionar o throttle e degradar UX em momento crítico de tráfego. Mitigação: monitorar em produção, aumentar threshold via env, e adicionar **cache de candidates set** (mencionado em H-03 mitigação #5) em Sprint 6 para reduzir DB-pressure.
- **Single cache key fixo** em Redis pode virar hot key em altíssimo QPS — aceito (cache.incr é atomic e leve), mas Redis Sentinel/Cluster futuro precisa ser cookie-aware.
- **Falso positivo amplo** — se threshold = 500/min for batido por tráfego legítimo + ataque pequeno, vítimas inocentes recebem 503. Trade-off aceito; threshold é móvel.

## Pros and Cons of the Options

### Opção 1 — Status quo (per-IP + CF WAF padrão)

- 👍 Zero código novo.
- 👎 Vulnerável a botnet sub-rate-limit (vetor real, documentado).
- 👎 Falsa sensação de segurança.

### Opção 2 — `SearchGlobalThrottle` agregado ⭐

- 👍 Cobre exatamente a classe que per-IP não cobre.
- 👍 Idiomático DRF — extensão de 10 linhas.
- 👎 Hot key Redis (aceito); falso positivo em pico viral (mitigável).

### Opção 3 — Só Cloudflare WAF custom

- 👍 Não toca código.
- 👎 Origin bypass (M-08) reativa o vetor — defesa só no edge é falha.
- 👎 Configuração CF não versionada com código.

### Opção 4 — Circuit breaker p95

- 👍 Responsivo a degradação real.
- 👎 Complexo (precisa janela rolante de medições); reativo, não preventivo.
- 👍 Complementar a este ADR (Sprint 6+).

## Implementation Notes

- **Task ID**: **T30.4.X3** — 🟠 High, Sprint 4
- **Tasks complementares**: TX-20 (Cloudflare WAF doc), TX-21 (Postgres connection_limit), ADR-021b M4 (statement_timeout)
- **Arquivo**: `apps/search/throttling.py` — extender `SimpleRateThrottle` (já existe para per-IP/user)
- **Settings**: `SEARCH_GLOBAL_RATE` env var, default `500/min`
- **Test**: `apps/search/tests/test_throttling.py::test_global_throttle_triggers_at_500_per_minute`:
  - Simular 500 req em 60s com IPs distintos → 200
  - 501ª req (qualquer IP) → 503 com `Retry-After: 60` e `code: search_global_overload`
  - Aguardar 61s + 1 req → 200 (janela rolante reset)
- **Monitoramento**: Sentry event + Prometheus metric + Grafana panel
- **Documentação ops**: `docs/ops/search-throttling.md` — runbook de quando subir threshold

## Open Concerns

- **Threshold 500/min é chute calibrado**; precisa medição real pós-lançamento para confirmar/ajustar. Definir critério: "se SearchGlobalThrottle disparar > 1× por semana sem ataque real, subir threshold em 50%".
- **Quando viralizar de verdade** (cenário desejado), o throttle global pode virar gargalo. Sprint 6+: avaliar cache de candidates set + leitura via read replica.

## References

- SECURITY-REVIEW.md §3 H-03 + §7.2 (contestação)
- DESIGN.md §3.4 linha 436 (frase contestada)
- BACKLOG.md T30.4.X3
- ADR-024 (DRF throttling per-IP/user — camada complementar)
- ADR-021b M4 (statement_timeout role — camada complementar)
- OWASP API Security Top 10 #4 — Unrestricted Resource Consumption
- CWE-770 (Allocation of Resources Without Limits)
- RFC 6585 §4 (429 Too Many Requests) + RFC 7231 §6.6.4 (503 Service Unavailable)
- DRF docs — `SimpleRateThrottle`, `ScopedRateThrottle`
