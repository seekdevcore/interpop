# ADR-030-FE: Resilient sub-tree ErrorBoundary local em `<SearchResults>`

- **Status**: Accepted (novo v3)
- **Date**: 2026-06-03
- **Tags**: frontend, react, error-boundary, resilience, ux
- **Stakeholders**: frontend-architect (autor), code-implementer
- **Layer**: Frontend

## Context

v2 propunha envolver `<Buscar>` inteiro em `<ErrorBoundary>`. Specialist `frontend-architect` contestou:

- `AppRouter` já tem `<ErrorBoundary>` global para crashes catastróficos.
- Envolver `<Buscar>` duplica responsabilidade.
- **Pior**: se fetch falha (erro 500 do backend), a página inteira fica em estado de erro — usuário não pode editar a query para tentar outra coisa.

Padrão correto: **resilient sub-tree** — `<ErrorBoundary>` envolve apenas a sub-árvore que pode falhar (`<SearchResults>`), mantendo `<SearchInput>` + `<FilterChips>` funcionais.

## Decision Drivers

- UX: input continua funcionando se fetch falha
- Não duplicar ErrorBoundary global
- Recuperação clara (`<ErrorState>` com botão "Tentar novamente")

## Considered Options

1. **ErrorBoundary envolvendo `<Buscar>`** — toda página vira erro; UX ruim.
2. **ErrorBoundary só em `<SearchResults>`** ⭐
3. **Sem ErrorBoundary local** — depende só do global; usuário perde contexto.

## Decision Outcome

**Chosen: Opção 2**.

### Estrutura

```tsx
// Buscar.tsx
<form role="search">
  <SearchInput />
  <FilterChips />
</form>

<ErrorBoundary
  FallbackComponent={SearchErrorFallback}
  onReset={() => queryClient.resetQueries(["search"])}
  resetKeys={[deferredQ, paramsHash]}
>
  <Suspense fallback={<ResultsSkeleton />}>
    <SearchResults />
  </Suspense>
</ErrorBoundary>
```

### `SearchErrorFallback`

```tsx
function SearchErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert" aria-live="assertive" id="search-error">
      <h2>Não foi possível buscar agora</h2>
      <p>{error.message}</p>
      <button onClick={resetErrorBoundary}>Tentar novamente</button>
    </div>
  );
}
```

### `resetKeys` derivam de `(deferredQ, paramsHash)`

Quando usuário edita query/filtro, ErrorBoundary auto-reseta — não exige clique em "Tentar novamente".

### Positive Consequences

- Input sobrevive a erro de fetch.
- Reset automático em mudança de query.
- `aria-live="assertive"` anuncia erro a leitores de tela.
- Não duplica global error boundary.

### Negative Consequences

- Dev precisa entender que ErrorBoundary local ≠ global.
- Erros muito raros em `<SearchInput>` ainda caem no global (acceptable).

## Implementation Notes

- **Task IDs**: T30.1.X9 (mover ErrorBoundary para sub-tree), T30.3.4 (ErrorState component)
- **Deps**: `react-error-boundary` (já no projeto, v6.1)
- **Componente**: `src/pages/Buscar/components/SearchErrorFallback.tsx`
- **Test**: unit (render error → fallback aparece, input continua editável), integration (queryClient.resetQueries dispara refetch)
- **Referência DESIGN.md**: §2.5
- **Referência specialist**: `_specialist-outputs/03-frontend-architect.md` ponto 3

## References

- DESIGN.md §2.5
- `_specialist-outputs/03-frontend-architect.md`
- ADR-027 (TanStack Query — fonte de erros)
- react-error-boundary docs — `FallbackComponent`, `resetKeys`
- Kent C. Dodds — "Use react-error-boundary"
