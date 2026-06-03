# ADR-045: A11y E2E via `@axe-core/playwright` + checklist manual NVDA/VoiceOver gravado

- **Status**: Accepted
- **Date**: 2026-06-03
- **Tags**: testing, a11y, wcag-2-2, axe-core, playwright, nvda, voiceover, manual-testing
- **Stakeholders**: testing-engineer (autor da strategy), ui-ux-architect, frontend-architect, code-implementer
- **Layer**: Testing / A11y
- **Origin**: TEST-STRATEGY.md §8 + §9.1 contestação anti-sycophancy

## Context

CLAUDE.md §4 declara **"validação obrigatória de frontend: WCAG 2.2 + Core Web Vitals em toda entrega"** como **regra dura**. TEST-STRATEGY §9.1 contestou (anti-sycophancy):

- **`@axe-core/react` em unit (TX-17)** pega ~30% das violações WCAG — regras estáticas DOM (`alt` ausente, role inválido, label sem `for`).
- **Falta 70%**: violações dinâmicas (ARIA atributos calculados em runtime, focus order após interação, live regions sob mudança real, contraste calculado com tema dark).
- **Falta 100% da experiência real de SR (screen reader)** — NVDA/VoiceOver detectam UX issues que ferramenta nenhuma cobre: ordem confusa, anúncio incorreto, foco perdido após dialog close.

Os 6 estados da busca (empty/loading/results/no-results/error/rate-limited) × 2 temas × ARIA live region da contagem ("142 resultados") + `<input type="search">` (rejeitando combobox falso APG — ADR-028) + filter sheet mobile `<dialog>` 75dvh exigem testes em **3 camadas**:

1. **Unit a11y** via `@axe-core/react` + `jest-axe` — pega 30% (regras estáticas no DOM serializado).
2. **E2E a11y** via `@axe-core/playwright` em página real renderizada com JS executando — pega ~80% (estática + runtime + ARIA dinâmico + focus traps).
3. **Manual com SR real** (NVDA Windows + VoiceOver macOS) — pega 100% das UX issues, gravado em vídeo arquivado.

Sem este ADR, a a11y declarada é **teórica** (TX-17 unit cobre 30%, restante por inspeção visual sem método).

## Decision Drivers

- **Conformidade WCAG 2.2 AA real**, não papelão — CLAUDE.md §4 + Lei Brasileira de Inclusão (LBI Lei 13.146/2015).
- **3 camadas independentes** — estática + dinâmica + UX humano.
- **Cadência operacional** — manual é caro; cadência calibrada (entrega + trimestral).
- **Reusa stack** — `@axe-core/playwright` reusa Playwright (já planejado para E2E + visual regression ADR-042).
- **Documentação auditável** — vídeo NVDA/VoiceOver arquivado serve como prova LGPD/LBI em caso de questão.

## Considered Options

1. **`@axe-core/react` unit only** (TX-17 atual) — rejeitado por §9.1.
2. **3 camadas: axe-core unit + axe-playwright E2E + NVDA/VoiceOver manual gravado** ⭐
3. **Só axe-playwright sem manual** — perde UX real de SR.
4. **Pa11y CLI** — alternativa axe; menos integrado com Playwright.
5. **Lighthouse a11y score** — útil mas score binário, não diagnóstico.

## Decision Outcome

**Chosen: Opção 2** — 3 camadas combinadas. Camada 1 (unit) e camada 2 (E2E) automatizadas no CI; camada 3 (manual) com cadência **na entrega da feature + trimestral em regressão**.

### Camada 1 — Unit a11y (TX-17 ampliada)

`jest-axe` em **8 estados** (TX-17 original cobre 6; ADR-045 adiciona 2):

```typescript
// src/pages/Buscar/__tests__/a11y.test.tsx
import { axe, toHaveNoViolations } from 'jest-axe';
import { render } from '@testing-library/react';
expect.extend(toHaveNoViolations);

const STATES = [
  'empty', 'loading', 'results', 'no-results',
  'error', 'rate-limited',
  // ADR-045 additions:
  'filters-open-dialog',  // mobile <dialog> aberto
  'highlighted-mark',     // <mark> rendered em resultados
];

STATES.forEach(state => {
  it(`não tem violações axe-core em estado '${state}'`, async () => {
    const { container } = render(<Buscar initialState={state} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

### Camada 2 — E2E a11y (`@axe-core/playwright`)

```typescript
// tests/e2e/a11y/search.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('axe-playwright em /buscar?q=kpop light', async ({ page }) => {
  await page.goto('/buscar?q=kpop');
  await page.waitForSelector('[data-testid="search-result-item"]');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});

test('axe-playwright em /buscar?q=kpop dark', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/buscar?q=kpop');
  await page.waitForSelector('[data-testid="search-result-item"]');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});

test('axe-playwright em mobile dialog filter sheet', async ({
  page,
  browserName,
}) => {
  await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14
  await page.goto('/buscar?q=kpop');
  await page.click('[data-testid="filter-trigger-mobile"]');
  await page.waitForSelector('dialog[open]');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});
```

### Camada 3 — Manual NVDA + VoiceOver gravado

Fluxo padronizado em `docs/tests/a11y-checklist-busca.md`:

```markdown
# Checklist a11y manual — Busca editorial

## Setup

- NVDA 2024.x em Windows 11 ou VoiceOver em macOS Ventura+
- Chrome ou Safari (matches browser do produto)
- OBS Studio para gravação

## Fluxos a executar (em ordem)

### Fluxo 1 — Busca básica

1. Tab até `<input type="search">`
2. SR anuncia: "Campo de busca, edição"
3. Digite "kpop"
4. Aguarde 250ms
5. SR deve anunciar via `aria-live="polite"`: "142 resultados encontrados"
6. Tab para primeiro resultado
7. SR anuncia: "Link, [título artigo], [autora], [data]"

### Fluxo 2 — Zero resultados

1. Digite "xyzkpop123"
2. SR deve anunciar: "Nenhum resultado encontrado para xyzkpop123"

### Fluxo 3 — Rate limited

1. (Mock backend) — receive 429
2. SR deve anunciar via `aria-live="assertive"`: "Você fez muitas buscas. Aguarde 60 segundos."

### Fluxo 4 — Filtros mobile (dialog)

1. Tab até "Abrir filtros"
2. Enter → dialog abre
3. Foco DEVE ir para primeiro filter chip dentro do dialog (focus trap)
4. Tab cicla apenas dentro do dialog
5. Escape fecha dialog
6. Foco RETORNA para "Abrir filtros" (não perdido)

## Critérios PASS/FAIL

| Fluxo | PASS se                            | FAIL se                    |
| ----- | ---------------------------------- | -------------------------- |
| 1     | SR anuncia contagem após digitação | Silêncio ou anúncio errado |
| 2     | SR anuncia mensagem amigável       | Silêncio ou "0" só         |
| 3     | SR anuncia com prioridade alta     | Polite ou silente          |
| 4     | Focus trap + restore funcionam     | Foco escapa ou desaparece  |

## Arquivamento

- Gravar a sessão em vídeo: `docs/tests/a11y-recordings/AAAA-MM-DD_NVDA-Windows.mp4`
- Mesmo para VoiceOver: `AAAA-MM-DD_VoiceOver-macOS.mp4`
- Marcar resultado no checklist + assinar com data + revisor
```

### Cadência

| Evento             | Cobertura                                                    |
| ------------------ | ------------------------------------------------------------ |
| Cada PR de FE      | Camada 1 (unit) + Camada 2 (E2E) — gate de merge             |
| Entrega da F-30    | Camada 3 (manual NVDA + VoiceOver) — gravar 1 sessão de cada |
| Trimestral         | Camada 3 repetida (regressão UX)                             |
| Pós-incidente a11y | Camada 3 ad-hoc + atualização do checklist                   |

### Gate de Lighthouse a11y (TEST-STRATEGY §9.7)

Adicionalmente, Lighthouse CI (ADR-031-FE) deve incluir gate `accessibility >= 95` no `lighthouserc.json`:

```json
{
  "ci": {
    "assert": {
      "assertions": {
        "categories:accessibility": ["error", { "minScore": 0.95 }]
      }
    }
  }
}
```

### Positive Consequences

- **Cobertura real WCAG 2.2 AA** — 3 camadas pegam ~95% de violações.
- **UX validada** — manual com SR pega problemas que axe não vê (anúncio errado, foco perdido).
- **Documentação auditável** — vídeos arquivados servem como prova LBI.
- **Reusa Playwright** — zero novo tooling.
- **Lighthouse a11y ≥95** complementa como score absoluto.

### Negative Consequences

- **Manual é caro** — gravar 2 sessões × ~30min = 1h/trimestre. Aceitável dado criticidade.
- **Custo de gravação inicial** — testing-engineer (ou dev FE) precisa setup NVDA + VoiceOver na primeira vez (Q6 da TEST-STRATEGY §10: requer acesso a Windows + macOS).
- **Tempo CI +~20s** (3 axe-playwright tests).
- **Falsa segurança** se camadas 1 e 2 passarem mas camada 3 pular — disciplina operacional.

## Pros and Cons of the Options

### Opção 1 — Só unit `jest-axe`

- 👍 Zero custo extra.
- 👎 30% de cobertura; UX SR não coberta; **viola CLAUDE.md §4**.

### Opção 2 — 3 camadas ⭐

- 👍 Cobertura real (~95% + UX); reusa Playwright.
- 👎 Manual demanda hardware; custo 1h/trimestre.

### Opção 3 — Só axe-playwright sem manual

- 👍 Automatizado.
- 👎 UX SR não coberta; vídeos arquivados ausentes.

### Opção 4 — Pa11y CLI

- 👍 CLI simples.
- 👎 Não integra com Playwright; menos rico que axe-core.

### Opção 5 — Só Lighthouse score

- 👍 Numérico, fácil de comparar.
- 👎 Score binário; não diagnostica violação específica.

## Implementation Notes

- **Task IDs**:
  - **TX-17 ampliada** (jest-axe 8 estados — adicionar `filters-open-dialog` + `highlighted-mark`) — 🟠 High, Sprint 4
  - **T30.1.TY5** (sessões manuais NVDA + VoiceOver gravadas) — 🟠 High, Sprint 4 (entrega F-30)
  - **T30.1.TY7-related** (axe-playwright nos E2E) — 🟠 High, Sprint 4 (embutido em T30.1.21/T30.1.22)
- **Pacotes**:
  - `@axe-core/react`, `jest-axe` (TX-17 atual)
  - `@axe-core/playwright` (novo via TX-21)
- **Arquivos**:
  - `src/pages/Buscar/__tests__/a11y.test.tsx` (8 estados unit)
  - `tests/e2e/a11y/search.spec.ts` (3 axe-playwright tests)
  - `docs/tests/a11y-checklist-busca.md` (checklist manual)
  - `docs/tests/a11y-recordings/` (vídeos NVDA + VoiceOver)
- **Settings**:
  - `lighthouserc.json` — adicionar `accessibility >= 95`
- **Coordenação**:
  - **ADR-028** (`<input type="search">` semântico — rejeita combobox APG) — testado por axe semântica
  - **ADR-029** (paleta editorial — contraste 6.8:1 dark, 9.4:1 light) — validado por axe-color-contrast
  - **ADR-030-UI** (filter chips + cards layout) — focus order validado por manual
  - **ADR-031-FE** (Lighthouse CI gate) — extender com a11y ≥95
  - **ADR-042** (visual regression) — complementar; visual cobre layout, axe cobre semântica
- **Open question Q6 da TEST-STRATEGY §10**: acesso a Windows (NVDA) + macOS (VoiceOver) — confirmar com PM antes de Sprint 4 começar.

## Open Concerns

- **Acesso a hardware** Q6 — se PM não tiver Windows ou macOS pessoal, considerar:
  - Máquina virtual Windows (Parallels/UTM se em macOS); NVDA roda free
  - VoiceOver via macOS de revisor; ou parceria com terceiro
  - Última opção: postergar manual para Sprint 5 e bloquear release com camadas 1+2 only (acceptable trade-off único)
- **Cadência trimestral** — registrar no calendário operacional; sem isso vira "1 vez e esquece".
- **Drift entre `wcag2aa` e `wcag22aa`** — alguns critérios novos (target size, focus appearance) podem ainda ter `axe-core` faltando — confirmar versão `@axe-core/playwright >= 4.10`.
- **Mock de backend para E2E rate-limited** — usar `page.route()` Playwright para forjar 429.

## References

- TEST-STRATEGY.md §2 (item 8 a11y), §6.1 (a11y unit+E2E+manual), §8 (ADR-045 proposto), §9.1 (contestação), §10 Q6
- BACKLOG.md TX-17, T30.1.TY5
- CLAUDE.md §4 (WCAG 2.2 AA regra dura)
- LBI Lei 13.146/2015
- WCAG 2.2 — w3.org/TR/WCAG22/
- ADR-028 (input type=search semântico — base testada)
- ADR-029 (paleta + contraste — base testada)
- ADR-030-UI (layout + focus order — base testada)
- ADR-031-FE (Lighthouse CI — extender com a11y ≥95)
- ADR-042 (visual regression — complementar)
- `@axe-core/playwright` docs — AxeBuilder, withTags, integration
- NVDA docs (nvaccess.org); VoiceOver Apple docs
- WAI-ARIA Authoring Practices — Search pattern (não Combobox)
- `superpowers:web-accessibility` skill — disciplina mestre
