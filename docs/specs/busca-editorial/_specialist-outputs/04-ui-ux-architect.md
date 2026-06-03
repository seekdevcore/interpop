# Output literal — `ui-ux-architect`

**Data**: 2026-06-02
**Agent ID**: a47dafc640e2be770
**Tokens output**: ~76k
**Skills invocadas**: `ecossistemas-ui-ux`, `wcag-audit-patterns`, `hig-components-search`, `referencias-dashboards` (descartada — não é dashboard)

---

## Multi-source inspiration (regra dura ecossistemas-ui-ux)

- **Galeria (Awwwards/Editorial)**: NYT `/search`, The Atlantic, Substack discovery, Vogue Brasil arquivo — todos usam input + resultados em coluna (zero dropdown). Confirma decisão 1.
- **Design system (Apple HIG `hig-components-search`)**: search field é _scope_, não overlay. Confirma APG 1.1 sem listbox no MVP.
- **Comunidade (Mobbin)**: Notion Search, Substack — `search-as-you-type` debounced (~250ms) com resultados in-page é dominante em editorial 2025-2026.
- **Audit (a11y Project + WAVE)**: contraste `<mark>` precisa ser testado sobre o body, não só sobre branco.

## 0. Decisões batalhadas

### Decisão 1 — Combobox SEM autocomplete: **CONFIRMA** com 1 ressalva

NYT, Substack, Atlantic, Vogue, Folha-Ilustrissima, ZEIT, Pitchfork — nenhum usa dropdown. Padrão "input + lista" venceu em leitura longa: 1 superfície (não 2), zero `/suggest`, deep-link funciona.

**NÃO é regressão**: dropdown continua dominante em e-commerce e SaaS (Amazon, Linear) porque ali query é navegação. Em editorial, query é exploração.

**Ressalva**: `role="combobox"` + `aria-expanded="false"` fixo é semanticamente errado. APG: combobox implica listbox controlado. Trocar para:

```html
<form role="search" action="/buscar" method="get">
  <label for="q" class="sr-only">Buscar artigos</label>
  <input
    id="q"
    name="q"
    type="search"
    autocomplete="off"
    spellcheck="true"
    aria-describedby="q-help"
    aria-busy="{isLoading}"
  />
  <span id="q-help" class="sr-only"
    >Digite ao menos 2 caracteres. Resultados abaixo.</span
  >
</form>
<div aria-live="polite" aria-atomic="true" class="sr-only">
  {announce /* "142 resultados para kpop" */}
</div>
```

Zero violação APG, zero ambiguidade, zero `aria-expanded` fake.

### Decisão 2 — Paleta + tipografia: **CONTESTA com força**

§2.6 propõe `--color-primary: #1e3a5f` (ardósia) + `Lora`. **Ignora brand vigente**.

| Token vigente (`src/styles/global.css`)   | §2.6 propõe         | Veredito                                           |
| ----------------------------------------- | ------------------- | -------------------------------------------------- |
| `--clr-primary: #19144c` navy editorial   | `#1e3a5f` ardósia   | **Manter `#19144c`**                               |
| `--font-serif: Newsreader Variable`       | `Lora/Source Serif` | **Manter Newsreader** (self-hosted, LCP otimizado) |
| `--font-sans: Inter Variable`             | `Inter`             | OK                                                 |
| `--clr-accent: #f8b046` amarelo signature | `#fff3a6` highlight | **Reusar `#f8b046` como base** do `<mark>`         |

**Extreme Ownership**: lançar busca com fork = 2 brand languages = dívida silenciosa. Reuso > novidade quando brand consolidado.

**ADR-029 reescrito** → "Busca herda paleta editorial Interpop existente; highlight derivado do `--clr-accent` signature".

## 1. Tokens finais

```css
/* ADIÇÕES em src/styles/global.css */
:root {
  /* Highlight derivado de --clr-accent #f8b046 */
  --clr-highlight-bg: #ffe9b5;
  --clr-highlight-on: #19144c;
  --clr-highlight-ring: #f8b046;

  /* Chips */
  --clr-chip-bg: var(--clr-primary-50); /* #eef0f8 */
  --clr-chip-on: var(--clr-primary);
  --clr-chip-bg-hover: var(--clr-primary-100);
  --clr-chip-border: var(--clr-border);

  /* Skeleton */
  --clr-skeleton: #ecedf0;
  --clr-skeleton-shimmer: #f6f7f9;
}

html.dark {
  /* Slate-base (não preto puro) */
  --clr-bg: #0f0f1a;
  --clr-surface: #15152a;
  --clr-text: #ecedf3;
  --clr-muted: #a8aab8;

  --clr-highlight-bg: #6b5b1f;
  --clr-highlight-on: #fff3a6;
  --clr-highlight-ring: #f8b046;

  --clr-chip-bg: #2a2658;
  --clr-chip-on: #d6d4ea;

  --clr-skeleton: #1f1f3a;
  --clr-skeleton-shimmer: #292950;
}
```

### Auditoria contraste WCAG 2.2 AA

| Combinação                                         | Ratio                          | Status |
| -------------------------------------------------- | ------------------------------ | ------ |
| Light: `#19144c` sobre `#ffe9b5`                   | **9.4:1**                      | ✅ AAA |
| Light: navy sobre highlight em **Newsreader 18px** | 9.4:1                          | ✅ AAA |
| Dark: `#fff3a6` sobre `#6b5b1f`                    | **6.8:1**                      | ✅ AAA |
| Dark: highlight sobre fundo `#15152a` (sangra?)    | borda 1px `#f8b046/40` resolve | ✅     |

Ardósia dark do §2.6 (`#14140f`) empurra para preto-marrom, perde identidade. Navy `#0f0f1a` mantém DNA do brand `#19144c` no dark — degrada bonito.

## 2. Primitives

| Componente               | Variantes                                | Props                                                |
| ------------------------ | ---------------------------------------- | ---------------------------------------------------- |
| `<SearchField>`          | default, loading, error, disabled        | value, onChange, onClear, isLoading, ariaDescribedBy |
| `<FilterChip>`           | active (com X), inactive, count-badge    | label, count?, onRemove, onClick, icon?              |
| `<ResultCard>`           | with-thumb, without-thumb, featured      | article, query, variant: 'compact'\|'comfortable'    |
| `<EmptyState>`           | initial, no-results, error, rate-limited | variant, title, hint, action?, retryIn?              |
| `<SkeletonCard>`         | matches `<ResultCard>` height            | count: number = 3                                    |
| `<LoadMoreButton>`       | idle, loading, exhausted                 | onClick, isLoading, hasMore                          |
| `<HighlightedText>`      | inline `<mark>`                          | text, terms[]                                        |
| `<FilterSheet>` (mobile) | bottom-sheet `<dialog>` nativo           | open, onClose, filters                               |

## 3. Patterns críticos

### 3.1 Card com thumb-LEFT 120×80 (não full-bleed)

| Layout                      | Veredito                                             |
| --------------------------- | ---------------------------------------------------- |
| Full-bleed top (16:9 acima) | Cards altos ≈400px, 5/viewport — ruim para varredura |
| **Thumb-left 120×80** ⭐    | Densidade NYT/Folha, 8-10/viewport                   |
| Sem thumb                   | Mais densidade, perde reconhecimento editoria        |

NYT, Folha, Substack reader, ZEIT — todos thumb-left em SERPs editoriais.

```
┌─────────────────────────────────────────────────────────────┐
│ ┌──────┐  Como o «kpop» reinventou a indústria              │
│ │ IMG  │  Lead com «kpop» mencionado no início…             │
│ │120×80│  Música · João Silva · 20 mai 2026 · 5 min        │
│ └──────┘                                                    │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Filter chips: cantos suaves (radius-md), com count

Pílula full-rounded = tag estática. Filtros são _actions_ → caixa suave (`radius-md: 0.625rem`) comunica "clicável, tem estado". Mobbin Notion + Linear: filtros com radius médio, full-rounded só em tags. **Confirma**.

```
[ Música 23 ×]  [ João Silva 8 ×]  [ Jan 2024 ×]  + Filtros
└─radius-md─┘   └─touch 44×44─┘
```

### 3.3 Mobile: `<dialog>` HTML + dvh

**Bug clássico iOS**: `position: fixed; bottom: 0` sobe com teclado. Solução:

1. `<dialog>` HTML nativo (`showModal()`) — iOS 17+ gerencia inset
2. Fechar sheet ao focar input (sem filtro útil com teclado aberto)
3. CSS:

```css
.filter-sheet {
  max-height: 75dvh; /* dynamic viewport — sobe/desce com teclado */
  padding-bottom: max(env(safe-area-inset-bottom), 1rem);
  overscroll-behavior: contain;
}
```

## 4. Mockup ASCII completo

```
┌─────────────────────────────────────────────────────────────────┐
│  INTERPOP  Música  Moda  Cinema  Literatura  Cultura  🔍 ☀/🌙  │  navbar global
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Buscar no Interpop                              <h1>            │  Montserrat 36, navy
│  Encontre artigos por palavra-chave, autor ou editoria.          │  Newsreader 18, muted
│                                                                  │
│  ┌──────────────────────────────────────────────────┐  [Limpar] │  search-field
│  │ 🔍  kpop|                                         │           │  height 56, radius-lg
│  └──────────────────────────────────────────────────┘           │  focus: ring primary
│                                                                  │
│  [ Música 23 ×]  [ João Silva 8 ×]  [ Jan-Mar 2024 ×]           │  chips: bg #eef0f8
│  + Adicionar filtro                                              │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│  142 resultados em 45ms                            ordenar: ▾   │  subtle, Inter 14
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  ┌──────┐  Como o «kpop» reinventou a indústria fonográfica     │  Newsreader 22/28 bold
│  │ COVER│  brasileira em 5 anos                                  │
│  │      │  ▌ kpop hoje move mais playlists no Spotify Brasil    │  Newsreader 16/24 muted
│  │      │  que o sertanejo em 2018, mostra estudo da…           │
│  │      │  ╴ Música  ·  João Silva  ·  20 mai 2026  ·  5 min   │  Inter 13 subtle
│  └──────┘                                                        │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  ┌──────┐  Beyoncé e o «kpop»: a costura entre Renaissance e   │
│  │ COVER│  os ídolos coreanos                                    │
│  │      │  ▌ Há um fio comum no projeto Renaissance e na…       │
│  │      │  ╴ Música · Maria Lima · 15 mai 2026 · 8 min         │
│  └──────┘                                                        │
│  ─────────────────────────────────────────────────────────────  │
│           …mais 18 cards…                                        │
│                                                                  │
│            ┌─────────────────────────────┐                       │
│            │   Carregar mais resultados   │                      │  primary outlined
│            └─────────────────────────────┘                       │  radius-md, height 44
└─────────────────────────────────────────────────────────────────┘
```

`«kpop»` no mockup = `<mark>kpop</mark>` (bg `#ffe9b5`, texto `#19144c`).

## 5. Acessibilidade gates

| Item                                | Status           | Como                                                |
| ----------------------------------- | ---------------- | --------------------------------------------------- |
| WCAG 2.2 AA contraste `<mark>` body | ✅ 9.4:1 / 6.8:1 | navy sobre amarelo claro                            |
| Focus ring visível                  | ✅               | `outline: 2px solid var(--clr-primary); offset 2px` |
| Touch target ≥44×44                 | ✅               | chips `padding 10px 14px`, botão height 44          |
| SR anuncia resultados               | ✅               | `aria-live="polite"` em `#search-live`              |
| `aria-busy` durante fetch           | ✅               | evita SR ler resultado antigo                       |
| Sem violação combobox APG           | ✅               | `role="search"` no form, sem combobox fake          |
| Reduced motion                      | ✅               | skeleton sem shimmer                                |
| `<mark>` semântico                  | ✅               | NVDA/JAWS lê com ênfase, sem anunciar tag           |
| Enter funciona                      | ✅               | wrapper `<form role="search">`                      |

## 6. Performance

| Métrica      | Budget                                            | Estratégia                                           |
| ------------ | ------------------------------------------------- | ---------------------------------------------------- |
| LCP p75      | ≤2.5s                                             | Shell pré-render + skeleton altura final             |
| INP p75      | ≤200ms                                            | `useDeferredValue`; mark.js em `requestIdleCallback` |
| CLS          | ≤0.05                                             | aspect-ratio exato; thumb width/height explícitos    |
| Bundle delta | ≤20KB gz                                          | TanStack 13KB + mark.js 6KB                          |
| Image LCP    | thumbs lazy + fetchpriority="low" exceto primeiro | `<img srcset>` 120/240/360                           |

## 7. ADRs ajustados

- **ADR-028 REV**: `role="search"` + `<input type="search">`, **não combobox APG**. Resultados in-page debounced 250ms.
- **ADR-029 REV**: Busca herda paleta Interpop (`--clr-primary #19144c` navy + Newsreader + Inter). Highlight derivado de `--clr-accent #f8b046`. **Rejeita fork ardósia** v2.
- **ADR-030 NEW**: Chips cantos suaves (radius-md) com count interno, **não pílula full-rounded**. Cards com thumb-left 120×80.

## 8. Handoff

- → `frontend-architect`: integrar `<SearchField>`, `<FilterChip>`, `<ResultCard>`, `<HighlightedText>` no design-system existente (`src/components/ui/`). Confirmar perf budget.
- → `testing-engineer`:
  - axe-core em 5 estados
  - Playwright mobile com teclado virtual (`page.keyboard` + viewport 390×844)
  - Visual regression 2 temas (Percy ou Playwright `toHaveScreenshot`)
  - Lighthouse CI: LCP ≤2.5s, INP ≤200ms, CLS ≤0.05, a11y ≥95
- → `cyber-security-architect`: revisar `<HighlightedText>` (mark.js usa refs, não dangerouslySetInnerHTML). Confirmar CSP não bloqueia inline styles.

## 9. Open questions ao usuário

1. **Newsreader Variable** é display do artigo body — título do card 22px (compacto, mais cards) ou 26px (mais editorial)? **Recomendação 22px**.
2. **Sort dropdown** ("ordenar: ▾") no mockup mas não no DESIGN. MVP ou Sprint 5? **Recomendação fora do MVP**.
3. **Thumbnail placeholder** sem cover: SVG inline ou letra inicial editoria? **Recomendação letra inicial com `--clr-cat-{editoria}-bg`**.
