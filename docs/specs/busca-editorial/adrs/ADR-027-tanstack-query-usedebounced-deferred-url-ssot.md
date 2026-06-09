# ADR-027: TanStack Query + `useDebouncedValue` 250ms + `useDeferredValue` (não substitui debounce) + URL SSOT

- **Status**: Accepted (ampliado v3)
- **Date**: 2026-06-03
- **Tags**: frontend, react-19, tanstack-query, debounce, deferred-value, url-state, search-as-you-type
- **Stakeholders**: frontend-architect (autor), backend-architect, code-implementer
- **Layer**: Frontend
- **Decisão alinhada com**: roadmap.sh/react (state management, performance)

## Context

Search-as-you-type debounced + URL deep-linkable + paginação infinita. Forças:

- **`useDeferredValue` (React 19) NÃO é debounce** — não tem delay configurável, só prioriza render. Sem debounce, cada keystroke gera request HTTP → estoura rate limit em 5s de digitação.
- **TanStack Query v5** entrega `useInfiniteQuery` + cache + retry + cancel via AbortSignal + `staleTime`. Substituir por reducer custom seria refactor sem ganho.
- **URL SSOT** (`/buscar?q=...&author=...&de=...&ate=...&cursor=...`): Back/Refresh/Share funcionam. Sem URL SSOT, share quebra.
- **`getNextPageParam: last.next_cursor`** sem `?? undefined` → TanStack interpreta `null` como cursor válido vazio → fetch infinito.

## Decision Drivers

- Reduzir REQUESTS HTTP via debounce real (não só priorização)
- Manter INPUT fluido em digitação rápida (useDeferredValue)
- URL é única fonte de verdade do estado de busca
- Cancel automático de requests obsoletos
- Prevenir fetch infinito (Bug 6 do DESIGN §0)

## Considered Options

1. **`useDeferredValue` puro** — não reduz requests; rejeitado.
2. **Debounce manual + fetch axios + reducer** — reinventa TanStack.
3. **TanStack Query + `useDebouncedValue` (15 LoC) + `useDeferredValue` + URL SSOT** ⭐
4. **SWR + custom debounce** — inferior em infinite scroll DX.

## Decision Outcome

**Chosen: Opção 3**.

### Stack final no `useSearch` hook

```tsx
const [params, setParams] = useSearchParams();  // URL SSOT
const inputQ = params.get("q") ?? "";

const debouncedQ = useDebouncedValue(inputQ, 250);  // reduz REQUESTS
const deferredQ = useDeferredValue(debouncedQ);     // mantém INPUT fluido

const { data, fetchNextPage, hasNextPage, isLoading, error } = useInfiniteQuery({
  queryKey: ["search", "articles", canonicalKey({
    q: deferredQ,
    author: params.get("author") ?? undefined,
    category: params.get("category") ?? undefined,
    de: params.get("de") ?? undefined,
    ate: params.get("ate") ?? undefined,
  })],
  queryFn: ({ pageParam, signal }) =>
    fetchSearch({ q: deferredQ, ..., cursor: pageParam }, signal),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (last) => last.next_cursor ?? undefined,  // ← FIX BUG 6
  staleTime: 60_000,
  gcTime: 5 * 60_000,
  retry: (count, err) => {
    const status = (err as AxiosError).response?.status ?? 0;
    if (status >= 400 && status < 500) return false;  // não retry 4xx
    return count < 1;
  },
  enabled: deferredQ.length >= 2,
});
```

### `useDebouncedValue` (15 LoC, zero dep)

```tsx
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
```

### Por que combinar debounce + deferred?

| Camada                          | Reduz             | Mantém                       |
| ------------------------------- | ----------------- | ---------------------------- |
| `useDebouncedValue(input, 250)` | **Requests HTTP** | —                            |
| `useDeferredValue(debounced)`   | —                 | **INPUT fluido em rerender** |

Sem debounce: digitar "kpop" rápido faz 4 requests. Sem deferred: input trava em listas grandes.

### URL SSOT — escrita

```tsx
function setQ(newQ: string) {
  setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (newQ) next.set('q', newQ);
    else next.delete('q');
    next.delete('cursor'); // reset paginação
    return next;
  });
}
```

### Bug 6 fix (não substituível)

`getNextPageParam: (last) => last.next_cursor ?? undefined` — sem `?? undefined`, `null` é treated as truthy by TanStack → `hasNextPage = true` para sempre → InfiniteScroll dispara fetch infinito.

### Positive Consequences

- 1 request por digitação completa (não por keystroke).
- INPUT permanece responsivo em rerender.
- URL share funciona (`q + filters + cursor`).
- Cancel automático em troca de query (AbortSignal).
- Retry não tenta 4xx (rate limit não escala).

### Negative Consequences

- 250ms de latência percebida adicional (acceptable; está abaixo do umbral 300ms de Doherty).
- Estado em 4 lugares (URL, input local, debounced, deferred) — exige discipline.
- `enabled: deferredQ.length >= 2` exige UX clara para query curta.

## Implementation Notes

- **Task IDs**: T30.1.X6 (useDebouncedValue 🔴 Immediate), T30.1.X7 (getNextPageParam fix 🔴), T30.1.15 (useSearch hook), T30.1.16 (useSearchParamsState)
- **Deps**: `npm add @tanstack/react-query`
- **Config**: `QueryClientProvider` em `src/main.tsx`
- **Test**: unit (`useDebouncedValue` espera 250ms), unit (`getNextPageParam(null) === undefined`), integration (3 keystrokes em 200ms → 1 request), e2e (back button restaura query+filtros)
- **Referência DESIGN.md**: §2.5 (frontend), §3.3 (perf)
- **Referência specialist**: `_specialist-outputs/03-frontend-architect.md` (pontos 1, 4)

## References

- DESIGN.md §2.5
- `_specialist-outputs/03-frontend-architect.md`
- ADR-026 (CSR + Lighthouse gate)
- ADR-030-FE (Resilient sub-tree ErrorBoundary)
- TanStack Query docs — useInfiniteQuery, getNextPageParam
- React 19 — useDeferredValue (não substitui debounce)
- Doherty threshold (400ms perceptive latency)
