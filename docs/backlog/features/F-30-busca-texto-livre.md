# F-30 — Busca por texto livre

> **Tipo**: Feature
> **Epic pai**: [EP-10 Busca editorial](../epics/EP-10-busca-editorial.md)
> **Sprint de execução**: [Sprint 4](../sprints/sprint-4-busca-editorial.md)
> **Status**: ✅ Done — PR #37 squash-merged em main como `2bdf73b` em 2026-06-09
> **Prioridade**: 🔴 Imediato (MVP da descoberta editorial)

---

## Descrição (visão de produto)

Leitor entra em `/buscar`, digita um termo (mínimo 2 caracteres) e vê uma lista de artigos publicados rankeados por relevância editorial e recência. Os termos buscados aparecem destacados nos títulos e resumos. Quando não há resultado, vê uma mensagem clara. Quando faz muitas buscas em pouco tempo, vê uma mensagem amigável pedindo para aguardar. A página inteira funciona sem JavaScript habilitado (fallback) e é acessível por teclado e leitor de tela.

Esta Feature é a **fundação** da descoberta editorial — Features futuras (F-31 filtros, F-32 deep-linking) constroem em cima dela.

---

## Requisitos atendidos (rastreabilidade ↑)

| ID                                                        | Requisito                                         | Relação             |
| --------------------------------------------------------- | ------------------------------------------------- | ------------------- |
| [RF-007](../../requirements/RF/RF-007-busca-editorial.md) | Busca por texto livre nos artigos publicados      | Realiza diretamente |
| [RNF-perf](../../requirements/RNF/RNF-perf.md)            | p95 ≤ 300ms server · LCP/INP/CLS dentro dos gates | Realiza CA02        |
| [RNF-security](../../requirements/RNF/RNF-security.md)    | Throttle, HMAC cursor, XSS escape                 | Realiza CA10/CA13   |
| [RNF-a11y](../../requirements/RNF/RNF-a11y.md)            | WCAG 2.2 AA em todos os estados                   | Realiza CA08        |
| [RNF-lgpd](../../requirements/RNF/RNF-lgpd.md)            | search_log 7d com pseudonimização                 | Realiza CA14        |

---

## Critérios de Aceitação (CAs)

| ID       | Critério                                                                                         | Como verificar                             | Status                             |
| -------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------ | ---------------------------------- |
| **CA01** | Termo válido tem 2-200 caracteres; abaixo de 2 não dispara request HTTP                          | Test integração `useSearch enabled rule`   | ✅                                 |
| **CA02** | Resultados aparecem em ≤ 300ms p95 server em 50k artigos com cache miss                          | k6 load test Zipfiano (T30.1.X22 Sprint 5) | 🟡 medido manualmente até Sprint 5 |
| **CA03** | Termos buscados aparecem destacados em título e resumo dos cards                                 | Test `HighlightedText` + integração        | ✅                                 |
| **CA04** | Sem resultados mostra "Nada encontrado para 'X'" com sugestão                                    | Test `EmptyResults`                        | ✅                                 |
| **CA05** | Erro de rede mostra "Não foi possível buscar agora" + botão "Tentar novamente" que reativa busca | Test `SearchErrorFallback` + ErrorBoundary | ✅                                 |
| **CA06** | Rate limit (429) mostra "Muitas buscas em pouco tempo. Aguarde Xs" com countdown                 | Test `RateLimitedState`                    | ✅                                 |
| **CA07** | Input fica responsivo enquanto resultados carregam (deferred render)                             | Test useDeferredValue + manual smoke       | ✅                                 |
| **CA08** | Página passa axe-core nos 5 estados em light + dark + mobile + desktop                           | Test `a11y.test.tsx` (12 cenários)         | ✅                                 |
| **CA09** | URL contém o termo (`/buscar?q=X`) — back button retorna estado anterior                         | Test `useSearchParamsState`                | ✅                                 |
| **CA10** | Termos XSS (`<script>`, `<img onerror>`) são escapados; não viram DOM ativo                      | Test `HighlightedText XSS`                 | ✅                                 |
| **CA11** | Bundle adicional pela rota `/buscar` ≤ +20 KB gz vs baseline                                     | Lighthouse CI (TX-16)                      | 🟡 manual hoje (14.54 KB gz)       |
| **CA12** | Feature flag desligada retorna 503 + `Retry-After: 60`                                           | Test integration backend                   | ✅                                 |
| **CA13** | Cursor inválido (manipulação manual) retorna 400, nunca 500                                      | Test `cursors.py` 6 cenários tamper        | ✅                                 |
| **CA14** | search_log mantém retention de 7 dias; query plain nunca persistida                              | Test sigchain + cron task                  | 🟡 cron pendente Sprint 5          |
| **CA15** | Cache anônimo NUNCA serve resposta de usuário autenticado (ou vice-versa)                        | Test `cache.py` + cross-tier isolation     | ✅                                 |

---

## User Stories

### US30.1 — Leitor faz busca rápida por termo livre

> **Como** leitor (anônimo ou autenticado)
> **Quero** digitar um termo na busca e ver artigos relacionados
> **Para** descobrir conteúdo editorial sem navegar por menus.

- **Prioridade**: 🔴 Imediato
- **Estimativa**: 8 Story Points
- **Sprint**: 4
- **Status**: ✅ Done
- **CAs cobertos**: CA01 a CA15
- **Persona**: [leitor anônimo + leitor autenticado](../../requirements/personas-e-cenarios.md)

#### Cenários BDD (Gherkin pt-BR)

```gherkin
Funcionalidade: Busca de artigos por termo livre
  Como leitor do Interpop
  Quero buscar artigos por termo
  Para encontrar conteúdo editorial rapidamente

Cenário: Termo válido retorna lista ranqueada (caminho feliz)
  Dado que estou na página "/buscar"
  Quando digito "kpop" no campo de busca
  E aguardo 250ms (debounce do useDebouncedValue)
  Então vejo até 10 cards de artigos em até 300ms
  E o título de cada card destaca a palavra "kpop"
  E a contagem total aparece como "142 resultados" no cabeçalho
  E o aria-live="polite" do contador é anunciado por leitores de tela

Cenário: Termo curto não dispara request
  Dado que estou na página "/buscar"
  Quando digito "k"
  Então não vejo cards de resultado
  E vejo o texto "Digite ao menos 2 caracteres para buscar artigos"
  E nenhuma chamada HTTP foi feita ao endpoint /api/v1/search/articles/

Cenário: Nada encontrado
  Dado que estou na página "/buscar"
  Quando digito "qzxzqzx"
  Então vejo o texto "Nada encontrado para 'qzxzqzx'"
  E vejo a sugestão "Tente termos mais gerais"
  E o estado é anunciado via aria-live="polite"

Cenário: Limite de requisições atingido (429)
  Dado que estou na página "/buscar"
  E que fiz 30 buscas no último minuto como anônimo
  Quando faço a 31ª busca
  Então vejo o texto "Muitas buscas em pouco tempo. Aguarde Xs"
  E vejo um countdown decrescente partindo do valor do header Retry-After
  E o botão "Tentar agora" fica desabilitado até o countdown chegar a 0

Cenário: Erro genérico (5xx ou rede)
  Dado que estou na página "/buscar"
  E que o backend está indisponível
  Quando digito "cinema"
  Então vejo "Não foi possível buscar agora"
  E vejo o botão "Tentar novamente"
  Quando clico em "Tentar novamente"
  Então o sistema refaz a busca
  E meu input "cinema" permanece preenchido

Cenário: URL refletir estado da busca (deep-link parcial)
  Dado que estou em "/buscar?q=moda"
  Então o campo de busca está pré-populado com "moda"
  E os resultados de "moda" são carregados automaticamente

Cenário: Termos com acento e plurais casam com radicais (stemming pt-BR)
  Dado que estou na página "/buscar"
  Quando digito "cantores"
  Então vejo cards cujo título contém "cantor", "cantora", "cantores"
  E todas as variantes aparecem destacadas no resultado

Cenário: Payload XSS é tratado como texto puro
  Dado que estou na página "/buscar"
  Quando digito "<script>alert(1)</script>"
  Então o navegador não executa o script
  E o termo aparece escapado no campo (sem virar HTML)
```

---

## Tasks (implementação)

### Tasks US-bound (T30.1.X — todas ✅ Done)

| ID        | Descrição                                                                          | Prioridade | Commit                | Sprint |
| --------- | ---------------------------------------------------------------------------------- | ---------- | --------------------- | ------ |
| T30.1.1   | Criar Django app `apps.search` + estrutura de pastas                               | 🔴         | `c017e1f`             | 4      |
| T30.1.2   | Models `SearchIndex`/`SearchLog` com `managed=False`                               | 🔴         | `c017e1f`             | 4      |
| T30.1.3   | Migration 0002 — GIN + composite parciais + covering                               | 🟠         | `d43e17d`             | 4      |
| T30.1.4b  | Migration 0001 — extension unaccent + CONFIGURATION pt_unaccent + função IMMUTABLE | 🔴         | `103e5ea`             | 4      |
| T30.1.5b  | Migration 0003 — trigger SQL `articles_sync_search` (SSOT)                         | 🔴         | `df98846`             | 4      |
| T30.1.5c  | Signal Python — apenas cache invalidation (sem upsert)                             | 🟠         | `36b21e2`             | 4      |
| T30.1.5d  | Migration 0005 — `ENABLE ALWAYS` triggers (fix bypass `session_replication_role`)  | 🔴         | `ffb88f6`             | 4      |
| T30.1.7   | `SearchService.query()` com 12 invariantes algorithms                              | 🟠         | `f5b226c`             | 4      |
| T30.1.8   | `SearchArticlesView` + `SearchQuerySerializer` + URL                               | 🟠         | `e4ce5df`             | 4      |
| T30.1.X1  | Migration 0004 — vacuum tuning GIN + autovacuum                                    | 🟠         | `64c49d9`             | 4      |
| T30.1.X2  | `utils.normalize_search_text()` simétrico (signal + service)                       | 🟠         | `3c98825`             | 4      |
| T30.1.X3  | `estimate_total()` com floor por `len(results)`                                    | 🟡         | `f5b226c`             | 4      |
| T30.1.X4  | Feature flag `SEARCH_FEATURE_ENABLED` → 503 + Retry-After                          | 🟠         | `e4ce5df`             | 4      |
| T30.1.X5  | `query_terms_expanded` via `ts_lexize('portuguese_stem')`                          | 🟠         | `f5b226c`             | 4      |
| T30.1.X6  | Hook `useDebouncedValue<T>(value, delayMs)` 15 LoC zero-dep                        | 🔴         | `ce18826`             | 4      |
| T30.1.X7  | Fix Bug 6 — `getNextPageParam: ?? undefined`                                       | 🔴         | `2259605`             | 4      |
| T30.1.X8  | `<form role="search">` + `<input type="search">` (rejeita combobox APG)            | 🔴         | `816e3fb`             | 4      |
| T30.1.X9  | Resilient sub-tree `ErrorBoundary` em `<SearchResults>`                            | 🟠         | `c1caa0c` + `db4b2a2` | 4      |
| T30.1.X10 | `<HighlightedText>` com `mark.js` via refs (CSP-safe)                              | 🟡         | `871f53a`             | 4      |
| T30.1.X11 | Tokens herdados — sem fork da paleta editorial                                     | 🟠         | `74a9dc9`             | 4      |
| T30.1.X12 | MSW handlers + worker DEV-only + READMEs                                           | 🔴         | `ffa5150` + `2bdf681` | 4      |
| T30.1.X13 | `a11y.test.tsx` com vitest-axe — 12 cenários nos 5 estados + fix Skeleton landmark | 🔴         | `cbb9001`             | 4      |
| T30.1.X14 | DRY — `SEARCH_STALE_TIME`/`SEARCH_GC_TIME` em searchService.ts                     | 🟠         | `25bb5f9`             | 4      |
| T30.1.X15 | FilterChips — validação `category` Number.isFinite + Integer                       | 🟠         | `25bb5f9`             | 4      |
| T30.1.X16 | HighlightedText — cleanup `return () => unmark()` no useEffect                     | 🟠         | `25bb5f9`             | 4      |
| T30.1.X17 | ResultCard — `data-variant` + tokens editoriais `--clr-cat-*`                      | 🟠         | `d45478f`             | 4      |
| T30.1.13  | Rota lazy `/buscar` + `<Buscar>` page                                              | 🟠         | `db4b2a2`             | 4      |
| T30.1.15  | `<SearchInput>` component                                                          | 🟠         | `816e3fb`             | 4      |
| T30.1.16  | Hook `useSearch` + `useSearchParamsState`                                          | 🟠         | `2259605`             | 4      |
| T30.1.17  | `<ResultCard>` thumb-left 120×80 anti-CLS                                          | 🟠         | `871f53a`             | 4      |
| T30.3.1-4 | 5 estados (Empty/Loading/Results/NoResults/Error/RateLimited)                      | 🟠         | `db4b2a2` + `c1caa0c` | 4      |
| T30.4.1-4 | DRF throttles anon/user/global + cache Redis backend                               | 🟠         | `dc4680c`             | 4      |
| T30.4.X4  | Cache key SHA256(canonical+auth_tier)                                              | 🟠         | `0bd7e33`             | 4      |
| T30.4.B1  | F2-B-01 — `@transaction.atomic` em `_query_postgres` (Inv #12 runtime)             | 🟠         | `14649d7`             | 4      |
| T30.4.B2  | F2-B-02 — `Cache-Control: private` para autenticado                                | 🟠         | `2362305`             | 4      |
| T30.4.B3  | F2-B-03 — `SEARCH_CURSOR_HMAC_SECRET` hard-fail em prod                            | 🟠         | `96cdad5`             | 4      |

### Tasks transversais (TX-NN)

| ID    | Descrição                                                                                      | Prioridade | Commit/Status                                 | Sprint |
| ----- | ---------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------- | ------ |
| TX-13 | Runbook DR — `pg_dump --exclude-table-data` + reindex pós-restore                              | 🟡         | ⏳ Sprint 5                                   | 5      |
| TX-14 | Doc scaling triggers — `>100GB OR p95>250ms`                                                   | ⚪         | ⏳ Sprint 5                                   | 5      |
| TX-15 | Role Postgres `interpop_search_reader` (statement_timeout + work_mem + gin_fuzzy_search_limit) | 🟠         | ⏳ Sprint 5 (env-ops)                         | 5      |
| TX-16 | Lighthouse CI gate em `/buscar?q=kpop` bloqueia PR                                             | 🟠         | ⏳ Sprint 5                                   | 5      |
| TX-17 | jest-axe + axe-playwright nos 5 estados E2E                                                    | 🟠         | 🟡 axe-vitest parte (T30.1.X13); E2E Sprint 5 | 5      |
| TX-18 | Baseline Lighthouse pré-busca                                                                  | 🔴         | ✅ `284997a` (4 JSONs em docs/performance/)   | 4      |

### Tasks restantes Sprint 5 (do REVIEW-PHASE-3)

| ID        | Descrição                                                        | Prioridade |
| --------- | ---------------------------------------------------------------- | ---------- |
| T30.1.X18 | Tests para `useSearchParamsState` (NaN guard, replace vs push)   | 🟡         |
| T30.1.X19 | Test AbortSignal cancelando `fetchSearch`                        | 🟡         |
| T30.1.X20 | Visual regression Playwright `toHaveScreenshot` 5 estados        | 🟡         |
| T30.1.X21 | E2E Playwright (input → results → load-more → article)           | 🟡         |
| T30.1.X22 | Property-based (fast-check) `useDebouncedValue` + `canonicalKey` | 🟡         |
| T30.1.X23 | Avaliar custom 30-LoC highlighter vs mark.js 8 KB gz             | ⚪         |
| T30.1.X24 | i18n extract strings pt-BR para `src/i18n/`                      | ⚪         |

---

## Definition of Done — verificação

- [x] CA01–CA13, CA15 verificados por test automatizado
- [ ] CA02, CA11, CA14 verificáveis Sprint 5 (k6 + Lighthouse CI + cron retention)
- [x] US30.1 com cenários BDD rodando verde (78 tests `pages/Buscar/`)
- [x] Todas as Tasks 🔴 Imediate done com commit hash
- [x] Code-review aprovado (Phases 1/2/3 + fixes inline + F2-B-\* fixes)
- [x] Cobertura backend ≥ 85% local, frontend ≥ 80% (`pages/Buscar` 84.15%)
- [x] Documentação cruzada atualizada — RF-007 + RNF-\* citam esta Feature, EP-10 lista
- [x] Mergeada em main via PR #37 squash em `2bdf73b` (2026-06-09)

**Status final**: ✅ **Done** com 3 CAs (CA02/CA11/CA14) marcados para verificação automatizada em Sprint 5.

---

## Specs técnicas relacionadas

- [DESIGN.md v3](../../specs/busca-editorial/DESIGN.md) — arquitetura completa por camada (1090 LOC)
- [REVIEW-PHASE-1.md](../../specs/busca-editorial/REVIEW-PHASE-1.md) — DB schema review
- [REVIEW-PHASE-2.md](../../specs/busca-editorial/REVIEW-PHASE-2.md) — Backend review (F2-B-01/02/03 originaram aqui)
- [REVIEW-PHASE-3.md](../../specs/busca-editorial/REVIEW-PHASE-3.md) — Frontend review (BLOQUEIOs 1/2 + H-01..H-04)
- [SECURITY-REVIEW.md](../../specs/busca-editorial/SECURITY-REVIEW.md) — 17 achados auditados
- [TEST-STRATEGY.md](../../specs/busca-editorial/TEST-STRATEGY.md) — matriz 10 tipos + 110 testes projetados
- [35 ADRs](../../specs/busca-editorial/adrs/INDEX.md) — decisões locked-in por camada
- [4 specialist outputs literais](../../specs/busca-editorial/_specialist-outputs/) — DB/Algo/FE/UI fan-out

---

## Cross-references resumidas

| Direção                    | Onde                                                                                                                                                                                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ↑ Requisitos atendidos     | [RF-007](../../requirements/RF/RF-007-busca-editorial.md), [RNF-perf](../../requirements/RNF/RNF-perf.md), [RNF-security](../../requirements/RNF/RNF-security.md), [RNF-a11y](../../requirements/RNF/RNF-a11y.md), [RNF-lgpd](../../requirements/RNF/RNF-lgpd.md) |
| ↑ Epic pai                 | [EP-10](../epics/EP-10-busca-editorial.md)                                                                                                                                                                                                                        |
| → Sprint(s)                | [Sprint 4](../sprints/sprint-4-busca-editorial.md) (entrega), [Sprint 5](../sprints/sprint-5-filtros-deep-linking.md) (refino + Tasks restantes)                                                                                                                  |
| → Specs técnicas           | [DESIGN.md v3](../../specs/busca-editorial/DESIGN.md) + ADRs 015-045                                                                                                                                                                                              |
| → Features filhas          | n/a (F-30 é Feature, não Epic)                                                                                                                                                                                                                                    |
| ← Features irmãs sob EP-10 | [F-31 Filtros](F-31-filtros-busca.md), [F-32 Deep-linking](F-32-deep-linking-busca.md)                                                                                                                                                                            |

---

_F-30 ✅ Done — squash-merged em main como `2bdf73b` (2026-06-09). Próxima ação: arquivar para `done/` quando Sprint 4 fechar formalmente._
