# ADR-031-FE: Lighthouse CI gate em `/buscar?q=kpop` bloqueia PR

- **Status**: Accepted (novo v3)
- **Date**: 2026-06-03
- **Tags**: frontend, ci-cd, core-web-vitals, lighthouse, perf-budget, github-actions
- **Stakeholders**: frontend-architect (autor), code-implementer
- **Layer**: Frontend (CI)

## Context

ADR-026 estabelece CSR + medição. Sem CI gate, performance degrada silenciosamente sprint a sprint. Lighthouse CI dá:

- Baseline (TX-18) salvo em `docs/performance/lighthouse-baseline-pre-busca.json`.
- Gate por PR: regressão > 10% em LCP/INP/CLS bloqueia merge.
- Trend ao longo do tempo via `lhci server` (opcional, GitHub Pages).

## Decision Drivers

- NFR LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1
- Prevenir regressão silenciosa
- Bundle delta vs main ≤ 20KB gz (regra dura)

## Considered Options

1. **Apenas RUM em produção** — feedback tardio.
2. **Lighthouse CI gate por PR** ⭐
3. **Smoke test manual antes de release** — esquece-se.

## Decision Outcome

**Chosen: Opção 2**.

### Workflow `.github/workflows/lhci.yml` (sketch)

```yaml
name: Lighthouse CI
on:
  pull_request:
    paths:
      - 'src/**'
      - 'package.json'
      - 'vite.config.ts'

jobs:
  lhci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm run build
      - run: npx http-server dist -p 4173 &
      - run: sleep 3
      - uses: treosh/lighthouse-ci-action@v12
        with:
          urls: |
            http://localhost:4173/buscar?q=kpop
            http://localhost:4173/buscar?q=cinema&category=2
          configPath: ./.lighthouserc.json
          uploadArtifacts: true
```

### `.lighthouserc.json`

```json
{
  "ci": {
    "collect": { "numberOfRuns": 3 },
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "interaction-to-next-paint": ["error", { "maxNumericValue": 200 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "total-byte-weight": ["error", { "maxNumericValue": 500000 }],
        "uses-responsive-images": "warn"
      }
    }
  }
}
```

### Bundle delta gate (separado)

Workflow auxiliar comparado main: `npx vite build && du -b dist/assets/*.js | awk '{s+=$1} END {print s}'` — diff vs base. >20KB gz → fail.

### Positive Consequences

- Gate automático; regressão bloqueada.
- 3 runs por PR (numberOfRuns: 3) reduz flakiness Lighthouse.
- Artifact com relatório HTML disponível em cada run.
- LCP/INP/CLS thresholds explícitos.

### Negative Consequences

- CI mais lento (~3min adicional).
- Lighthouse local env ≠ user env (lab data, not field) — RUM complementa.
- PRs que tocam só `apps.search` Django mas não frontend ainda rodam — refinar `paths` se ficar custoso.

## Implementation Notes

- **Task IDs**: TX-16 (Lighthouse CI gate), TX-18 (🔴 Immediate — baseline ANTES)
- **Deps**: `@lhci/cli`, `treosh/lighthouse-ci-action`
- **Test**: rodar workflow uma vez manual, validar artifacts
- **Referência DESIGN.md**: §2.5, §7
- **Referência specialist**: `_specialist-outputs/03-frontend-architect.md`

## References

- DESIGN.md §2.5
- `_specialist-outputs/03-frontend-architect.md`
- ADR-026 (CSR + baseline)
- ADR-027 (debounce reduz request, ajuda INP)
- Lighthouse CI docs — `lhci autorun`, assertions
- web.dev Core Web Vitals
