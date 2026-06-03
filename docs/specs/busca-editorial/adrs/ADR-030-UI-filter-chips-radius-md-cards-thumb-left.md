# ADR-030-UI: Filter chips radius-md (não pill); cards thumb-left 120×80

- **Status**: Accepted (novo v3)
- **Date**: 2026-06-03
- **Tags**: ui-ux, design-system, density, cards, chips, mobbin-reference
- **Stakeholders**: ui-ux-architect (autor), code-implementer
- **Layer**: UI/UX

## Context

Duas microdecisões visuais que mudam densidade e signaling:

1. **Filter chips**: pill (radius full `9999px`) vs radius-md (`0.625rem`).
2. **Cards de resultado**: thumb full-bleed top vs thumb-left 120×80.

Specialist `ui-ux-architect` validou ambas com referências:

- **Chips**: `border-radius: 9999px` (pill) é vocabulário de **tags estáticas** (Twitter hashtags, GitHub labels). Filtros são **actions** — radius médio comunica "clicável, tem estado". Linear, Notion (Mobbin reference) usam radius-md em filtros, pill só em tags imutáveis.
- **Cards**: full-bleed top = 5 cards/viewport. Thumb-left 120×80 = 8-10 cards/viewport. Busca é **varredura** (não navegação visual). NYT, Folha, Substack usam thumb-left em listagens de resultado.

## Decision Drivers

- Densidade adequada à tarefa (varredura)
- Signaling correto (chip = action, não tag)
- Referência de mercado editorial (NYT/Folha/Substack)

## Considered Options

1. **Chips pill + cards full-bleed top** — densidade baixa; chip confunde com tag.
2. **Chips radius-md + cards thumb-left 120×80** ⭐
3. **Chips radius-md + cards full-bleed** — chip OK, mas densidade baixa.
4. **Chips pill + cards thumb-left** — densidade OK, mas chip confunde.

## Decision Outcome

**Chosen: Opção 2**.

### Filter chip

```tsx
<button className="chip" aria-pressed={active} onClick={toggle}>
  {label}
  {count != null && <span className="chip__count">{count}</span>}
</button>
```

```css
.chip {
  border-radius: 0.625rem; /* radius-md */
  background: var(--clr-chip-bg);
  color: var(--clr-chip-on);
  padding: 0.4rem 0.75rem;
  font-size: 0.875rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}
.chip[aria-pressed='true'] {
  background: var(--clr-primary);
  color: white;
  outline: 2px solid var(--clr-accent);
  outline-offset: 1px;
}
.chip__count {
  font-variant-numeric: tabular-nums;
  opacity: 0.7;
  font-size: 0.8em;
}
```

### Card de resultado — thumb-left

```tsx
<article className="result-card">
  <div className="result-card__thumb">
    {cover_url ? (
      <img src={cover_url} alt="" width={120} height={80} loading="lazy" />
    ) : (
      <span className="result-card__placeholder">{categoryInitial}</span>
    )}
  </div>
  <div className="result-card__body">
    <a href={`/artigo/${slug}`} className="result-card__title">
      <HighlightedText text={title} terms={query_terms_expanded} />
    </a>
    <p className="result-card__excerpt">
      <HighlightedText text={excerpt} terms={query_terms_expanded} />
    </p>
    <footer className="result-card__meta">
      <span>{author.display_name}</span>
      <span>·</span>
      <span>{category?.name}</span>
      <span>·</span>
      <time dateTime={published_at}>{formatPtBr(published_at)}</time>
    </footer>
  </div>
</article>
```

```css
.result-card {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 1rem;
  padding: 1rem 0;
  border-bottom: 1px solid var(--clr-border);
}
.result-card__thumb {
  width: 120px;
  height: 80px;
  background: var(--clr-surface);
  border-radius: 0.5rem;
  overflow: hidden;
}
.result-card__title {
  font-family: var(--font-serif);
  font-size: 1.375rem; /* 22px */
  font-weight: 600;
  line-height: 1.3;
  text-decoration: none;
  color: var(--clr-text);
}
.result-card__excerpt {
  font-family: var(--font-serif);
  font-size: 0.9375rem;
  line-height: 1.5;
  color: var(--clr-text-muted);
  margin: 0.25rem 0 0.5rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

Mobile (≤640px): thumb 80×60, title 18px, excerpt 14px — mantém thumb-left mas reduz proporção.

### Placeholder sem cover

Letra inicial da editoria (ex.: "K" para K-pop) em background suave (`--clr-primary-50`). Decidido para não exigir SVG placeholder genérico.

### Positive Consequences

- 8-10 cards/viewport em desktop (vs 5 com full-bleed).
- Chip = action (signaling correto).
- Hierarquia: thumb (peripheral) + title (focal) + excerpt (context) + meta (descritivo).
- Lazy loading nativa (`loading="lazy"`) em thumbs.

### Negative Consequences

- Cover image perde destaque vs full-bleed — aceitável (busca = varredura, não pin-board).
- Sem cover, placeholder textual pode parecer estranho — letra inicial mitiga.

## Implementation Notes

- **Task IDs**: T30.1.17 (ResultCard), T30.2.1-T30.2.3 (chips + filters)
- **Tokens**: usa `--clr-chip-*` definidos em ADR-029
- **Test**: visual regression (Percy snapshot card + chip), a11y (chip `aria-pressed` corretamente refletido), responsive (mobile vs desktop)
- **Referência DESIGN.md**: §2.6
- **Referência specialist**: `_specialist-outputs/04-ui-ux-architect.md`

## References

- DESIGN.md §2.6
- `_specialist-outputs/04-ui-ux-architect.md`
- ADR-029 (tokens herdados)
- Mobbin — Notion, Linear filter chip patterns
- NYT, Folha de S.Paulo, Substack — search result card patterns
- Material Design 3 — Chip component (filter variant)
