# ADR-026: CSR no MVP; medir LCP baseline antes; SSR re-avaliado em v2

- **Status**: Accepted
- **Date**: 2026-06-03
- **Tags**: frontend, rendering, csr, ssr, core-web-vitals, lcp
- **Stakeholders**: frontend-architect (autor), software-architect, code-implementer
- **Layer**: Frontend
- **Decisão alinhada com**: roadmap.sh/frontend (rendering strategies)

## Context

Interpop é React 19 + Vite + React Router 7 (CSR puro hoje). NFR: LCP ≤ 2.5s p75. Forças:

- v2 do DESIGN afirmava "CSR shell pré-renderizado dá boa LCP" — frontend-architect contestou: **não é automático**. LCP depende de skeleton inicial + TTFB + JS parse + first paint. Sem medição baseline, é especulação.
- Migrar para SSR (Next.js, Remix) é refactor grande (Vite ≠ Next; routing migra). Não justifica para MVP de busca.
- Estado atual da árvore: SPA com lazy routes; `/buscar` será mais uma rota lazy. Shell HTML + CSS crítico in-line carrega rápido.
- Search é descoberta — não é landing page indexada por SEO (já existe `/` + `/editoria/<slug>` para isso). LCP < 2.5s aceitável em CSR.

## Decision Drivers

- Manter Vite + React Router (não migrar para Next no MVP)
- Provar LCP ≤ 2.5s p75 com medição real (não fé)
- Bloquear regressões via Lighthouse CI
- Re-avaliar SSR só se medição apontar gap > 500ms

## Considered Options

1. **CSR + skeleton + Lighthouse gate** ⭐
2. **SSR via Next.js** — rejeitado (refactor desproporcional).
3. **ISR via TanStack Start** — rejeitado (alpha; ecossistema imaturo).
4. **Pre-render estático** (vite-ssg) — rejeitado (busca é dinâmica).

## Decision Outcome

**Chosen: Opção 1**.

### Fluxo

1. **TX-18 (🔴 Immediate)**: rodar `npx lighthouse http://localhost:5173 --preset=desktop --view` e `--preset=mobile` em main atual. Salvar `docs/performance/lighthouse-baseline-pre-busca.json`.
2. Implementar `/buscar` em CSR.
3. **TX-16 (Lighthouse CI gate)**: adicionar workflow GitHub Actions com `lhci autorun` em `/buscar?q=kpop`. Asserts: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1, bundle delta vs main ≤ 20KB gz.
4. Se gate falha → bloqueia PR. Se passa, MVP estável.
5. Re-avaliar SSR em Sprint 7+ **só se**:
   - Lighthouse field p75 > 2.5s em produção (RUM via Sentry/Vercel Analytics), OU
   - Bundle JS bate 300KB gz (sintoma de inflação).

### Skeleton inicial (LCP target)

```tsx
// Buscar.tsx
<Suspense fallback={<BuscarSkeleton />}>
  <SearchProvider>
    <SearchInput />
    <FilterChips />
    <SearchResults />
  </SearchProvider>
</Suspense>
```

`BuscarSkeleton` é HTML/CSS inline (sem JS lazy). LCP element = container do skeleton (~50ms paint após HTML).

### Positive Consequences

- Zero refactor de routing/build.
- Provado por medição (não suposição).
- Lighthouse CI gate previne regressão.
- Re-avaliação tem trigger explícito (não "talvez no futuro").

### Negative Consequences

- LCP em 3G real (não Lighthouse Desktop) pode ser pior — RUM precisa monitorar.
- SEO da página `/buscar` é nulo (CSR sem SSR) — aceitável (não é landing).
- TTI maior que SSR em conexão lenta.

## Pros and Cons of the Options

### Opção 1 — CSR + Lighthouse gate ⭐

- 👍 Zero refactor; mensurável.
- 👎 SEO zero (não é problema).

### Opção 2 — SSR via Next.js

- 👍 LCP/SEO superior.
- 👎 Refactor 3 sprints; OOS no MVP.

## Implementation Notes

- **Task IDs**: TX-18 (🔴 Immediate — baseline antes), TX-16 (Lighthouse CI gate)
- **Tooling**: `npx lighthouse`, `@lhci/cli`, GitHub Actions workflow
- **CI gate**: `lhci autorun --assert.preset=lighthouse:recommended --assert.assertions.first-contentful-paint=2000`
- **Test**: smoke (`/buscar` renderiza skeleton em ≤100ms localhost), integration (Suspense fallback exibido), e2e (LCP medido em Playwright trace)
- **Referência DESIGN.md**: §2.5 (frontend), §3.3 (perf budget)
- **Referência specialist**: `_specialist-outputs/03-frontend-architect.md` (contestou v2; pontos 5 e 7)

## References

- DESIGN.md §2.5, §3.3
- `_specialist-outputs/03-frontend-architect.md`
- ADR-027 (TanStack Query + debounce)
- ADR-030-FE (Resilient sub-tree)
- ADR-031-FE (Lighthouse CI gate)
- web.dev — LCP optimization
- Vite docs — code splitting + lazy routes
