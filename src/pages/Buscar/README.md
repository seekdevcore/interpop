# `/buscar` — Busca editorial full-text (US30.1)

Página de busca do Interpop. Spec autoritativa: `docs/specs/busca-editorial/DESIGN.md` v3 (§2.5/§2.6).

## Estrutura

```
src/pages/Buscar/
├── Buscar.tsx              # Página principal (form role=search + ErrorBoundary)
├── Buscar.css
├── index.tsx               # Default export para o lazy() do AppRouter
├── types.ts                # Tipos do contract OpenAPI do backend
├── README.md               # Este arquivo
├── components/
│   ├── SearchInput.tsx     # <input type="search"> + URL SSOT (ADR-028)
│   ├── FilterChips.tsx     # Shell (Sprint 5 plugará popovers)
│   ├── SearchResults.tsx   # Branch dos 5 estados
│   ├── ResultCard.tsx      # Card thumb-left 120×80 (ADR-030-UI)
│   ├── HighlightedText.tsx # mark.js + query_terms_expanded (ADR-022)
│   ├── EmptyState.tsx, EmptyResults.tsx, RateLimitedState.tsx
│   ├── SearchErrorFallback.tsx, Skeletons.tsx
├── hooks/
│   ├── useSearch.ts        # TanStack Query + Bug 6 fix (ADR-027)
│   ├── useDebouncedValue.ts # 15 LoC zero-dep
│   ├── useSearchParamsState.ts
├── services/
│   └── searchService.ts    # axios wrapper + SEARCH_STALE_TIME (SSOT)
└── __tests__/              # 78 tests (Buscar, SearchResults, a11y axe-core)
```

## Dev local com MSW

O Vite dev server intercepta `/api/v1/search/articles/` com handlers em `src/mocks/` (BLOQUEIO-1 do REVIEW-PHASE-3 / T30.1.X12).

**Pré-requisito** (uma vez, já feito): `npx msw init public/ --save` — gera `public/mockServiceWorker.js`. Está commitado no repo.

**Rodando**:

```bash
npm run dev     # http://localhost:5173/buscar
```

O worker registra automaticamente em DEV. No console do browser: `[MSW] Mocking enabled.`.

### Cenários simulados (`q=...`)

| Query            | Resposta                       | Uso                              |
| ---------------- | ------------------------------ | -------------------------------- |
| `kpop` (default) | 10 hits, `total_estimate: 142` | UX feliz                         |
| `qzxzqzx`        | 0 hits, EmptyResults           | Validar branch "Nada encontrado" |
| `flood`          | 429 + `Retry-After: 23`        | Validar RateLimitedState         |
| qualquer outra   | 10 hits genéricos              | Default                          |

Latência artificial: 300ms (casa com p50 do DESIGN §0). Sem isso, transição empty→loading→results é invisível.

### Desligar MSW (apontar para Django local)

```
http://localhost:5173/buscar?msw=off&q=kpop
```

Reverte ao backend real em `VITE_API_URL` (default `http://localhost:8000`).

### Produção

`main.tsx` faz dynamic `import('./mocks/browser')` **apenas** em `import.meta.env.DEV`. Em produção, Vite tree-shakes e `msw` não entra no bundle (verificado via `npm run build` — sem chunk `mocks-*` em `dist/`).

## ADRs honrados

- ADR-022 (highlight com `query_terms_expanded`)
- ADR-026 (CSR + lazy route)
- ADR-027 (debounce 250 + URL SSOT + Bug 6 fix)
- ADR-028 (`<input type="search">`, rejeita combobox)
- ADR-029 (paleta editorial herdada; sem fork)
- ADR-030-FE (Resilient sub-tree ErrorBoundary)
- ADR-030-UI (chips radius-md + card thumb-left)
- ADR-031-FE (Lighthouse CI gate ≤+20 KB gz — atual: 14.5 KB gz lazy)
- ADR-045 (axe-core nos 5 estados)

## Tasks futuras (Sprint 5)

- F-31 filtros funcionais (popover author/category/range datas)
- F-32 deep-linking complexo
- Visual regression Playwright (ADR-042 / T30.1.X20)
- E2E Playwright (T30.1.X21)
- Property-based para `useDebouncedValue` + `canonicalKey` (T30.1.X22)
- i18n extract (T30.1.X24)
