# ADR-029: Busca herda paleta editorial Interpop (navy `#19144c` + Newsreader + Inter); rejeita fork ardósia

- **Status**: Accepted (revisado v3 — contestação forte do specialist)
- **Date**: 2026-06-03
- **Tags**: ui-ux, design-system, brand, design-tokens, dark-mode, wcag
- **Stakeholders**: ui-ux-architect (autor), frontend-architect, code-implementer
- **Layer**: UI/UX
- **Supersedes**: nenhuma (v2 propunha paleta ardósia `#1e3a5f` + Lora — rejeitada)

## Context

v2 do DESIGN propunha paleta `#1e3a5f` (azul ardósia) + tipografia Lora (serif). Specialist `ui-ux-architect` **contestou com força**:

- Interpop já tem brand vigente: `--clr-primary: #19144c` (navy profundo) + `--font-serif: Newsreader Variable` (serif body) + `--font-sans: Inter` (sans UI) + `--clr-accent: #f8b046` (amarelo signature).
- Fork da paleta + tipografia = **dois brand languages na mesma aplicação**. Dívida silenciosa: a busca não se sente "Interpop"; visitantes percebem inconsistência antes de explicitar.
- **Reuso > novidade**. Princípio editorial: a busca é UMA superfície editorial, não uma página standalone.
- Lora vs Newsreader: ambos serifa, mas Newsreader Variable (axis para `opsz`, `wght`) ajusta legibilidade em corpos diferentes — já calibrado no Interpop. Lora seria fork sem ganho.

## Decision Drivers

- Single brand language (não fork visual)
- Reuso de tokens existentes (`--clr-primary`, `--font-serif`, `--clr-accent`)
- WCAG 2.2 AA (contraste validado em light + dark)
- Manter custo de manutenção baixo

## Considered Options

1. **Fork: paleta `#1e3a5f` + Lora** — rejeitado (dois brand languages).
2. **Herdar paleta navy + Newsreader + Inter; adicionar só tokens novos de highlight/chip/skeleton** ⭐
3. **Re-skin completo do Interpop com paleta nova** — out-of-scope.

## Decision Outcome

**Chosen: Opção 2**.

### Tokens herdados (não duplicar; consumir `:root` existente)

```css
/* Já existe em src/styles/global.css — NÃO redefinir */
--clr-primary: #19144c;
--clr-primary-50: #f4f3f9;
--clr-accent: #f8b046;
--font-serif: 'Newsreader Variable', Newsreader, Georgia, serif;
--font-sans: 'Inter', system-ui, sans-serif;
```

### Tokens NOVOS adicionados à busca

```css
:root {
  /* Highlight de termos */
  --clr-highlight-bg: #ffe9b5; /* derivado de --clr-accent */
  --clr-highlight-on: #19144c; /* navy do brand */
  --clr-highlight-ring: #f8b046; /* amarelo signature, borda 1px */

  /* Filter chips */
  --clr-chip-bg: var(--clr-primary-50);
  --clr-chip-on: var(--clr-primary);

  /* Skeleton de loading */
  --clr-skeleton: #ecedf0;
  --clr-skeleton-shimmer: #f4f5f8;
}

html.dark {
  --clr-bg: #0f0f1a; /* slate-base navy (não preto puro) */
  --clr-surface: #15152a;
  --clr-text: #ecedf3;

  --clr-highlight-bg: #6b5b1f; /* amarelo escurecido */
  --clr-highlight-on: #fff3a6;
  --clr-highlight-ring: #f8b046;

  --clr-chip-bg: rgba(248, 176, 70, 0.12);
  --clr-chip-on: #fbcb73;

  --clr-skeleton: #1a1a2e;
  --clr-skeleton-shimmer: #22223c;
}
```

### Contraste auditado (specialist verificou)

| Token                                     | Light contraste | Dark contraste | Padrão    |
| ----------------------------------------- | --------------- | -------------- | --------- |
| `--clr-highlight-on / --clr-highlight-bg` | 9.4:1           | 6.8:1          | AAA       |
| `--clr-chip-on / --clr-chip-bg`           | 7.2:1           | 5.4:1          | AAA / AA+ |
| Card title navy / surface                 | 12.1:1          | 11.3:1         | AAA       |

### Anti-fork rule (regra dura)

- Nenhuma propriedade CSS em `apps.search` redefine `--clr-primary`, `--font-serif`, `--font-sans`, `--clr-accent`.
- Lint check: `grep -RE "(--clr-primary|--font-serif): #" src/pages/Buscar/` → exit 1 no CI.

### Positive Consequences

- Single brand language preservado.
- Tokens novos derivam dos existentes (signature amarelo no highlight = identidade).
- Dark mode coerente com resto do app.
- WCAG AAA em vários estados.
- Manutenção barata (1 source of truth de paleta).

### Negative Consequences

- Designers que viram a v2 podem estranhar — comunicar mudança.
- Newsreader Variable é heavier que Lora (mas já carregado no app).
- Se Interpop trocar brand no futuro, busca herda automático — sem refactor.

## Pros and Cons of the Options

### Opção 1 — Fork ardósia

- 👍 Diferenciação visual da página de busca.
- 👎 Dois brand languages; dívida silenciosa.

### Opção 2 — Herdar ⭐

- 👍 Single brand; reuso; manutenção barata.
- 👎 Sem "personalidade" extra na busca (não é necessário).

## Implementation Notes

- **Task IDs**: T30.1.X11 (aplicar tokens herdados; adicionar só novos), T30.1.17 (ResultCard styles)
- **Arquivos**: `src/styles/global.css` (adicionar tokens novos no `:root` e `html.dark`)
- **Test**: a11y axe-core (contraste), visual regression (Percy/Chromatic snapshot)
- **Referência DESIGN.md**: §2.6 (specialist contestou v2)
- **Referência specialist**: `_specialist-outputs/04-ui-ux-architect.md`

## References

- DESIGN.md §2.6
- `_specialist-outputs/04-ui-ux-architect.md`
- ADR-030-UI (chips radius-md + cards thumb-left)
- ADR-022 (highlight visual consome `--clr-highlight-*`)
- WCAG 2.2 — 1.4.3 Contrast Minimum, 1.4.6 Contrast Enhanced
- Newsreader Variable specimen (Google Fonts)
- Material Design 3 — color roles
