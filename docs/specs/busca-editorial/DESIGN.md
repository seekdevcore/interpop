# Design — Busca editorial full-text com filtros (v3)

**Orchestrator**: main-loop atuando como orchestrator (Claude Code não suporta nested subagent delegation; em sessão fresca o registry tem os 11 agents, então o fan-out via `Agent` tool funciona quando disparado do main loop).

**Modo de execução desta versão**: **REAL — 4 specialists invocados via `Agent` tool em paralelo (database / algorithms / frontend / ui-ux); + 2 specialists já invocados na v2 preservados (software / backend)**.

**Data**: 2026-06-02
**Versão**: v3 (integrada com refino dos 6 specialists)
**Backups preservados**:

- [`DESIGN-v1-degraded-mode.md`](./DESIGN-v1-degraded-mode.md) — v1, orchestrator como nested subagent, modo degradado
- [`DESIGN-v2-hybrid.md`](./DESIGN-v2-hybrid.md) — v2, 2 specialists reais + 4 layers main-loop
- [`_specialist-outputs/`](./_specialist-outputs/) — outputs literais dos 4 specialists invocados nesta v3 (database, algorithms, frontend, ui-ux)

---

## 🔴 Achados críticos descobertos no refino v3 (resumo executivo)

Os specialists **contestaram com sucesso** decisões dos main-loops anteriores. **10 bugs reais** foram detectados — boa parte teria quebrado o código em produção. Lista completa:

| #   | Bug                                                                                      | Detector                                 | Severidade                   | Status      |
| --- | ---------------------------------------------------------------------------------------- | ---------------------------------------- | ---------------------------- | ----------- |
| 1   | `author_id BIGINT` errado na DDL (User.id é UUID)                                        | `database-architect`                     | 🔴 Migration crash           | Fix em §2.2 |
| 2   | `articles_search_config` viola `IMMUTABLE` (unaccent é STABLE)                           | `database-architect`                     | 🔴 GIN não indexa            | Fix em §2.2 |
| 3   | Signal `post_save` deixa "fantasmas" (status revertido, bulk update)                     | `database-architect`                     | 🟠 Inconsistência silenciosa | Fix em §2.2 |
| 4   | `useDeferredValue` NÃO é debounce 250ms (não tem delay configurável)                     | `frontend-architect`                     | 🟠 UX + rate-limit           | Fix em §2.5 |
| 5   | `role="combobox"` sem listbox é antipattern APG                                          | `ui-ux-architect` + `frontend-architect` | 🟠 a11y APG                  | Fix em §2.6 |
| 6   | `getNextPageParam: last.next_cursor` (sem `?? undefined`) → fetch infinito quando `null` | `frontend-architect`                     | 🔴 Loop infinito             | Fix em §2.5 |
| 7   | Paleta `#1e3a5f` ardósia ignora brand vigente `#19144c` navy                             | `ui-ux-architect`                        | 🟠 Inconsistência marca      | Fix em §2.6 |
| 8   | Half-life 21d é agressivo demais para editorial; correto é ~60d                          | `algorithms-architect`                   | 🟠 Ranking ruim              | Fix em §2.3 |
| 9   | Cursor float64 sem `ROUND(score, 6)` causa drift e pula linhas                           | `algorithms-architect`                   | 🔴 Paginação quebrada        | Fix em §2.3 |
| 10  | Sem `LIMIT 500` em CTE candidates: Zipf-head sem filtro estoura 300ms p95                | `algorithms-architect`                   | 🔴 NFR violado               | Fix em §2.3 |

Estes achados justificam **20 ADRs** (15 originais + 5 novos: ADR-021b, 030, 031, 032, 033, 034) detalhados em §4.

---

## 0. Problem statement

Busca editorial full-text no Interpop: leitor anônimo (ou autenticado) busca artigos por texto livre + filtros (autor, editoria, intervalo de datas), com resultados ranqueados por relevância, search-as-you-type debounced, URL deep-linkable, WCAG 2.2 AA, dark mode, LGPD-compliant.

NFRs alvo: p95 ≤ 300ms (50k artigos); LCP ≤ 2.5s p75; rate limit 30 req/min anônimo; log com retenção ≤ 7 dias; WCAG 2.2 AA.

## 1. Decomposition map

| Layer      | Status v3               | Specialist                             | Output                                                                              |
| ---------- | ----------------------- | -------------------------------------- | ----------------------------------------------------------------------------------- |
| Software   | ✅ Real (preservado v2) | `software-architect`                   | §2.1                                                                                |
| Database   | ✅ Real **NOVA**        | `database-architect`                   | §2.2 + [`_specialist-outputs/01`](./_specialist-outputs/01-database-architect.md)   |
| Algorithms | ✅ Real **NOVA**        | `algorithms-data-structures-architect` | §2.3 + [`_specialist-outputs/02`](./_specialist-outputs/02-algorithms-architect.md) |
| Backend    | ✅ Real (preservado v2) | `backend-architect`                    | §2.4                                                                                |
| Frontend   | ✅ Real **NOVA**        | `frontend-architect`                   | §2.5 + [`_specialist-outputs/03`](./_specialist-outputs/03-frontend-architect.md)   |
| UI/UX      | ✅ Real **NOVA**        | `ui-ux-architect`                      | §2.6 + [`_specialist-outputs/04`](./_specialist-outputs/04-ui-ux-architect.md)      |

---

## 2. Layer decisions

### 2.1 Software architecture (preservado v2 — `software-architect`)

**Decisão central**: criar `apps.search` (não estender `apps.articles`) — CQRS leve read-only + Service Layer puro (sem Repository abstrato) + SearchIndex como read-projection. Newsletter é o 2º cliente que confirma busca como capability transversal.

**Boundaries** (regra dura):

- `search → articles`: import `Article`, `Category` (read-only)
- `articles → search`: **NADA** (acyclic)
- `newsletter → search`: consome `SearchService.query()` (não duplica queryset)

**ADRs**: 015, 016, 017.

Detalhamento completo em [DESIGN-v2-hybrid.md §2.1](./DESIGN-v2-hybrid.md).

### 2.2 Database architecture (refinada — `database-architect`)

**Veredito do specialist**: §2.2 da v2 estava direcionalmente correto, mas com **5 bugs concretos** e 8 gaps. Substituição completa abaixo.

#### Bugs corrigidos (DIFF vs v2)

```diff
-- ❌ v2: tipos errados
-author_id BIGINT NOT NULL REFERENCES auth_user(id),
-category_id BIGINT REFERENCES categories(id),
++ v3: tipos corretos (User.id é UUID, FK consistente com Django)
+author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
+category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,

-- ❌ v2: viola IMMUTABLE
-CREATE OR REPLACE FUNCTION articles_search_config(text)
-RETURNS tsvector AS $$
-    SELECT to_tsvector('portuguese', unaccent($1));
-$$ LANGUAGE SQL IMMUTABLE;
++ v3: config dedicada `pt_unaccent` no pipeline FTS
+CREATE TEXT SEARCH CONFIGURATION public.pt_unaccent (COPY = pg_catalog.portuguese);
+ALTER TEXT SEARCH CONFIGURATION public.pt_unaccent
+  ALTER MAPPING FOR hword, hword_part, word
+  WITH unaccent, portuguese_stem;
+CREATE OR REPLACE FUNCTION public.articles_search_config(text)
+RETURNS tsvector AS $$
+  SELECT to_tsvector('public.pt_unaccent'::regconfig, $1)
+$$ LANGUAGE SQL IMMUTABLE PARALLEL SAFE;
```

#### Decisão refinada — Trigger SQL + Signal (não OR)

**v2** propunha signal `post_save` Django como fonte única. **v3** corrige: trigger Postgres = **fonte de verdade da consistência**; signal Python = **apenas cache invalidation** (Redis `delete_pattern`).

Trigger SQL completo (em migration `0003_search_triggers`):

```sql
CREATE FUNCTION trg_articles_sync_search() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'published' AND NEW.published_at IS NOT NULL THEN
    INSERT INTO search_index (article_id, search_vector, ...)
    VALUES (NEW.id,
            setweight(articles_search_config(NEW.title),   'A') ||
            setweight(articles_search_config(NEW.excerpt), 'B') ||
            setweight(articles_search_config(NEW.body),    'C'),
            ...)
    ON CONFLICT (article_id) DO UPDATE SET ...;
  ELSE
    DELETE FROM search_index WHERE article_id = NEW.id;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER articles_sync_search
AFTER INSERT OR UPDATE OF status, published_at, title, excerpt, body,
                          author_id, category_id ON articles
FOR EACH ROW EXECUTE FUNCTION trg_articles_sync_search();

CREATE TRIGGER articles_remove_search AFTER DELETE ON articles ...;
```

Justificativa: trigger garante consistência sob bulk update, raw SQL, fixture loaddata, restore parcial. Signal sozinho falha nesses casos (4 cenários reais documentados pelo specialist).

#### Indexes refinados (partial; reduz write amplification)

```sql
CREATE INDEX CONCURRENTLY idx_search_vector_gin
  ON search_index USING GIN (search_vector);

CREATE INDEX CONCURRENTLY idx_search_category_published
  ON search_index (category_id, published_at DESC)
  WHERE category_id IS NOT NULL;   -- partial

CREATE INDEX CONCURRENTLY idx_search_author_pub_covering
  ON search_index (author_id, published_at DESC)
  INCLUDE (article_id);             -- covering

CREATE INDEX CONCURRENTLY idx_search_published_only
  ON search_index (published_at DESC);
```

#### Vacuum tuning (Gap E — silencioso até saturar)

```sql
ALTER INDEX idx_search_vector_gin SET (fastupdate = on, gin_pending_list_limit = '2MB');
ALTER TABLE search_index SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_cost_delay = '10ms'
);
```

#### Plano de DR — backup lean

`search_index` é **derivável** → `pg_dump --exclude-table-data=search_index` reduz backup 20%; restore reconstrói em ~10min para 500k via `reindex_search --parallel=4`. RTO 10min extra trocado por 20% menos disco/banda — aceito em KVM 1.

#### Migration plan refinado (5 fases)

1. **M001 schema**: extension + config + function + tables (instantâneo)
2. **M002 indexes**: `CREATE INDEX CONCURRENTLY` (`atomic=False` na migration)
3. **M003 triggers**: function + trigger (lock leve)
4. **M004 backfill**: `manage.py reindex_search --parallel=4`
5. **M005 cutover**: feature flag `SEARCH_FEATURE_ENABLED` → True

#### Outras decisões

- **`portuguese` + `unaccent`** via config dedicada (Bug 2 corrigido)
- **Weights A (título) / B (excerpt) / C (body)** — confirmado
- **Particionamento adiado** (gatilho: `>100GB` OR `p95>250ms` por 2 semanas; chave `published_at` por ano RANGE)
- **Multi-tenancy**: single-tenant declarado explicitamente
- **Tag**: postergar; criar `apps.taxonomy` quando analytics mostrar demanda
- **SQLite dev**: docker-compose.dev.yml + fallback `__icontains`; CI sempre Postgres

**ADRs novos/atualizados**: ADR-018 (update), ADR-019 (update), ADR-020 (ok), ADR-030, ADR-031, ADR-032, ADR-033, ADR-034.

**Open questions ao usuário** (§5).

### 2.3 Algorithms & data structures (refinada — `algorithms-data-structures-architect`)

#### Mudanças vs v2

| #   | Decisão v2                       | Status v3                         | Razão                                                                     |
| --- | -------------------------------- | --------------------------------- | ------------------------------------------------------------------------- |
| 1   | `ts_rank_cd` sobre ts_rank/BM25  | ✅ **CONFIRMA**                   | Sweet spot certo p/ pt-BR + KVM 1                                         |
| 2   | half-life ~21d (`exp(-days/30)`) | ⚠️ **CONTESTA** → **60d** (`/90`) | Editorial ≠ news cycle (Substack/NYT 3-6 meses)                           |
| 3   | tie-breaker                      | ✅ CONFIRMA                       | Determinístico com UUID v4                                                |
| 4   | cursor tuple `(rank, pub, id)`   | ⚠️ **APROFUNDA**                  | Adicionar `ROUND(score, 6)` p/ estabilidade float                         |
| 5   | HMAC base64                      | ✅ CONFIRMA                       | + rotação invalida cursores                                               |
| 6   | page 20/50                       | ✅ CONFIRMA                       | + cap depth 50 (Bug A3)                                                   |
| 7   | client-side mark.js              | ⚠️ **APROFUNDA**                  | Server envia `query_terms_expanded` (stems) p/ highlight correto pt-BR    |
| —   | (não tratado v2)                 | **NOVO**                          | CTE candidate-narrowing `LIMIT 500` — defesa Zipf-head                    |
| —   | (não tratado v2)                 | **NOVO**                          | `statement_timeout=500ms`, `gin_fuzzy_search_limit=5000`, `work_mem≥64MB` |
| —   | (não tratado v2)                 | **NOVO**                          | Cap 8 tokens, depth 50 páginas, empty-tsquery early-exit                  |

#### Constants check real (Postgres 16)

Specialist alerta: para queries Zipf-head sem filtro em 500k artigos, **p95 realista é 400-700ms sem otimização**. Mitigações exigidas:

| Mit                                           | Ganho                                 | Custo           |
| --------------------------------------------- | ------------------------------------- | --------------- |
| M1: `LIMIT 500` em CTE candidates             | corta 15k → 500 heap fetches          | reescrita SQL   |
| M2: índice parcial `WHERE status='published'` | 30-40% menos candidatos               | +1 CREATE INDEX |
| M3: `work_mem ≥ 64MB`                         | bitmap não vira lossy                 | config server   |
| M4: `statement_timeout='500ms'` no role       | mata patológica antes do timeout HTTP | config          |
| M5: Redis hit ≥70% no top-100 Zipf            | tira head do DB                       | já no §2.4      |

#### Pseudocode SQL completo (substitui fragmento v2)

```sql
WITH q AS (
    SELECT plainto_tsquery('portuguese', :q_norm) AS query
),
candidates AS (   -- M1: candidate narrowing
    SELECT si.article_id, si.search_vector, si.published_at,
           si.author_id, si.category_id,
           ts_rank_cd(si.search_vector, q.query, 32) AS rank_raw
    FROM search_index si, q
    WHERE
        si.search_vector @@ q.query
        AND q.query IS DISTINCT FROM ''::tsquery   -- guard empty
        AND (:author_id::uuid    IS NULL OR si.author_id  = :author_id)
        AND (:cat_id::bigint     IS NULL OR si.category_id = :cat_id)
        AND (:de::timestamptz    IS NULL OR si.published_at >= :de)
        AND (:ate::timestamptz   IS NULL OR si.published_at <= :ate)
    ORDER BY rank_raw DESC
    LIMIT 500
),
scored AS (
    SELECT article_id, published_at,
           ROUND(
             (rank_raw * exp(-EXTRACT(EPOCH FROM (NOW() - published_at))
                              / (86400.0 * :half_life_days)))::numeric, 6
           )::float AS score
    FROM candidates
)
SELECT article_id, score, published_at
FROM scored
WHERE
    :cursor_score::float IS NULL
    OR (score, published_at, article_id)
       < (:cursor_score, :cursor_pub::timestamptz, :cursor_id::uuid)
ORDER BY score DESC, published_at DESC, article_id ASC
LIMIT :limit;
```

#### 12 invariantes obrigatórios para `code-implementer`

1. **Determinismo** (mesma input → mesma ordem)
2. **`normalize_search_text()` simétrica** (signal + service usam a mesma função; drift = bug silencioso)
3. **`plainto_tsquery` sempre** (nunca `to_tsquery`)
4. **Status filter sempre presente** no WHERE
5. **Cursor HMAC inválido → 400** (não 500, não 200)
6. **`ROUND(score, 6)` simétrico** em SELECT e cursor encode
7. **Empty tsquery early-exit** (zero hit DB)
8. **Cap 8 tokens significativos** na query
9. **Cap 50 páginas** (cursor carrega `depth`)
10. **`half_life_days` em settings** (não literal)
11. **`query_terms_expanded` na response** (stems via `ts_lexize`)
12. **`statement_timeout='500ms'`** no role de leitura

**ADRs**: ADR-021 (revisado), ADR-021b (novo), ADR-022 (revisado).

### 2.4 Backend architecture (preservado v2 — `backend-architect`)

**Endpoint**: `GET /api/v1/search/articles/` (não `/articles/search/` — search é recurso próprio). DRF Serializer + DRF throttling (não django-ratelimit). Cache HTTP (`Cache-Control: public, max-age=60, stale-while-revalidate=300`) + Redis backend (key SHA256 do canonical query). Observabilidade via structlog + Prometheus.

**Refinamento desta v3** (decorrente do algorithms):

- Response shape adicionar `query_terms_expanded: string[]` (stems pt-BR via `SELECT ts_lexize('portuguese_stem', token)`)
- Serializer truncar `q` para ≤8 tokens significativos após strip stopwords
- Feature flag `SEARCH_FEATURE_ENABLED` no `SearchView` (adicionar TX-13 ao BACKLOG)

**ADRs**: 023, 024, 025.

Detalhamento completo em [DESIGN-v2-hybrid.md §2.4](./DESIGN-v2-hybrid.md).

### 2.5 Frontend architecture (refinada — `frontend-architect`)

#### Stack confirmada via leitura real

React 19.2 + TS 6 + Vite 8 + React Router 7.15 + react-error-boundary 6.1 + Vitest 4 + Testing Library 16. **Sem TanStack, sem mark.js ainda** → instalar: `npm add @tanstack/react-query mark.js @types/mark.js msw @axe-core/react -D`.

#### 6 pontos contestados ao main loop (v2)

| #   | Contesto                                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `useDeferredValue` NÃO é debounce 250ms — precisa `useDebouncedValue` próprio (15 LoC, zero dep)                                                                                   |
| 2   | `role="combobox"` sem dropdown é antipattern APG — trocar por `<input type="search">` puro                                                                                         |
| 3   | ErrorBoundary envolvendo `<Buscar>` é redundante (AppRouter já tem global). Mover para sub-tree `<SearchResults>` — padrão **resilient sub-tree** (input continua se fetch quebra) |
| 4   | `getNextPageParam: last.next_cursor` → fetch infinito quando `null`. Coercer: `?? undefined`                                                                                       |
| 5   | "CSR shell pré-renderizado dá boa LCP" — não automático. Medir Lighthouse baseline antes                                                                                           |
| 6   | `aria-live` único polite — separar em polite (contagem) + assertive (erro) em duas regiões                                                                                         |

#### Stack final de state

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

// useSearch: combo final
const debouncedQ = useDebouncedValue(inputQ, 250);   // reduz REQUESTS
const deferredQ = useDeferredValue(debouncedQ);      // mantém INPUT fluido durante render
const { data, fetchNextPage, hasNextPage, isLoading } = useInfiniteQuery({
  queryKey: ['search', 'articles', canonicalKey({...})],
  queryFn: ({ pageParam, signal }) => fetchSearch({ ..., cursor: pageParam }, signal),
  initialPageParam: undefined,
  getNextPageParam: (last) => last.next_cursor ?? undefined,  // fix bug latente
  staleTime: 60_000,
  gcTime: 5 * 60_000,
  retry: (count, err) => {
    const status = (err as AxiosError).response?.status ?? 0;
    if (status >= 400 && status < 500) return false;
    return count < 1;
  },
  enabled: deferredQ.length >= 2,
});
```

#### Estrutura de pastas concreta

```
src/pages/Buscar/
├── index.ts                Buscar.tsx · Buscar.css
├── components/             SearchInput · FilterChips · FilterPanel ·
│                           SearchResults · ResultCard · ResultHighlight ·
│                           BuscarSkeleton · ResultsSkeleton · EmptyState ·
│                           EmptyResults · ErrorState · RateLimitedState
├── hooks/                  useSearch · useDebouncedValue · useSearchParamsState · useHighlight
├── services/               searchService.ts
├── types.ts                (zod schema → infer TS)
└── __tests__/              Buscar · SearchInput · useSearch · a11y
```

Adicionar `QueryClientProvider` em `src/main.tsx`.

#### Lighthouse CI gate (nova)

`/buscar?q=kpop` em CI: assert LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1, bundle delta ≤ 20KB gz. Falha **bloqueia merge**.

**ADRs**: ADR-026 (revisado), ADR-027 (ampliado), ADR-028 (revisado), ADR-030 (novo — resilient sub-tree), ADR-031 (novo — Lighthouse CI gate).

### 2.6 UI/UX design (refinada — `ui-ux-architect`)

#### 2 decisões batalhadas

**Combobox SEM autocomplete: CONFIRMA** com ressalva: `role="combobox"` + `aria-expanded="false"` fixo viola APG (combobox exige listbox). Trocar para `<input type="search">` puro dentro de `<form role="search">`. NYT/Substack/Atlantic/Vogue/ZEIT — nenhum usa dropdown. Padrão "input + lista" venceu em leitura longa.

**Paleta + tipografia: CONTESTA com força.** §2.6 v2 propunha `#1e3a5f` ardósia + Lora — **ignora brand vigente** (`--clr-primary: #19144c` navy + `--font-serif: Newsreader Variable` + `--clr-accent: #f8b046` amarelo signature). Fork = 2 brand languages = dívida silenciosa. **Reuso > novidade**.

#### Tokens finais (light + dark, WCAG AA validados)

```css
:root {
  --clr-highlight-bg: #ffe9b5; /* derivado de --clr-accent */
  --clr-highlight-on: #19144c; /* navy */
  --clr-highlight-ring: #f8b046; /* signature amarelo, borda 1px */

  --clr-chip-bg: var(--clr-primary-50);
  --clr-chip-on: var(--clr-primary);

  --clr-skeleton: #ecedf0;
}

html.dark {
  --clr-bg: #0f0f1a; /* slate-base navy (não preto puro) */
  --clr-surface: #15152a;
  --clr-text: #ecedf3;

  --clr-highlight-bg: #6b5b1f;
  --clr-highlight-on: #fff3a6;
  --clr-highlight-ring: #f8b046;
}
```

Contraste auditado: light 9.4:1 AAA · dark 6.8:1 AAA.

#### Pattern crítico — Card com thumb-LEFT 120×80 (não full-bleed)

Densidade NYT/Folha/Substack: 8-10 cards/viewport (vs 5 com full-bleed top). Busca é **varredura**, não navegação visual.

#### Filter chips: cantos suaves (radius-md), com count interno

`border-radius: 9999px` (full-rounded) = tag estática. Filtros são **actions** → radius-md (`0.625rem`) comunica "clicável, tem estado". Mobbin Notion + Linear: filtros com radius médio, full-rounded só em tags.

#### Mobile: `<dialog>` HTML + dvh

Bug clássico iOS: `position: fixed; bottom: 0` sobe com teclado. Solução: `<dialog>` HTML nativo (`showModal()`); `max-height: 75dvh`; `padding-bottom: max(env(safe-area-inset-bottom), 1rem)`; fechar sheet ao focar input.

**ADRs**: ADR-028 (revisado — role=search), ADR-029 (revisado — herda paleta), ADR-030 (novo UI — chips radius-md + thumb-left).

---

## 3. Cross-layer decisions (orquestrador)

### 3.1 Contrato API ↔ FE (zero drift)

- OpenAPI via `drf-spectacular` → tipos TS via `openapi-typescript` (TX-07)
- CI gate: `npm run typecheck` quebra se OpenAPI muda e tipos não regenerados
- Response shape v3 adiciona `query_terms_expanded: string[]` (stems pt-BR — algorithms §2.3)

### 3.2 Naming consistency (ubiquitous language)

- DB: `search_index`, `search_log`, `pt_unaccent`
- App Django: `apps.search`, `SearchService`, `QuerySpec`, `SearchResultPage`
- API URL: `/api/v1/search/articles/`
- Frontend: `src/pages/Buscar/`, hook `useSearch()`, componente `<SearchField>`, route `/buscar`
- Convenção: contrato em inglês, UX em pt-BR

### 3.3 Perf budget split (orçamento 500ms p95 percebido)

- 100ms rede (3G/4G médio)
- 200ms backend efetivo (algorithms refinou de 300ms → 200ms após mitigações M1-M5)
- 100ms frontend render + paint
- 100ms buffer

### 3.4 Security trade-offs (handoff `cyber-security-architect`)

- Cursor HMAC signing (chave em env; rotação semestral; rotação invalida cursores ativos)
- Input sanitization tripla: serializer DRF + tsquery Postgres + React escape
- Rate limit em 2 camadas: DRF throttle + Cloudflare WAF
- LGPD: query plain nunca persistida (hash 16 chars); IP /24; user hash; TTL 7d
- CSP: mark.js NÃO usa `dangerouslySetInnerHTML` (wrapMatches com refs)
- **TODO** review pelo cyber-security-architect na sessão seguinte

### 3.5 Testability (handoff `testing-engineer`)

- Unit: `SearchService.query()` mock de SearchIndex
- Integration: pytest-django + Postgres real (testcontainers OU marker `requires_postgres`)
- Contract: OpenAPI schema validation
- E2E: Playwright (busca simples, com filtros, sem resultados, rate limited, mobile teclado virtual)
- a11y: axe-core em 5 estados (empty/loading/results/no-results/error/rate-limited)
- Perf: k6 load 100 req/s com seed Zipfiano sintético
- Mutation: stryker em `SearchService` + `useSearch` hook
- **TODO** review pelo testing-engineer na sessão seguinte

### 3.6 SQLite-dev gap (cross-layer)

- DB §2.2: docker-compose.dev.yml + fallback `__icontains`
- Backend: detectar engine no `SearchService` e bifurcar query
- Testes: marker `pytest.mark.requires_postgres` skipa cenários FTS em SQLite
- README documenta com 1 parágrafo

### 3.7 Highlighting end-to-end (decorrente de algorithms + frontend + ui-ux)

- Server envia `query_terms_expanded: string[]` (stems pt-BR) na response
- Frontend usa `query_terms_expanded` (não só `q`) em `mark.js` via refs
- Mark CSS aplica `--clr-highlight-bg` + `--clr-highlight-on` (auditados WCAG AA)
- `<mark>` semântico HTML5 → NVDA/JAWS lê com ênfase

---

## 4. ADRs a criar (20 — materializar via `documentation-engineer` + skill `create-adr`)

| ID         | Título                                                                                                        | Layer    | Status          |
| ---------- | ------------------------------------------------------------------------------------------------------------- | -------- | --------------- |
| ADR-015    | Busca como bounded context separado (`apps.search`)                                                           | Software | new             |
| ADR-016    | CQRS leve — SearchIndex como read-projection                                                                  | Software | new             |
| ADR-017    | Service Layer puro sem Repository abstrato                                                                    | Software | new             |
| ADR-018    | **Trigger SQL = fonte de verdade da consistência; signal só cache invalidation**                              | DB       | **UPDATE v3**   |
| ADR-019    | **FTS pt-BR via `CONFIGURATION pt_unaccent` (preserva IMMUTABLE)**                                            | DB       | **UPDATE v3**   |
| ADR-020    | SQLite dev = `__icontains` fallback documentado                                                               | DB       | new             |
| ADR-021    | **`ts_rank_cd` + recency boost half-life 60d + CTE LIMIT 500 + `query_terms_expanded`**                       | Algo     | **UPDATE v3**   |
| ADR-021b   | **Mitigações de pior caso GIN (`gin_fuzzy_search_limit`, `statement_timeout`, cap 8 tokens, cap 50 páginas)** | Algo     | **NEW v3**      |
| ADR-022    | **Highlight client-side com `query_terms_expanded` do server**                                                | Algo     | **UPDATE v3**   |
| ADR-023    | Endpoint `/api/v1/search/articles/` (não `/articles/search/`)                                                 | BE       | new             |
| ADR-024    | DRF throttling sobre django-ratelimit                                                                         | BE       | new             |
| ADR-025    | `total_estimate` via EXPLAIN, não COUNT(\*) — com floor por `len(results)`                                    | BE       | new             |
| ADR-026    | CSR no MVP; medir LCP baseline antes; SSR re-avaliado em v2                                                   | FE       | new             |
| ADR-027    | **TanStack Query + `useDebouncedValue` 250ms + `useDeferredValue` (não substitui debounce) + URL SSOT**       | FE       | **AMPLIADO v3** |
| ADR-028    | **`<input type="search">` semântico — `role="combobox"` rejeitado (APG)**                                     | UI       | **REVISADO v3** |
| ADR-029    | **Busca herda paleta editorial Interpop (navy `#19144c` + Newsreader + Inter); rejeita fork ardósia**         | UI       | **REVISADO v3** |
| ADR-030    | DB: composite indexes parciais (`WHERE NOT NULL`) + covering INCLUDE                                          | DB       | **NEW v3**      |
| ADR-030-fe | FE: Resilient sub-tree ErrorBoundary local em `<SearchResults>`                                               | FE       | **NEW v3**      |
| ADR-030-ui | UI: Filter chips radius-md (não pill); cards thumb-left 120×80                                                | UI       | **NEW v3**      |
| ADR-031    | Particionamento adiado; gatilho `>100GB OR p95>250ms`                                                         | DB       | **NEW v3**      |
| ADR-031-fe | FE: Lighthouse CI gate em `/buscar?q=kpop` bloqueia PR                                                        | FE       | **NEW v3**      |
| ADR-032    | Backup lean: exclude search_index + reindex pós-restore                                                       | DB       | **NEW v3**      |
| ADR-033    | Multi-tenancy: single-tenant declarado                                                                        | DB       | **NEW v3**      |
| ADR-034    | Vacuum tuning GIN fastupdate + scale_factor 0.05                                                              | DB       | **NEW v3**      |

Note: IDs ADR-030, ADR-031 ocorrem em layers diferentes — documentation-engineer pode renumerar para evitar colisão (ex.: ADR-030-DB, ADR-030-FE, ADR-030-UI).

---

## 5. Open questions (escalar ao usuário ANTES de implementar)

1. **`extension unaccent` na Hostinger KVM 1**: exige superuser. Confirmar provisionamento ou criar manualmente antes do `manage.py migrate`.
2. **Endpoint suporta `q=""`?** Se não (CA01 exige ≥2), composites `(author_id, ...)` e `(category_id, ...)` viram redundantes — eliminar para reduzir write amplification.
3. **Trigger SQL conflita com fixture factories**: factory_boy criando Article → trigger dispara → search_index populado mesmo em testes que não querem. Aceitar como feature; tests específicos usam `SET session_replication_role = 'replica'`.
4. **Redis em prod**: provisionado? Se não → `LocMemCache` por worker (hit ratio cai).
5. **Cloudflare honra `Vary: Authorization`?** Se não, desligar HTTP cache para autenticados.
6. **KVM 1 RAM**: índice GIN ~3-5GB para 500k. Se RAM <4GB, shared_buffers sofre.
7. **Tags**: criar `apps.taxonomy` ou postergar? Decisão `database-architect` + `software-architect` é postergar; confirmar.
8. **Newsletter refactor**: aproveitar implementação para refatorar newsletter consumindo `SearchService.query()` agora ou aceitar dívida?
9. **Audit de busca**: queries em `apps.audit` ou isoladas em `search_log`?
10. **Status no índice**: indexar só `status=published` (recomendado MVP) — confirmar.
11. **Sinônimos pt-BR** (`kpop` ↔ `k-pop`): normalização Python aplicada simétrica no indexing E query (algoritmos invariant 2). pgsynonym postergar.
12. **Title 22px ou 26px** no card de resultado? Recomendação 22px (compacto).
13. **Sort dropdown** ("ordenar: ▾") no MVP ou Sprint 5? Recomendação fora do MVP.
14. **Thumbnail placeholder** sem cover: SVG inline ou letra inicial editoria? Recomendação letra inicial.

---

## 6. Implementation order — handoff `code-implementer` (5 fases × 3 sprints)

### Sprint 4 — DB + Backend leitura + Frontend MVP

**Fase 1 (Sprint 4 — DB schema, 1 dia)**

- M001 schema (extension, config, function, tables) — TX-03, T30.1.4b
- M002 indexes CONCURRENTLY — T30.1.3, T30.1.X1
- M003 triggers — T30.1.5b

**Fase 2 (Sprint 4 — Backend leitura, 3 dias)**

- `SearchService.query()` com 12 invariantes — T30.1.7
- `SearchView` + `SearchQuerySerializer` (cap 8 tokens) — T30.1.8, T30.1.9
- Signal Python (só cache invalidation) — T30.1.5c
- Feature flag `SEARCH_FEATURE_ENABLED` — T30.1.X4
- Rate limit DRF + cache Redis — T30.4.1-T30.4.4
- Testes unit + integration + k6 — T30.1.11, T30.1.12

**Fase 3 (Sprint 4 — Frontend MVP, 3 dias)**

- `QueryClientProvider` + deps install
- Route `/buscar` lazy + skeleton + ErrorBoundary subtree — T30.1.13, T30.1.14
- `useDebouncedValue` (15 LoC) + `useDeferredValue` + `useSearch` — T30.1.15, T30.1.16
- `<SearchInput>` (`role="search"` + `<input type="search">`) — T30.1.15
- `<ResultCard>` thumb-left + `<HighlightedText>` — T30.1.17, T30.2.1-T30.2.3
- Estados: empty, loading skeleton, no-results, error, rate-limited — T30.3.1-T30.3.4
- Tokens M3 herdados + chips radius-md — DESIGN §2.6

### Sprint 5 — Filtros + Deep-linking

- F-31 (filtros autor/editoria/datas) — US31.1-31.4
- F-32 (URL deep-linking + share) — US32.1-32.3

### Sprint 6 — Polish + Ops

- ADRs 015-034 materializados via `documentation-engineer`
- Lighthouse CI gate em CI
- Backfill em prod (`reindex_search --parallel=4`) + cutover gradual (feature flag)
- Newsletter refactor (se decisão #8 = sim)

---

## 7. Verification gates (RF/RNF → testes concretos)

| Requisito                               | Verificação                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------ |
| RF: busca por texto ranqueada (US30.1)  | Integration: `SearchService.query(q='kpop')` retorna ordem por rank DESC                   |
| RNF: p95 ≤ 300ms server                 | k6 load 100 req/s, seed Zipfiano 50k; gate p95                                             |
| RNF: LCP ≤ 2.5s                         | Lighthouse CI sobre `/buscar?q=kpop` (após baseline atual)                                 |
| RNF: WCAG 2.2 AA                        | axe-core em 5 estados; manual screen reader (NVDA + VoiceOver)                             |
| RNF: rate limit 30/min anônimo          | Integration: 31 reqs <60s → 31º 429                                                        |
| RNF: LGPD 7d retention                  | Integration: mock NOW+8d → query antiga some                                               |
| Invariante 2 (normalização simétrica)   | Property-based: indexar "K-Pop" + buscar "kpop" → casa                                     |
| Invariante 6 (cursor estável)           | Integration: 100 inserts entre página 1 e 2 → cursor mantém continuidade                   |
| Invariante 7 (empty-tsquery early-exit) | Integration: `q="o de da"` → 200 results:[] + 0 queries Postgres (`CaptureQueriesContext`) |
| Bug 6 fix (`null` cursor)               | Unit `useSearch`: `next_cursor=null` → `hasNextPage===false`                               |

---

## 8. Spec bundle pronto para `code-implementer`

- [x] DESIGN.md (este, v3 — 6 specialists reais)
- [ ] ADRs 015-034 materializadas via `documentation-engineer` (Passo 4 próxima resposta)
- [x] OpenAPI sketch (§ 2.4 — finalização via drf-spectacular ao implementar)
- [x] Schema + migration plan (§ 2.2 — 5 fases)
- [x] Algorithm invariants (§ 2.3 — 12 invariants)
- [x] UI tokens + estados (§ 2.6)
- [x] Test plan por layer (§ 7)
- [ ] Security review pelo `cyber-security-architect` (Passo 3 próxima resposta)
- [ ] Test strategy review pelo `testing-engineer` (Passo 3 próxima resposta)
- [x] BACKLOG.md atualizado com Tasks novas (próxima ação)

---

## 9. Smoke test report v3

### ✅ Funcionou (vs v2 que falhou em 4/6)

- **6/6 specialists reais** com `Agent` tool (registry agora tem os 11 agents porque sessão é fresca)
- **314k tokens** de análise crítica entregues
- **10 bugs reais detectados** — vários teriam quebrado código em produção
- Cada specialist invocou ≥2 Skills via `Skill` tool (não citação)
- Outputs consistentes entre si sem coordenação direta (ex.: software + backend convergiram em `/api/v1/search/articles/`; algorithms + frontend convergiram em `query_terms_expanded`)

### 🎯 Lição aprendida

**Aplicação do protocolo skill_tool_invocation_rule** (adicionado aos 11 agents na sessão anterior) **funcionou na prática**:

- `database-architect` invocou `postgres-best-practices` + `database-design` + `database-migration` + `database-architect` (skill homônima)
- `algorithms-architect` invocou `data-structure-protocol` + `sql-optimization-patterns` + `postgresql-optimization` + `superpowers:brainstorming` + `engenharia-de-requisitos`
- `frontend-architect` invocou `react-best-practices` + `tanstack-query-expert` + `core-web-vitals` + `web-accessibility` + `frontend-design` + `ecossistemas-ui-ux`
- `ui-ux-architect` invocou `ecossistemas-ui-ux` + `wcag-audit-patterns` + `hig-components-search` (descartou `referencias-dashboards` por não ser dashboard — o que valida o protocolo)

### 📦 Próximos passos (próxima resposta)

- **Passo 3**: `cyber-security-architect` + `testing-engineer` review pass paralelo sobre v3
- **Passo 4**: `documentation-engineer` materializa ADRs 015-034 via skill `create-adr`
- **Passo 5**: `code-implementer` executa US30.1 (escopo Immediate, fase 1+2+3 do plano §6)
