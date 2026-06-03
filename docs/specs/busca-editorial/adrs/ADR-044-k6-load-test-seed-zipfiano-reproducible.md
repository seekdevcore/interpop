# ADR-044: k6 load test com seed Zipfiano reprodutível (script + CI artifact) — nightly, p95 ≤300ms gate

- **Status**: Accepted
- **Date**: 2026-06-03
- **Tags**: testing, performance, load-test, k6, zipfian-distribution, nightly, p95-gate
- **Stakeholders**: testing-engineer (autor da strategy), algorithms-data-structures-architect, database-architect, code-implementer
- **Layer**: Testing / Performance
- **Origin**: TEST-STRATEGY.md §8 + §9.2 contestação anti-sycophancy

## Context

NFR explícito do DESIGN v3: **p95 ≤ 300ms** em endpoint de busca sob carga representativa. O DESIGN §3.5 e TX-15 mencionam **k6 + seed Zipfiano**, mas TEST-STRATEGY §9.2 contestou (anti-sycophancy):

- **Quem fornece o seed?** Nenhuma Task. Sem reprodutibilidade, métrica é teatro.
- **Como CI valida sem Postgres real com 50k artigos?** Sem solução proposta.
- **Distribuição realista** — top 100 queries cobrem 70% do tráfego (Zipf head); long-tail é diferente — perf precisa medir os dois regimes.

Sem este ADR, o gate p95 ≤300ms fica **declarado**, não **verificado**. PR pode entregar regressão de perf que só aparece em produção.

Pyramid de teste já planeja pytest-benchmark (microbench em 1k artigos no PR check) — útil mas não representativo. k6 com seed Zipfiano de 50k artigos faz teste de carga real em DB Postgres efêmero (docker-compose) em nightly.

## Decision Drivers

- **Reprodutibilidade** — seed determinístico (fixed `random.seed(42)`), versionado em git.
- **Realismo da distribuição** — Zipfian top-100 = 70% tráfego (parâmetro `s=1.07` típico em web search).
- **CI artifact** — script + dataset + relatório armazenados como GitHub artifact, navegáveis historicamente.
- **Custo aceitável** — ~5min nightly; cabe no free tier GitHub Actions com ADR-043.
- **Gate p95 ≤300ms** — quebra de NFR vira issue automática (não bloqueia merge para evitar paralizar PRs por flake de carga).

## Considered Options

1. **Pytest-benchmark only** (microbench em PR) — insuficiente para load representativo.
2. **k6 nightly + seed Zipfiano script + Postgres efêmero docker** ⭐
3. **Locust** — Python-native; mas k6 é mais rápido e produz relatórios HTML melhores.
4. **JMeter** — XML-driven, UI antiga; rejeitado.
5. **Apache Benchmark (`ab`)** — single-URL, não distribui Zipfiano; rejeitado.

## Decision Outcome

**Chosen: Opção 2** — script de seed reprodutível + Postgres efêmero docker-compose + k6 nightly + relatório arquivado. PR rodando pytest-benchmark continua como pyramid (não substitui).

### Script de seed Zipfiano

```python
# scripts/seed-zipfian.py
"""
Popula Postgres efêmero com 50k artigos cuja distribuição de termos
segue Zipf (top 100 termos = 70% das ocorrências).

Determinístico: random.seed(42).
Usado em: k6 load test (CI nightly), testing local de capacidade.
Ver ADR-044 + TEST-STRATEGY.md §9.2.
"""
import random
from datetime import datetime, timedelta
import django
django.setup()
from apps.articles.models import Article

random.seed(42)
N_ARTICLES = 50_000
ZIPF_PARAM = 1.07  # típico em web search

# Lista curada de 1000 termos representativos (50 top + 950 long-tail)
# Top 50: termos pop-cultura BR realistas (curated pelo PM — Q11 TEST-STRATEGY §10)
TOP_TERMS = [
    "kpop", "beyoncé", "lula", "frança", "óscar", "novela", "globo",
    "música", "cinema", "moda", "literatura", "podcast",
    # ... 50 termos top-tier
]
LONG_TAIL = [
    # ... 950 termos sintéticos pt-BR aleatórios
]
ALL_TERMS = TOP_TERMS + LONG_TAIL


def zipfian_choice(items, s=ZIPF_PARAM):
    """Sample seguindo Zipf — top do ranking domina."""
    ranks = range(1, len(items) + 1)
    weights = [1.0 / (r ** s) for r in ranks]
    total = sum(weights)
    probs = [w / total for w in weights]
    return random.choices(items, weights=probs, k=1)[0]


def generate_article_text(seed_word):
    """Gera body com seed_word + filler realista."""
    fillers = ["em 2024", "no Brasil", "segundo especialistas", "diz a crítica"]
    return f"{seed_word} {' '.join(random.choices(fillers, k=20))}"


def seed():
    base_date = datetime(2024, 1, 1)
    for i in range(N_ARTICLES):
        primary_term = zipfian_choice(ALL_TERMS)
        Article.objects.create(
            title=f"{primary_term.capitalize()} análise #{i}",
            excerpt=generate_article_text(primary_term)[:200],
            body=generate_article_text(primary_term) * 50,  # ~5KB body
            status="published",
            published_at=base_date + timedelta(days=random.randint(0, 730)),
            # ...
        )
        if i % 1000 == 0:
            print(f"Seeded {i} / {N_ARTICLES}")


if __name__ == "__main__":
    seed()
```

### Script k6

```javascript
// scripts/k6-search-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';

// Termos para query (mesmo seed determinístico)
const QUERY_TERMS = JSON.parse(open('./k6-query-terms.json'));
// k6-query-terms.json é gerado pelo seed Python (1000 termos Zipfianos)

export const options = {
  scenarios: {
    sustained: {
      executor: 'constant-arrival-rate',
      rate: 100, // 100 req/s
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 50,
      maxVUs: 200,
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<500'],
    http_req_failed: ['rate<0.005'], // <0.5% erros
  },
};

export default function () {
  // Sample Zipfiano local (top 100 termos dominam)
  const term = pickZipfian(QUERY_TERMS, 1.07);
  const res = http.get(
    `${__ENV.BASE_URL}/api/v1/search/articles/?q=${encodeURIComponent(term)}`,
  );

  check(res, {
    'status is 200': (r) => r.status === 200,
    'has results array': (r) => JSON.parse(r.body).results !== undefined,
    'p95 < 300ms': (r) => r.timings.duration < 300,
  });

  sleep(Math.random() * 0.5); // jitter
}

function pickZipfian(items, s) {
  // implementação local — mesma matemática do Python
  const ranks = items.map((_, i) => i + 1);
  const weights = ranks.map((r) => 1.0 / Math.pow(r, s));
  const total = weights.reduce((a, b) => a + b, 0);
  const probs = weights.map((w) => w / total);
  let cum = 0;
  const r = Math.random();
  for (let i = 0; i < items.length; i++) {
    cum += probs[i];
    if (r < cum) return items[i];
  }
  return items[items.length - 1];
}
```

### docker-compose para CI

```yaml
# docker-compose.load-test.yml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: interpop_load
      POSTGRES_USER: interpop
      POSTGRES_PASSWORD: load_test_secret
    ports:
      - '5432:5432'
    tmpfs: /var/lib/postgresql/data # in-memory para velocidade

  django:
    build:
      context: ./backend
    environment:
      DATABASE_URL: postgres://interpop:load_test_secret@postgres:5432/interpop_load
      SEARCH_FEATURE_ENABLED: 'true'
    depends_on: [postgres]
    ports:
      - '8000:8000'
    command: >
      sh -c "
        uv run python manage.py migrate &&
        uv run python scripts/seed-zipfian.py &&
        uv run gunicorn config.wsgi --bind 0.0.0.0:8000 --workers 4
      "
```

### GitHub Actions workflow

```yaml
# .github/workflows/load-test.yml
name: Load test (nightly)

on:
  schedule:
    - cron: '0 4 * * *' # 4am UTC (após mutation testing)
  workflow_dispatch:

jobs:
  k6-load:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Start Postgres + Django + seed
        run: |
          docker compose -f docker-compose.load-test.yml up -d
          # Aguarda seed completar (~3min para 50k)
          docker compose -f docker-compose.load-test.yml logs -f django | grep -m1 "Seeded 50000" || true
          docker compose -f docker-compose.load-test.yml exec -T django \
            bash -c "until curl -fsS http://localhost:8000/healthz/; do sleep 2; done"

      - name: Run k6 load test
        run: |
          docker run --network host -v $PWD/scripts:/scripts \
            grafana/k6:0.50.0 run \
            -e BASE_URL=http://localhost:8000 \
            --summary-export=k6-summary.json \
            /scripts/k6-search-load.js

      - name: Upload k6 report as artifact
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: k6-load-report-${{ github.run_number }}
          path: |
            k6-summary.json
            scripts/k6-search-load.js

      - name: Open issue if p95 > 300ms
        if: failure()
        run: |
          gh issue create \
            --title "k6 load test: p95 > 300ms — regressão de perf detectada" \
            --body "Run $(gh run view ${{ github.run_id }} --json url -q .url). Ver ADR-044."
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Determinismo

Tanto `seed-zipfian.py` quanto `k6-search-load.js` usam **seed 42**. Mesmo run em mesma versão = mesmo dataset + mesmas queries → métricas comparáveis entre nights. Drift de p95 visível em série temporal.

### Métricas arquivadas

`k6-summary.json` (~5KB) salvo como GitHub artifact (retenção 90 dias) — comparação histórica trivial via script de análise local.

### Positive Consequences

- **NFR ≤300ms verificado em condição realista** — não declarado em vácuo.
- **Reprodutibilidade total** — bug de perf reproduz exato com `git checkout` + `docker compose up`.
- **Detecção precoce de regressão** — index dropado, query mal-otimizada, GIN dead-tuples acumulados → falha em ≤24h.
- **Artifact navegável** — históricos comparáveis ao longo do tempo.
- **Custo aceitável** — ~5min/noite no free tier; combinado com ADR-043 (mutation) totaliza ~13min/noite (cabe).

### Negative Consequences

- **Postgres tmpfs** (in-memory) não simula latência de disco real — métricas representam best case. Trade-off aceito; teste estresse contra produção real é outro vetor (Sprint 6+).
- **Seed inicial leva ~3min** — workflow tem ~8min total (seed + warmup + 5min k6).
- **Curadoria dos 50 termos top** depende de PM (open question Q11 da TEST-STRATEGY §10) — sem ela, top-50 vira lorem-ipsum (menos representativo).
- **Single-instance Postgres** — não testa contention multi-worker; aceitável para MVP.
- **Falha de network/CI flake** pode falsamente disparar issue — runbook ensina a revalidar manualmente antes de agir.

## Pros and Cons of the Options

### Opção 1 — pytest-benchmark only

- 👍 Zero infra.
- 👎 Não cobre concorrência real, GIN sob carga, p95 sob distribuição.

### Opção 2 — k6 + Zipf seed + docker-compose ⭐

- 👍 Realismo + reprodutibilidade + custo aceitável.
- 👎 8min nightly; tmpfs não modela disk latency.

### Opção 3 — Locust

- 👍 Python-native, mesma stack do BE.
- 👎 Slower than k6 (asyncio vs Go); reports menos navegáveis.

### Opção 4 — JMeter

- 👎 XML-driven; UI antiga.

### Opção 5 — ab

- 👎 Single-URL, não Zipfiano.

## Implementation Notes

- **Task ID**: **T30.1.TY6** (script seed-zipfian) — 🟠 High, Sprint 4
- **Task ID adicional**: **TX-19** (alias na TEST-STRATEGY — implementar gate Lighthouse) — distinto de TX-19 da SECURITY-REVIEW (search_log exclude). Ver INDEX.md / tracker.md para mapping correto.
- **Arquivos**:
  - `scripts/seed-zipfian.py`
  - `scripts/k6-search-load.js`
  - `scripts/k6-query-terms.json` (gerado pelo seed)
  - `docker-compose.load-test.yml`
  - `.github/workflows/load-test.yml`
  - `docs/tests/k6-load-test.md` (runbook)
- **Coordenação**:
  - **TX-09** (docker-compose.dev.yml) — reusa pattern
  - **TX-15** (Postgres role tuning) — load test valida que `statement_timeout` + `gin_fuzzy_search_limit` agem
  - **ADR-021b** (mitigações GIN pior caso) — load test exerce o pior caso
  - **ADR-031-FE** (Lighthouse CI gate) — complementar; LhCI é FE, k6 é BE
  - **ADR-043** (mutation nightly) — workflow paralelo, mesmo CI free tier
- **Curadoria dos 50 termos top** — Q11 da TEST-STRATEGY §10 — pedido formal ao PM em sprint planning de Sprint 4.

## Open Concerns

- **Threshold p95 ≤300ms** assume 50k artigos. Quando produção crescer (500k → 5M), threshold pode precisar relaxar OU exigir índices novos (ADR-031-DB particionamento). Re-validar threshold em produção.
- **Variabilidade entre runs** — GitHub Actions hosts não são idênticos; mesma carga pode dar p95 200ms num dia, 350ms noutro. Mitigação: tolerância 10% no gate (alert se 3 runs consecutivos > 300ms, não 1 isolado).
- **PMnão fornecer termos top** — fallback: usar termos do Google Trends BR de cultura pop (cached).
- **Não cobre auth tier** — load test atual roda anônimo (sem token). Adicionar cenário autenticado em Sprint 6 (testar cache hit rate por tier).

## References

- TEST-STRATEGY.md §2 (item 9 perf), §6.1 (k6 nightly), §8 (ADR-044 proposto), §9.2 (contestação), §10 Q11
- BACKLOG.md T30.1.TY6, TX-19 (alias)
- ADR-021b (mitigações GIN — verificadas sob carga)
- ADR-031-FE (Lighthouse CI — FE complementar)
- ADR-043 (mutation nightly — workflow paralelo)
- k6 docs — `constant-arrival-rate`, thresholds, summary-export
- Adamic-Huberman (2002) — Zipf law in web traffic
- Postgres docs — `EXPLAIN ANALYZE`, `gin_fuzzy_search_limit` sob carga
- `docs/tests/testing-standards.md §2.11` — Load/stress como extensão
