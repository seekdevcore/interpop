# Output literal — `frontend-architect`

**Data**: 2026-06-02
**Agent ID**: a2e299a09111f2264
**Tokens output**: ~68k
**Skills invocadas**: `react-best-practices`, `tanstack-query-expert`, `core-web-vitals`, `web-accessibility`, `frontend-design`, `ecossistemas-ui-ux`

---

## Stack confirmada via leitura real

React 19.2 + TS 6 + Vite 8 + React Router 7.15 + react-error-boundary 6.1 + Vitest 4 + Testing Library 16. **Sem TanStack, sem mark.js, sem useDeferredValue ainda.**

`react-router-dom` v7 importado de `react-router-dom` (compat mode com v6 API, não data-router mode). `ErrorBoundary` global já em `AppRouter.tsx`. `api.ts` axios + httpOnly cookies + CSRF Django. `recharts` (~50KB gz) já code-split para `/admin` — orçamento +20KB para `/buscar` coerente.

## 1. Rendering — CONFIRMA CSR + aprofundamento crítico

**Veredito sobre LCP ≤ 2.5s p75 em CSR puro**: viável, mas **não automático**. O `index.html` do Vite tem `<div id="root"></div>` + 1 script — não há shell HTML real. LCP depende do JS carregar.

| Item            | Ação                                                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| TBT main bundle | `/buscar` lazy — TanStack + mark.js no chunk de Buscar, zero impacto na home                                                       |
| LCP candidate   | h1 "Buscar" + input no **bundle inicial do shell** (não no chunk lazy). Chunk entrega `<SearchResults>` + `<SearchInput>` internal |
| Preconnect      | `<link rel="preconnect" href={VITE_API_URL}>` em index.html                                                                        |
| Prefetch chunk  | `<link rel="modulepreload">` quando hover/focus no menu "Buscar". MVP: lazy padrão, medir antes                                    |
| CLS 0           | Skeleton com `min-height` calculado idêntico ao result card final                                                                  |
| Sanity check    | **Lighthouse baseline atual antes de prometer 2.5s**: `npx lighthouse http://localhost:5173`                                       |

Por que NÃO migrar SSR/Next.js agora: 4-6 semanas para 200ms no LCP em rota não-SEO-priority. **ADR-026 mantém**.

## 2. App shell — 3 ajustes vs main loop

```tsx
const Buscar = lazy(() =>
  import('../pages/Buscar').then((m) => ({ default: m.Buscar })),
);

<Route
  path="/buscar"
  element={
    <Suspense fallback={<BuscarSkeleton />}>
      <Buscar />
    </Suspense>
  }
/>;
```

1. **Não envolver em ErrorBoundary local** — `AppRouter` já tem ErrorBoundary global (linha 61). Adicionar local **apenas em volta de `<SearchResults>`**: padrão **resilient sub-tree** — input continua funcionando se fetch quebra.
2. **`BuscarSkeleton` ≠ `RouteLoader`**: skeleton replica frame final (h1 + input + 3 stub cards), não spinner centralizado.
3. **React Router 7 + Suspense streaming**: projeto usa `BrowserRouter` (não data-router). `<Suspense>` é padrão React clássico — funciona pra CSR + lazy, sem upgrade necessário.

## 3. State — CONFIRMA + refino crítico

| Camada     | Solução                                                          | Refino                                    |
| ---------- | ---------------------------------------------------------------- | ----------------------------------------- |
| URL        | `useSearchParams` RR7                                            | OK                                        |
| Server     | `@tanstack/react-query` v5 `useInfiniteQuery`                    | OK. DevTools só em dev via dynamic import |
| Input      | `useState` + **`useDebouncedValue` custom + `useDeferredValue`** | **PARCIAL** — ver §3.1                    |
| Form       | nenhum                                                           | OK                                        |
| Persistido | nenhum                                                           | OK (busca recente = post-MVP)             |

### 3.1 Debounce: useDeferredValue vs useTransition vs lodash — **CONTESTA main loop**

`useDeferredValue` **não tem delay configurável**. Sob carga ~80-200ms, em CPU rápido ~0ms. **Não substitui debounce real** — pode disparar 5 requests em 5 keystrokes.

| Mecanismo                                  | Resolve                       | Não resolve               | Veredito             |
| ------------------------------------------ | ----------------------------- | ------------------------- | -------------------- |
| `useDeferredValue`                         | Input fluido com lista pesada | Taxa de fetch HTTP        | Insuficiente sozinho |
| `useTransition`                            | Marcar updates não-urgentes   | Idem                      | Combo                |
| `lodash.debounce`                          | Atraso real configurável      | Não integra concurrent    | OK mas há melhor     |
| **`useDebouncedValue` custom (15 LoC)** ⭐ | Atraso real + cleanup         | —                         | **VENCEDOR**         |
| TanStack staleTime + dedupe                | Cache vence dupes             | Não evita request inicial | Combo                |

**Stack final**: `useDebouncedValue(input, 250)` → `useDeferredValue(debounced)` → query key. Reduz **requests** (rate limit 30/min) + lista 50 cards renderiza sem travar input (INP).

```tsx
// hooks/useDebouncedValue.ts (15 LoC, zero dep)
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
```

## 4. Data fetching

### 4.1 getNextPageParam null — **BUG LATENTE**

Main loop: `getNextPageParam: (last) => last.next_cursor`. **Bug**: backend retorna `next_cursor: null` quando `has_more === false`. TanStack trata `undefined` como "fim" mas **`null` como cursor válido vazio** → fetch infinito.

```tsx
getNextPageParam: (last) => last.next_cursor ?? undefined;
//                                          ^^^^^^^^^^ converte null → undefined
```

### 4.2 Query key canonical (filtros vazios não fragmentam cache)

```tsx
function canonicalKey(input: SearchParams) {
  return {
    q: input.q,
    ...(input.author && { author: input.author }),
    ...(input.category && { category: input.category }),
    ...(input.de && { de: input.de }),
    ...(input.ate && { ate: input.ate }),
  };
}

const query = useInfiniteQuery({
  queryKey: ['search', 'articles', canonicalKey(params)],
  queryFn: ({ pageParam, signal }) =>
    fetchSearch({ ...params, cursor: pageParam }, signal),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (last) => last.next_cursor ?? undefined,
  staleTime: 60_000, // = Cache-Control max-age
  gcTime: 5 * 60_000, // = stale-while-revalidate
  retry: (count, err) => {
    const status = (err as AxiosError).response?.status ?? 0;
    if (status >= 400 && status < 500) return false; // não retry 4xx
    return count < 1;
  },
  enabled: params.q.length >= 2,
});
```

### 4.3 AbortSignal

`useInfiniteQuery` injeta `signal` — passar a axios garante cancelamento de requests obsoletos. **Win INP free**.

### 4.4 Mutation

Sem. Busca é leitura pura. Salvar recente = post-MVP.

## 5. Performance budget auditado

| Métrica      | Budget   | Risco                                     |
| ------------ | -------- | ----------------------------------------- |
| LCP p75      | ≤2.5s    | **Médio** — depende baseline; medir antes |
| INP p75      | ≤200ms   | Baixo                                     |
| CLS          | ≤0.1     | Baixo                                     |
| Bundle delta | +20KB gz | Baixo (DevTools só dev)                   |
| Memory       | —        | `pages.length ≤ 10` (drop oldest)         |

### 5.1 mark.js lazy DENTRO do chunk Buscar

Verificar com `rollup-plugin-visualizer` (já instalado!) após build: `npx vite-bundle-visualizer`.

### 5.2 Lighthouse CI gate

Adicionar `lhci` ao CI: assert LCP/INP/CLS + bundle delta ≤20KB. Falha bloqueia merge.

## 6. A11y aprofundamento

### 6.1 polite vs assertive vs aria-busy

| Atributo                | Quando                              |
| ----------------------- | ----------------------------------- |
| `aria-live="polite"`    | Contagem após settle                |
| `aria-live="assertive"` | Apenas erros bloqueantes (429, 5xx) |
| `aria-busy="true"`      | Container durante fetch             |
| `aria-atomic="true"`    | Em region polite                    |

```tsx
{/* Polite — anuncia só quando data chega */}
<div aria-live="polite" aria-atomic="true" className="visually-hidden">
  {isSuccess && !isFetching && data
    ? `${data.pages[0].total_estimate} resultados para ${q}` : ''}
</div>

{/* Assertive — apenas erros */}
<div aria-live="assertive" role="alert" className="visually-hidden">
  {isError ? errorMessage : ''}
</div>

<section id="search-results" aria-busy={isFetching || isLoading}
         aria-labelledby="search-results-heading">
```

**Refino crítico vs main loop**: polite e assertive em regiões **separadas**, não a mesma. Misturar viola APG.

### 6.2 Focus management

- URL direta com `?q=`: foco no **input**
- Click no menu sem `?q=`: foco no **h1** (skip link funciona)
- Click "Carregar mais": foco move para **primeiro novo card**
- Back button: RR7 preserva scroll; foco volta ao input

### 6.3 Combobox APG — **CONFIRMA sem dropdown** + ajuste semântico

`role="combobox"` exige popup APG. **Trocar para `<input type="search">` puro**:

```tsx
<input
  type="search" // semântica nativa
  aria-label="Buscar artigos"
  aria-describedby="search-help"
  aria-controls="search-results"
  // SEM role="combobox", SEM aria-expanded
/>
```

Atualizar **ADR-028**.

### 6.4 Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  .search-skeleton {
    animation: none;
  }
  .search-results-fade {
    transition: none;
  }
}
```

## 7. Build pipeline

| Item     | Atual                           | Mudança                                                |
| -------- | ------------------------------- | ------------------------------------------------------ |
| Bundler  | Vite 8                          | nenhuma                                                |
| Package  | npm                             | `npm add @tanstack/react-query mark.js @types/mark.js` |
| CI gates | ESLint, TSC, Vitest, pytest 40% | **ADD**: lhci + axe-core + size-limit (opt)            |

## 8. Estrutura `/buscar` concreta

```
src/pages/Buscar/
├── index.ts
├── Buscar.tsx
├── Buscar.css
├── components/
│   ├── SearchInput.tsx
│   ├── FilterChips.tsx
│   ├── FilterPanel.tsx
│   ├── SearchResults.tsx
│   ├── ResultCard.tsx
│   ├── ResultHighlight.tsx
│   ├── BuscarSkeleton.tsx
│   ├── ResultsSkeleton.tsx
│   ├── EmptyState.tsx
│   ├── EmptyResults.tsx
│   ├── ErrorState.tsx
│   └── RateLimitedState.tsx
├── hooks/
│   ├── useSearch.ts
│   ├── useDebouncedValue.ts
│   ├── useSearchParamsState.ts
│   └── useHighlight.ts
├── services/
│   └── searchService.ts
├── types.ts
└── __tests__/
    ├── Buscar.test.tsx
    ├── SearchInput.test.tsx
    ├── useSearch.test.ts
    └── a11y.test.tsx
```

Adicionar em `src/main.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 },
  },
});
// <QueryClientProvider client={queryClient}><AuthProvider>...
```

## 9. Test strategy

```tsx
function renderBuscar(initialUrl = '/buscar') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialUrl]}>
        <Suspense fallback={<div>loading</div>}>
          <Buscar />
        </Suspense>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
```

- **MSW**: `npm add -D msw` (mock `/api/v1/search/articles/`)
- **axe-core**: `npm add -D @axe-core/react jest-axe` → `expect(await axe(container)).toHaveNoViolations()` em cada estado
- **Cursor null**: 1 test específico para `next_cursor: null` → `hasNextPage === false`

## 10. ADRs

| ID               | Mudança                                                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **ADR-026**      | CSR + nota "medir LCP baseline antes de merge"                                                                                      |
| **ADR-027 AMPL** | TanStack `useInfiniteQuery` + URL SSOT + `useDebouncedValue` 250ms + `useDeferredValue`. `useDeferredValue` NÃO substitui debounce. |
| **ADR-028 REV**  | `<input type="search">` semântico — `role="combobox"` rejeitado                                                                     |
| **ADR-030 NEW**  | Resilient sub-tree: ErrorBoundary local em `<SearchResults>`                                                                        |
| **ADR-031 NEW**  | Lighthouse CI gate em `/buscar?q=kpop` bloqueia PR                                                                                  |

## 11. Handoff

- → `ui-ux-architect`: confirmar contraste `<mark>` dark (`#6b5b1f` + `#fff3a6` ≈ 7.2:1 ✅)
- → `cyber-security-architect`: CSP mark.js (usa wrapMatches com nodes, seguro); query_echo escapado; cookies httpOnly; sem localStorage de query
- → `testing-engineer`: plano por estado; add MSW + axe; bundle-size gate
- → `code-implementer`: ordem (1) deps + QueryClientProvider, (2) types + service, (3) hook red, (4) componentes MVP, (5) error/empty, (6) highlight, (7) a11y audit, (8) Lighthouse local

## 12. 6 pontos contestados ao main loop

1. **useDeferredValue ≠ debounce 250ms** — falso. Precisa `useDebouncedValue` próprio.
2. **role="combobox" sem dropdown** — antipattern APG. Trocar por `<input type="search">`.
3. **ErrorBoundary envolvendo `<Buscar>`** — redundante. Mover para sub-tree `<SearchResults>`.
4. **`getNextPageParam: last.next_cursor`** — bug latente com null. Coercer para undefined.
5. **"CSR shell pré-renderizado dá boa LCP"** — não automático. Medir baseline antes.
6. **`aria-live` único polite** — separar polite (contagem) e assertive (erro).
