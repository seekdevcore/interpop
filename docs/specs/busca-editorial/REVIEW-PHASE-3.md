# REVIEW — Fase 3 (Frontend MVP `/buscar`) — Busca Editorial

**Reviewer**: `gsd-code-reviewer` (Opus 4.7 — sócio sênior, anti-sycophancy, Gabarito aplicado)
**Data**: 2026-06-06 · **Branch**: `develop` (HEAD `f0b3f34`, base `e4ce5df`) · **7 commits**, ~1.5k LoC
**Materializado por**: main-loop (agent retornou conteúdo mas Write foi negado; salvo no path canônico)

---

## §0. Veredito

> **APROVADO COM RESSALVAS — bloqueado para PR US30.1 até `BLOQUEIO-1` (MSW vazio) e `BLOQUEIO-2` (axe-core ausente) serem corrigidos ou explicitamente descopados.**

Justificativa: o trabalho da Fase 3 está em qualidade alta — arquitetura limpa (separação hook/service/componente), Bug 6 fix verificado por teste unitário (`useSearch.ts:50` + `useSearch.test.tsx:54-58`), ADR-022/028/029/030-UI corretamente implementados, 64 tests passando, bundle dentro do gate (~14.5 KB gz), e o XSS hardening do `HighlightedText` está testado com payloads reais. **Porém duas alegações do brief/commit messages não se confirmam no código**: (a) `src/mocks/handlers/` é um diretório vazio — zero arquivos, embora `msw@^2.14.6` esteja em devDeps; (b) o commit `f0b3f34` declara "[a11y axe-core]" mas não há uma única linha de `vitest-axe`/`@axe-core/react` em qualquer test. Esses dois pontos somados constituem regressão de escopo do plano. Além disso há quatro WARNINGS de qualidade (race do mark.js em remontes rápidos, validação frouxa de `category` na URL, `staleTime`/`gcTime` duplicados, categoria sem token de contraste editorial). Nada disso é crash — mas o gate honesto da Fase 3 só passa quando os bloqueios forem fechados ou descopados explicitamente no body do PR.

---

## §1. Skills invocadas

`code-review-excellence`, `react-best-practices`, `tanstack-query-expert`, `web-accessibility`, `wcag-audit-patterns`, `core-web-vitals`, `cc-skill-security-review`, `superpowers:systematic-debugging`, `frontend-design`, `ecossistemas-ui-ux`.

---

## §2. Conformidade ADR

| ADR            | Item                                                                                                                        | Status     | Evidência                                                                                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ADR-022**    | HighlightedText usa `query_terms_expanded`; CSP-safe via refs/mark.js (sem `dangerouslySetInnerHTML`); XSS payload escapado | ✅         | `HighlightedText.tsx:54-74` recebe `terms: string[]`, lido em `SearchResults.tsx:86`. Tests `HighlightedText.test.tsx:60-86` cobrem `<script>` e `<img onerror>` |
| **ADR-026**    | CSR + lazy route; sem SSR no MVP; baseline Lighthouse capturado                                                             | ✅         | `AppRouter.tsx:37,82-89` — `lazy(() => import('../pages/Buscar'))` com Suspense                                                                                  |
| **ADR-027**    | `useDebouncedValue(250ms)` + `useDeferredValue` + URL SSOT; Bug 6 `?? undefined`; retry 4xx false / 5xx 1×                  | ✅         | `useSearch.ts:47-51` (`?? undefined`), `:53-60` (retry). Tests `useSearch.test.tsx:53-65` Bug 6, `:99-116` retry                                                 |
| **ADR-028**    | `<form role="search">` + `<input type="search">`; zero `role="combobox"`; `enterKeyHint="search"`; landmark                 | ✅         | `SearchInput.tsx:46,77,81`. Test `Buscar.test.tsx:58-62` valida `querySelector('[role="combobox"]')` é null                                                      |
| **ADR-029**    | Tokens herdados; zero redefinição de `--clr-primary`/`--font-serif`/`--clr-accent` em arquivos Buscar; light + dark AA+     | ✅         | grep retorna apenas comentários e usos `var(--...)`. Tokens novos em `global.css:139-152` + `:157-169`                                                           |
| **ADR-030-FE** | ErrorBoundary só envolve `<SearchResults>`; `resetKeys=[deferredQ]`; `onReset` reseta queries                               | ✅         | `Buscar.tsx:39-58` — boundary em `ResultsRegion`, input vive fora                                                                                                |
| **ADR-030-UI** | `grid-template-columns: 120px 1fr`; thumb 120×80 anti-CLS; chips `radius-md`; placeholder letra editoria                    | ✅         | `ResultCard.css:4-10`, `ResultCard.tsx:56-57`, `FilterChips.css:33`                                                                                              |
| **ADR-031-FE** | Bundle Buscar lazy ≤ +20 KB gz                                                                                              | ✅         | 12.70 KB gz JS + 1.86 KB gz CSS = **14.56 KB gz** dentro do gate                                                                                                 |
| **ADR-042**    | 5 estados isoláveis para visual regression                                                                                  | 🟡 parcial | Isoláveis em mock; sem Playwright `toHaveScreenshot` — Sprint 5                                                                                                  |
| **ADR-045**    | Axe-core em testes a11y nos 5 estados                                                                                       | 🔴         | **Não cumprido** — vide BLOQUEIO-2                                                                                                                               |

---

## §3. Achados por severidade

### 🔴 BLOQUEIO — corrigir/descopar ANTES do PR US30.1

#### BLOQUEIO-1 — `src/mocks/handlers/` vazio

- **Arquivo**: `src/mocks/handlers/` (existe, 0 arquivos)
- **Vetor/Impacto**: BACKLOG e brief afirmam smoke local com handlers MSW. `package.json:62` instala `msw@^2.14.6` (~3 MB) e o dir foi criado vazio. Novo dev clona o repo e `/buscar` mostra Error sem backend Django na porta 8000.
- **Mitigação**: (a) Criar `src/mocks/handlers/search.ts` com 3 cenários (success / no_results / 429) + `src/mocks/browser.ts` com `setupWorker(...handlers)` ativado por `import.meta.env.DEV`; rodar `npx msw init public/`. (b) Se descopado: REMOVER `msw` de `package.json` e adicionar nota em BACKLOG. **~2h**.

#### BLOQUEIO-2 — Commit `f0b3f34` alega `[a11y axe-core]` mas zero imports

- **Arquivo**: `src/pages/Buscar/**/__tests__/*.test.tsx` (8 arquivos)
- **Vetor**: `grep` confirma zero `vitest-axe`, `toHaveNoViolations`, `@axe-core/react`. `vitest-axe@0.1.0` em devDeps mas nunca importado. ADR-045 exige axe nos 5 estados.
- **Mitigação**: Adicionar `src/pages/Buscar/__tests__/a11y.test.tsx` cobrindo os 5 estados via `expect(await axe(container)).toHaveNoViolations()` (~60 LoC, **~1h**). Se descopado: o body do PR US30.1 NÃO pode mencionar axe-core.

### 🟠 HIGH — fix antes do PR final (cabem no mesmo PR)

| ID       | Arquivo:linha                           | Descrição                                                                                                                                                                                                                             | Esforço |
| -------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| **H-01** | `FilterChips.tsx:41-49`                 | `category=NaN`/`foo` vira chip "Editoria: foo". `useSearchParamsState.ts:32-37` valida com `Number.isFinite` mas FilterChips lê raw. Não-XSS (React escapa) mas UX-bug latente.                                                       | ~10 min |
| **H-02** | `main.tsx:18-20` + `useSearch.ts:92-93` | `staleTime`/`gcTime` duplicados. Coincidem hoje; em 3 meses alguém altera só um lado → cache desincronizado.                                                                                                                          | ~15 min |
| **H-03** | `HighlightedText.tsx:54-74`             | `unmark({done: () => mark(...)})` é async. Em re-renders rápidos pode aninhar `<mark><mark>kpop</mark></mark>`. Fix: `return () => instance.unmark();` no return do effect.                                                           | ~10 min |
| **H-04** | `ResultCard.css:105-108`                | Categoria usa `--clr-primary` em vez do token editorial dedicado (`--clr-cat-musica` etc., já validados WCAG AA em `global.css:66-75`). `data-variant={item.category?.slug}` já está em `ResultCard.tsx:48` mas não é usado pelo CSS. | ~30 min |

### 🟡 MEDIUM — backlog Sprint 5

- **M-01** Cursor não reseta quando `q` muda (`useSearchParamsState.setQ`)
- **M-02** `aria-live="polite"` no header dispara em cada refetch — ruidoso em UX editorial
- **M-03** `EmptyResults.query` pode render string longa sem truncate (DoS visual, não XSS)
- **M-04** `mark.js` 8 KB gz por 30 LoC funcionais — avaliar custom impl
- **M-05** Strings 100% hardcoded pt-BR — extrair para `src/i18n/pt-BR.ts`

### ⚪ LOW

- **L-01** Safari iOS pode anunciar input verbosamente (label sr-only + aria-describedby + placeholder)
- **L-02** `Buscar.tsx:62` mistura `.container` (layout) + `.buscar-page` (cosmética)
- **L-03** `RateLimitedState.tsx:30` reseta state em todo render quando prop não mudou
- **L-04** `SearchInput.tsx:50` `action="/buscar" method="get"` — RR7 intercepta, fallback no-JS OK

---

## §4. Cobertura de testes

| Área                   | Tests        | Gaps                                                |
| ---------------------- | ------------ | --------------------------------------------------- |
| `useDebouncedValue`    | 5            | Property-based (Sprint 5)                           |
| `useSearch`            | 6            | **AbortSignal cancelamento**                        |
| `useSearchParamsState` | **0**        | **GAP IMPORTANTE** — 5 testes ~50 LoC               |
| `SearchInput`          | 7            | userEvent keyboard Enter                            |
| `HighlightedText`      | 6            | Race H-03                                           |
| `ResultCard`           | 7            | —                                                   |
| `FilterChips`          | 5            | H-01 (input inválido)                               |
| `SearchStates`         | 8            | aria-live (jsdom não simula SR)                     |
| `SearchResults` (mock) | 8            | Loading+paginação simultâneo                        |
| `Buscar` integração    | 6            | E2E Playwright (Sprint 5)                           |
| **MSW**                | 0            | BLOQUEIO-1                                          |
| **axe-core**           | 0            | BLOQUEIO-2                                          |
| **TOTAL**              | 64 / 9 files | Coverage real não medida — rodar `npm run test:cov` |

---

## §5. Estado dos 5 estados (CA01)

| Estado            | Componente                                      | Trigger                                  | aria                               | OK  |
| ----------------- | ----------------------------------------------- | ---------------------------------------- | ---------------------------------- | --- |
| Empty inicial     | `EmptyState`                                    | `!isEnabled` (q<2)                       | `role="status"`                    | ✅  |
| Loading           | `ResultsSkeleton`                               | `isLoading \|\| (isFetching && !data)`   | `role="status" aria-label`         | ✅  |
| NoResults         | `EmptyResults`                                  | `total === 0 && allResults.length === 0` | `role="status" aria-live="polite"` | ✅  |
| Results           | header + `<ul>` + ResultCards + "Carregar mais" | `total > 0`                              | header `aria-live="polite"`        | ✅  |
| RateLimited (429) | `RateLimitedState` countdown                    | `isError && status === 429`              | `role="status"`                    | ✅  |
| Erro genérico     | throw → `SearchErrorFallback`                   | `isError && status !== 429`              | fallback `role="alert"`            | ✅  |

Ordem de prioridade em `SearchResults.tsx:44-91` correta (Empty → RateLimited → Error → Loading → NoResults → Results). Sem flicker.

---

## §6. Open questions descobertas

1. **MSW foi descopado deliberadamente ou esquecido?** Se descopado, remover `msw` de devDeps + atualizar BACKLOG.
2. **axe-core em CI**: `vitest-axe` (testes) ou `@axe-core/react` (dev runtime)? Ambos?
3. **CORS dev**: backend tem CORS para `:5173`?
4. **`refetchOnWindowFocus: false` global** afeta Articles/Comments — confirmar sem regressão.
5. **`fetchpriority` em img**: comentário em `ResultCard.tsx:58-61` diz "axe reclama" — qual versão?
6. **Mobile `<dialog>` filter overlay** Sprint 5: confirmar sem código órfão.
7. **`category` numérica vs slug**: payload retorna ambos; FilterChips usa o número — vale usar slug na URL desde já?

---

## §7. Tasks novas para BACKLOG

| ID            | Prioridade     | Descrição                                                            | Esforço |
| ------------- | -------------- | -------------------------------------------------------------------- | ------- |
| **T30.1.X12** | 🔴 P0          | MSW handlers (success/no_results/429) + `setupWorker` DEV            | 2h      |
| **T30.1.X13** | 🔴 P0          | `vitest-axe` em a11y test file cobrindo 5 estados                    | 1h      |
| **T30.1.X14** | 🟠 P1          | Centralizar `staleTime` em `searchService.ts`; remover duplicação    | 15 min  |
| **T30.1.X15** | 🟠 P1          | FilterChips: validar `category=int` (H-01)                           | 10 min  |
| **T30.1.X16** | 🟠 P1          | HighlightedText: cleanup `unmark()` no return (H-03)                 | 10 min  |
| **T30.1.X17** | 🟠 P1          | ResultCard: `data-variant` colorindo `.result-card__category` (H-04) | 30 min  |
| **T30.1.X18** | 🟡 P2          | Tests para `useSearchParamsState`                                    | 1h      |
| **T30.1.X19** | 🟡 P2          | Tests AbortSignal cancelando `fetchSearch`                           | 1h      |
| **T30.1.X20** | 🟡 P2 Sprint 5 | Visual regression Playwright 5 estados (ADR-042)                     | 3h      |
| **T30.1.X21** | 🟡 P2 Sprint 5 | E2E Playwright (input → results → load-more → article)               | 3h      |
| **T30.1.X22** | 🟡 P2 Sprint 5 | Property-based `useDebouncedValue` + `canonicalKey`                  | 2h      |
| **T30.1.X23** | ⚪ P3          | Avaliar custom 30-LoC highlighter vs mark.js (M-04)                  | 2h      |
| **T30.1.X24** | ⚪ P3          | i18n extract pt-BR (M-05)                                            | 1h      |

---

## §8. Recomendação ANTES do PR final

**Não abrir PR US30.1 hoje.** Caminho recomendado (1 sessão 2-3h):

1. **Decidir MSW**: implementar T30.1.X12 (2h) OU descopar removendo do `package.json`. **Recomendação**: implementar — paga em DX.
2. **Decidir axe-core**: T30.1.X13 (1h). **Recomendação**: implementar — a alegação do commit `[a11y axe-core]` precisa ser verdadeira ou o PR perde credibilidade.
3. **Aplicar H-01 a H-04** (~1h somados): patches pequenos, valor alto.
4. **Rodar `npm run test:cov`** e anexar % real ao PR.
5. Abrir PR US30.1 com body explícito sobre coberto vs Sprint 5.

Se pressão de prazo forçar descope: **NÃO** mencionar "axe-core" no body do PR; adicionar T30.1.X12-X13 no TOPO de Sprint 5 como HIGH; declarar known gap. Diretriz 5 do Gabarito.

---

## §9. Itens validados (anti-sycophancy é justa nos dois sentidos)

1. **Bug 6 fix `?? undefined` corretamente implementado E testado** (`useSearch.ts:50` + test `:54-58`).
2. **ErrorBoundary scope exemplar** (`Buscar.tsx:39-58`). Input fora, results dentro, `resetKeys=[deferredQ]` + `qc.resetQueries`.
3. **Zero combobox com test defensivo** (`Buscar.test.tsx:58-62`). Captura regressão se alguém colar MUI Autocomplete.
4. **XSS hardening do HighlightedText documentado E testado** com `<script>` e `<img onerror>`. Comentário explica POR QUE mark.js é seguro.
5. **Tokens herdados sem fork**: nenhuma redefinição em arquivos Buscar. ADR-029 honrado.
6. **`useDebouncedValue` 15 LoC, zero-dep, 5 testes incl. cleanup**. JSDoc explica POR QUE NÃO é `useDeferredValue` (Bug 4).
7. **Anti-CLS validado por test** (`ResultCard.test.tsx:39-48` confirma `width="120"` `height="80"` como atributos HTML).
8. **`fetchSearch` aceita `AbortSignal`** + TanStack forward em `useSearch.ts:78`.
9. **Bundle 14.5 KB gz dentro do gate 20 KB** com lazy split + comentário justificando.
10. **JSDoc rico em todo hook/componente** — cada arquivo explica POR QUE existe, não só O QUE faz; linka ADRs/Bugs/Tasks.

---

_Materializado em 2026-06-06._
