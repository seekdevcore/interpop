# ADR-028: `<input type="search">` semântico — `role="combobox"` rejeitado (APG)

- **Status**: Accepted (revisado v3)
- **Date**: 2026-06-03
- **Tags**: ui-ux, a11y, wcag, apg, combobox, semantic-html, form-search
- **Stakeholders**: ui-ux-architect (autor), frontend-architect, code-implementer
- **Layer**: UI/UX

## Context

v2 do DESIGN propunha `<input role="combobox" aria-expanded="false">`. Specialists (`ui-ux-architect` + `frontend-architect`) contestaram: **antipattern APG**.

WAI-ARIA Authoring Practices Guide define `combobox` como **input + listbox associado**. Combobox sem listbox é violação semântica que confunde leitores de tela:

- NVDA anuncia "combo box, sem opções" → usuário tenta abrir dropdown → nada acontece → confusão.
- VoiceOver idem.
- `aria-expanded="false"` fixo é mentira semântica (não há nada para expandir).

Inspiração de mercado (NYT, Substack, The Atlantic, Vogue, ZEIT): **nenhum** usa combobox em busca primária. Todos usam `<form role="search"><input type="search"></form>`. Padrão "input + lista abaixo" venceu para leitura longa.

## Decision Drivers

- WCAG 2.2 AA (NFR)
- Conformidade com APG
- Padrão consagrado em editorial (NYT/Substack)
- Sem listbox dropdown no MVP (resultados aparecem **abaixo** da input, na página)

## Considered Options

1. **`<input role="combobox" aria-expanded="false">`** — antipattern APG.
2. **`<form role="search"><input type="search"></form>`** ⭐ — semântica correta.
3. **Adicionar listbox dropdown** — out-of-scope MVP.

## Decision Outcome

**Chosen: Opção 2**.

### Markup

```tsx
<form role="search" onSubmit={(e) => e.preventDefault()}>
  <label htmlFor="search-input" className="visually-hidden">
    Buscar artigos
  </label>
  <input
    id="search-input"
    type="search"
    name="q"
    placeholder="Buscar artigos..."
    value={inputQ}
    onChange={(e) => setQ(e.target.value)}
    autoComplete="off"
    spellCheck={false}
    enterKeyHint="search"
    aria-describedby="search-status"
  />
  <span id="search-status" className="visually-hidden" aria-live="polite">
    {isLoading ? 'Buscando...' : `${data?.total_estimate ?? 0} resultados`}
  </span>
</form>
```

### Por que `<form role="search">`?

- `<form>` semântico — submit via Enter.
- `role="search"` (landmark) — leitores de tela navegam por landmarks.
- `<input type="search">` — Safari/Chrome renderizam `×` para limpar; iOS keyboard mostra botão "Buscar".

### `aria-live` separado em duas regiões

| Região                   | Politeness  | Conteúdo               |
| ------------------------ | ----------- | ---------------------- |
| `#search-status` (count) | `polite`    | "142 resultados"       |
| `#search-error` (erro)   | `assertive` | "Erro: refine a busca" |

Não misturar polite + assertive na mesma região (specialist `frontend-architect` ponto 6).

### Positive Consequences

- WCAG 2.2 AA ✓
- APG-compliant.
- Padrão consagrado de editorial.
- iOS keyboard "Buscar" funciona out-of-box.
- Landmark `<form role="search">` ajuda NVDA/JAWS navigation.

### Negative Consequences

- Sem dropdown sugestões no MVP (postergado).
- Se Sprint 5+ adicionar autocomplete, migração para combobox correto (com listbox) exige refactor — aceitável (refactor honesto > antipattern hoje).

## Pros and Cons of the Options

### Opção 1 — combobox sem listbox

- 👍 Permite adicionar dropdown depois sem renomear role.
- 👎 Antipattern APG; viola WCAG 4.1.2 (Name, Role, Value).
- 👎 Leitor de tela confunde.

### Opção 2 — `<input type="search">` ⭐

- 👍 Semântica correta hoje.
- 👍 Padrão consagrado.
- 👎 Refactor se autocomplete entrar.

## Implementation Notes

- **Task IDs**: T30.1.X8 (🔴 Immediate — trocar role), T30.1.15 (SearchInput component)
- **Componente**: `src/pages/Buscar/components/SearchInput.tsx`
- **Test**: a11y (axe-core: no APG violation), unit (Enter submete via form), e2e (NVDA-like screen reader navega por landmark "search")
- **Referência DESIGN.md**: §2.6 (UI/UX)
- **Referência specialist**: `_specialist-outputs/04-ui-ux-architect.md` + `_specialist-outputs/03-frontend-architect.md` ponto 2

## References

- DESIGN.md §2.6, §3.5
- `_specialist-outputs/04-ui-ux-architect.md`, `_specialist-outputs/03-frontend-architect.md`
- WAI-ARIA Authoring Practices — Combobox Pattern (https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)
- WCAG 2.2 — 4.1.2 Name, Role, Value
- NYT, Substack, The Atlantic — search input patterns (Mobbin reference)
