# Performance baselines — Interpop

> **Fonte de verdade** dos baselines Lighthouse pré-implementação da busca editorial. Gate de regressão (ADR-031-FE) compara cada PR contra **`lighthouse-baseline-pre-busca-prod-desktop.json`** e **`lighthouse-baseline-pre-busca-prod-mobile.json`**.

## TX-18 (🔴 Immediate) — baseline coletado 2026-06-04

Build production: `npm run build` (Vite 8) → `npx vite preview --port 4173`. Chromium via Playwright cache (`~/.cache/ms-playwright/chromium-1223`). Lighthouse 12 headless.

### Tabela consolidada

| Setup                 |   Perf | A11y | B-P | SEO | LCP      | FCP   | CLS       | TBT   | SI    | Total bytes |
| --------------------- | -----: | ---: | --: | --: | -------- | ----- | --------- | ----- | ----- | ----------- |
| **prod / desktop** ⭐ | **93** |  100 |  96 |  92 | **0.7s** | 0.6s  | **0.153** | 0ms   | 0.6s  | 355 KiB     |
| **prod / mobile** ⭐  | **81** |  100 |  96 |  92 | **3.1s** | 2.8s  | **0.176** | 30ms  | 2.8s  | 355 KiB     |
| dev / desktop         |     67 |  100 |  96 |  92 | 3.1s     | 1.9s  | 0.153     | 0ms   | 1.9s  | 2862 KiB    |
| dev / mobile          |     43 |  100 |  96 |  92 | 18.1s    | 10.5s | 0.176     | 240ms | 10.5s | 2862 KiB    |

(⭐) = baseline canônico para gate. Dev numbers ficam como referência diagnóstica; **não** são usados em CI.

### NFR (DESIGN §0) — status hoje, sem busca

| NFR               | Alvo        | Desktop         | Mobile          | Status                      |
| ----------------- | ----------- | --------------- | --------------- | --------------------------- |
| LCP ≤ 2.5s p75    | obrigatório | 0.7s            | 3.1s            | ⚠️ mobile **viola** já hoje |
| INP ≤ 200ms       | obrigatório | (sem interação) | (sem interação) | TBT proxy: 0/30ms ✅        |
| CLS ≤ 0.1         | obrigatório | 0.153           | 0.176           | ❌ ambos **violam** já hoje |
| Bundle ≤ 500KB gz | obrigatório | 355 KiB         | 355 KiB         | ✅ folga 30%                |

### 🚨 Flags pré-existentes (não causados pela busca)

Dois NFRs do DESIGN estão violados **antes** da busca ser implementada:

1. **CLS 0.153–0.176**: layout shifts acima de 0.1. Investigar candidatos comuns — webfonts sem `font-display: optional`/`size-adjust`, imagens sem dimensões, lazy hero, ads/iframes injetados. Endereçar **antes** do PR final da US30 ou aceitar dívida explícita.
2. **LCP mobile 3.1s**: provável LCP element = imagem de cover do destaque. Aplicar `<link rel="preload">` no destaque, `fetchpriority="high"` no `<img>`, ou converter para AVIF/WebP responsivo.

A Fase 3 (frontend `/buscar`) **não pode piorar** essas métricas; gate Lighthouse CI (TX-16/ADR-031-FE) bloqueia PR se regredir.

### Gate de regressão (TX-16 / ADR-031-FE)

`.github/workflows/lhci.yml` deve assertar (sobre `/buscar?q=kpop`):

- LCP delta ≤ +200ms vs `prod-mobile` baseline (3.1s + 200ms = 3.3s ceiling)
- INP ≤ 200ms (absoluto)
- CLS delta ≤ +0.02 vs baseline (0.176 + 0.02 = 0.196 ceiling)
- Bundle delta ≤ +20KB gz vs baseline (355 + 20 = 375 KiB ceiling)

Falha → bloqueia merge.

### Comando reprodução

```bash
# 1. Build production
export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"  # husky exige Node 20+
npm run build

# 2. Serve preview
npx vite preview --port 4173 &
PREVIEW_PID=$!
sleep 3

# 3. Chrome via Playwright (sem chrome system)
export CHROME_PATH="$HOME/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome"

# 4a. Desktop
npx -y lighthouse@12 http://localhost:4173/ \
  --preset=desktop \
  --output=json \
  --output-path=docs/performance/lighthouse-baseline-pre-busca-prod-desktop.json \
  --quiet \
  --chrome-flags="--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage"

# 4b. Mobile (sem preset)
npx -y lighthouse@12 http://localhost:4173/ \
  --output=json \
  --output-path=docs/performance/lighthouse-baseline-pre-busca-prod-mobile.json \
  --quiet \
  --chrome-flags="--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage"

# 5. Kill preview
kill $PREVIEW_PID
```

### Arquivos

| Arquivo                                           | Tamanho | Uso                     |
| ------------------------------------------------- | ------- | ----------------------- |
| `lighthouse-baseline-pre-busca-prod-desktop.json` | 463 KB  | gate CI desktop         |
| `lighthouse-baseline-pre-busca-prod-mobile.json`  | 441 KB  | gate CI mobile          |
| `lighthouse-baseline-pre-busca-desktop.json`      | 725 KB  | dev server (referência) |
| `lighthouse-baseline-pre-busca-mobile.json`       | 698 KB  | dev server (referência) |

### Open question

- **CLS pré-existente**: deve ser corrigido **antes** ou **depois** da busca? Decisão pendente. Recomendação técnica: corrigir antes — caso contrário a busca herda regression latente e o gate CI passa por baixo limiar artificial. Task nova candidata: **TX-22** "Investigar e mitigar CLS 0.15+ pré-existente" (🟠 High).

---

_Atualizado em 2026-06-04 — TX-18 concluída como parte de F5._
