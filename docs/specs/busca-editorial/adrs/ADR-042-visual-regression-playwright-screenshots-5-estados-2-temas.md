# ADR-042: Visual regression via Playwright `toHaveScreenshot` obrigatório para 5 estados × 2 temas × 2 viewports

- **Status**: Accepted
- **Date**: 2026-06-03
- **Tags**: testing, visual-regression, playwright, ui-states, dark-mode, mobile-viewport, ci-gate
- **Stakeholders**: testing-engineer (autor da strategy), frontend-architect, ui-ux-architect, code-implementer
- **Layer**: Testing
- **Origin**: TEST-STRATEGY.md §8 + §9.6 contestação anti-sycophancy

## Context

A página `/buscar` tem **5 estados visuais distintos** (TEST-STRATEGY §2 a11y mapping + ADR-030-FE error boundary):

1. **Empty** — primeira visita, sem `q` na URL
2. **Loading** — skeleton enquanto fetch primeira página
3. **Results** — lista com 20+ artigos + `<mark>` highlight
4. **No-results** — `q` válido mas zero match
5. **Error / 5xx** — falha de servidor, retry CTA
6. **Rate-limited (429/503)** — countdown via `Retry-After`

× 2 **temas** (light / dark — sistema honra `prefers-color-scheme`)
× 2 **viewports** (mobile 390×844 iPhone 14, desktop 1440×900)

= **24 superfícies visuais frágeis** (6 × 2 × 2 — ou 20 se descartar 1 viewport por estado raro).

TEST-STRATEGY §9.6 contestou (anti-sycophancy): "manual review em PR não escala". Refactor de CSS (token rename, paleta tweak, padding 4 → 6) pode quebrar silenciosamente. Casos reais:

- Designer tweaka `--color-mark-bg` em dark mode → contraste passa de 6.8:1 para 4.2:1 → ADR-029 violado, ninguém vê.
- Refactor de utilitário Tailwind move `border-radius` de chips de `md` para `lg` → ADR-030-UI violado.
- Dependency bump de `mark.js` muda CSS internal → `<mark>` aparece menor/maior.

**Visual regression** captura screenshots de baseline e compara pixel-a-pixel (com tolerância) em todo PR. Quebra de UI vira diff visual no PR, não bug em produção.

## Decision Drivers

- **Cobertura mecânica** de regressão visual em 24 superfícies.
- **Stack zero-custo**: Playwright já planejado (TX-21 da TEST-STRATEGY + testing-standards Sprint 3+); `toHaveScreenshot` é API nativa.
- **Compatibilidade WCAG**: contraste numerico já testado via axe; pixel diff é complementar para layout shifts.
- **Tolerância configurável** — antialiasing varia entre OS/browser; threshold 0.2% é padrão.
- **Snapshots em git** — versionados, diffáveis em PR (GitHub UI mostra screenshot side-by-side).

## Considered Options

1. **Manual review em PR** (status quo) — rejeitado por §9.6.
2. **Playwright `toHaveScreenshot` com 10-24 snapshots versionados** ⭐
3. **Percy / Chromatic** (SaaS) — pago; isola CI; UI diff dedicada.
4. **BackstopJS / Loki** — open-source mas stack separada de Playwright.
5. **Storybook + Chromatic** — exige Storybook setup; over-engineering para feature isolada.

## Decision Outcome

**Chosen: Opção 2** — Playwright `toHaveScreenshot` para 10 snapshots iniciais (5 estados × 2 temas em viewport desktop 1440); ampliar para 24 (× 2 viewports) em Sprint 5 quando suite mobile estabilizar (T30.1.TY11).

### Setup inicial — 10 snapshots

```typescript
// tests/e2e/visual-regression/search.spec.ts
import { test, expect } from '@playwright/test';

const STATES = [
  { name: 'empty', url: '/buscar' },
  { name: 'loading', url: '/buscar?q=kpop', waitFor: 'skeleton' },
  { name: 'results', url: '/buscar?q=kpop', waitFor: 'results' },
  { name: 'no-results', url: '/buscar?q=xyzkpop123' },
  { name: 'error', url: '/buscar?q=kpop', mockResponse: '500' },
  { name: 'rate-limited', url: '/buscar?q=kpop', mockResponse: '429' },
];

const THEMES = ['light', 'dark'];

for (const state of STATES) {
  for (const theme of THEMES) {
    test(`visual: ${state.name} @ ${theme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme as 'light' | 'dark' });
      if (state.mockResponse) {
        await page.route('**/api/v1/search/articles/**', (route) =>
          route.fulfill({ status: parseInt(state.mockResponse) }),
        );
      }
      await page.goto(state.url);

      // Aguarda estado estabilizar
      if (state.waitFor === 'skeleton') {
        await page.waitForSelector('[data-testid="search-skeleton"]', {
          state: 'visible',
        });
      } else if (state.waitFor === 'results') {
        await page.waitForSelector('[data-testid="search-result-item"]');
      } else {
        await page.waitForLoadState('networkidle');
      }

      // Desabilita animações (CSS transition, requestAnimationFrame)
      await page.addStyleTag({
        content: `*, *::before, *::after {
        animation-duration: 0s !important;
        transition-duration: 0s !important;
      }`,
      });

      await expect(page).toHaveScreenshot(`search-${state.name}-${theme}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.002, // 0.2% tolerância antialiasing
        mask: [page.locator('[data-testid="dynamic-timestamp"]')], // ignora datas
      });
    });
  }
}
```

### Snapshots em git

```
tests/e2e/visual-regression/__screenshots__/
  search-empty-light.png        (~30KB)
  search-empty-dark.png         (~30KB)
  search-loading-light.png      (~25KB)
  ... 10 snapshots × ~25-50KB = ~400KB total
```

### Update snapshots quando UI muda intencionalmente

```bash
# Dev local
npx playwright test --update-snapshots tests/e2e/visual-regression/

# Commit snapshots atualizados junto com PR de UI
git add tests/e2e/visual-regression/__screenshots__/
```

### CI step

```yaml
- name: Playwright visual regression
  run: |
    cd .
    npx playwright install --with-deps chromium
    npx playwright test tests/e2e/visual-regression/

- name: Upload diff artifacts on failure
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: visual-regression-diff
    path: test-results/
    retention-days: 7
```

### PR Review UX

Quando snapshot quebra:

1. CI gera `*-actual.png` + `*-expected.png` + `*-diff.png` em `test-results/`
2. Artifacts uploaded ao PR (GitHub Action)
3. Reviewer clica e vê side-by-side
4. Se mudança intencional → autor roda `--update-snapshots` localmente, commit, push
5. Se regressão → autor corrige CSS, sem commit de snapshot

### Mascaras + determinismo

Áreas dinâmicas (timestamps "há 2 horas", contagem aleatória) viram **masked** via `mask: [...locators]` → ignoradas no diff.

Animações desabilitadas via CSS injetado.

Fontes web carregadas antes de screenshot via `await page.evaluate(() => document.fonts.ready)`.

### Positive Consequences

- **Detecção de regressão CSS automática** — refactor que quebra layout ou contraste falha CI.
- **Documentação visual viva** — snapshots em git mostram estado de cada UI state, navegável historicamente.
- **Reuso do stack Playwright** (já planejado para E2E) — zero novo tooling.
- **Custo zero (vs Percy/Chromatic)** — SaaS pago só faz sentido em portfolios grandes.
- **Cobertura dark mode** mecânica — antes era manual.

### Negative Consequences

- **Snapshots em git** crescem o repo (~400KB inicial; ~1MB com mobile expansion). Aceitável; se virar problema em Sprint 8+, mover para git-lfs (open question §10 da TEST-STRATEGY).
- **Antialiasing diferences** entre OS (Linux CI vs macOS dev) podem causar flake — mitigação: rodar baseline e CI no mesmo Docker image Linux + threshold `maxDiffPixelRatio: 0.002`.
- **Fontes web não-determinísticas** — Newsreader + Inter precisam estar carregadas antes do screenshot.
- **Tempo CI +~30s** (10 snapshots × 3s/cada).
- **Atualizar snapshots em PR de UI vira ritual** — autor precisa lembrar de rodar `--update-snapshots`. Mitigação: doc + bot que comenta no PR ao detectar mudança em arquivos CSS/JSX.

## Pros and Cons of the Options

### Opção 1 — Manual review

- 👍 Zero infra.
- 👎 Não escala, regressões silenciosas.

### Opção 2 — Playwright `toHaveScreenshot` ⭐

- 👍 Stack já existe; snapshots em git; diff em PR.
- 👎 Snapshots em git (+ 400KB); antialiasing flake mitigável.

### Opção 3 — Percy / Chromatic

- 👍 UX premium; isolamento CI; review UI dedicada.
- 👎 Custo SaaS ($150-500/mês); lock-in; complexidade extra.

### Opção 4 — BackstopJS / Loki

- 👍 OSS.
- 👎 Stack separada de Playwright; manutenção dupla.

### Opção 5 — Storybook + Chromatic

- 👍 Componentes isolados.
- 👎 Storybook não existe no projeto; over-engineering.

## Implementation Notes

- **Task ID**: **T30.1.TY13** — 🟡 Normal, Sprint 4 (10 snapshots iniciais; expansão mobile em Sprint 5)
- **Pacote**: `@playwright/test` já planejado (TX-21 da TEST-STRATEGY)
- **Arquivos**:
  - `tests/e2e/visual-regression/search.spec.ts`
  - `tests/e2e/visual-regression/__screenshots__/` (versionado)
  - `.github/workflows/ci.yml` (step novo)
- **Coordenação**:
  - **ADR-029** (paleta editorial herdada) — snapshots validam paleta no resultado renderizado
  - **ADR-030-UI** (filter chips radius-md + cards thumb-left) — snapshots travam layout
  - **ADR-030-FE** (error boundary) — estado `error` captura comportamento correto
  - **TX-17** (jest-axe 6 estados) — visual regression complementa axe (axe = WCAG semântico, visual = layout)
  - **T30.1.TY11** (E2E mobile dialog) — adiciona 2 snapshots mobile em Sprint 5
- **Documentação dev**: `docs/tests/visual-regression-guide.md` — quando atualizar snapshots, como debugar diff, threshold tuning.

## Open Concerns

- **Snapshots em git** vs **git-lfs** — decisão Q5 da TEST-STRATEGY §10. Manter em git até > 5MB; trocar para LFS se virar problema.
- **Cross-browser** — Chromium suficiente para Sprint 4; expansão para Firefox/WebKit em Sprint 5 se valer custo (×3 snapshots).
- **Dark mode quirk** — alguns SO ignoram `prefers-color-scheme` em Playwright headless; validar `emulateMedia` funciona consistentemente.
- **Não cobre micro-interações** (hover, focus, drag) — visual regression é estática. Para animações usar Playwright `toHaveScreenshot` em momentos específicos (e.g. `:focus` triggered explicit).

## References

- TEST-STRATEGY.md §2 (item 8 a11y + visual), §6.1 (10 snapshots planejados), §8 (ADR-042 proposto), §9.6 (contestação)
- BACKLOG.md T30.1.TY13
- ADR-029 (paleta editorial — validada via snapshot)
- ADR-030-UI (chip radius + card layout — validado via snapshot)
- ADR-030-FE (error boundary — estado validado)
- TX-17 (jest-axe — complementar)
- Playwright docs — `toHaveScreenshot`, `mask`, `maxDiffPixelRatio`, `emulateMedia`
- `docs/tests/testing-standards.md §2.11` — Visual regression como extensão
- `referencias-dashboards` skill — paleta ≤3 cores (validada visualmente)
