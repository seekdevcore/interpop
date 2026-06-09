# Design — Busca editorial full-text com filtros

**Orchestrator**: design-orchestrator
**Specialists consulted**: software-architect, database-architect, algorithms-data-structures-architect, backend-architect, frontend-architect, ui-ux-architect
**Date**: 2026-06-02
**Status**: Draft (smoke test) — aguarda validação cyber-security-architect + testing-engineer + documentation-engineer
**Spec dir**: `/home/gabriel/Documentos/Projetos/interpop/docs/specs/busca-editorial/`

> **Aviso de execução**: este DESIGN.md foi produzido em **modo degradado** (single-orchestrator) porque o ambiente atual não expõe o tool `Task` para fan-out a subagents — ver `## Smoke test report` no final. As decisões abaixo são fruto de análise por lente (software/db/algo/backend/frontend/UI) ancorada em leitura real do repo (`CLAUDE.md`, `docs/architecture/overview.md`, `backend/apps/articles/models.py`, `src/router/AppRouter.tsx`, `ADR-002`), mas **não** passaram por challenge externo de specialists independentes. Reler antes de codar.

---

## 0. Problem statement

Leitores do Interpop precisam encontrar artigos por texto livre + combinação de filtros (autor, editoria, tag, data) com resultados rankeados, search-as-you-type, URL deep-linkable, e estados de empty/loading/error tratados. Alvos: **p95 ≤ 300ms @ 50k artigos**, **LCP ≤ 2.5s**, **WCAG 2.2 AA**, **rate limit** (30/min anônimo, 60/min auth), **LGPD** (queries com PII retidas ≤ 7d). Stack atual: Django 5 + DRF + Postgres prod / SQLite dev, React 19 SPA sem SSR.

---

## 1. Decomposition map

| Layer     | Question delegada                                                                                                            | Specialist                           | Status                        |
| --------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ----------------------------- |
| Software  | App boundary `search` vs dentro de `articles`? Pattern? Index ownership? Tag model owner?                                    | software-architect                   | Modo degradado (orchestrator) |
| Database  | Postgres FTS (tsvector+GIN) vs pg_trgm vs pgvector vs SaaS externo? Schema + índices. Estratégia SQLite-dev / Postgres-prod. | database-architect                   | Modo degradado (orchestrator) |
| Algoritmo | Ranking BM25 nativo vs `ts_rank_cd` vs custom? Highlighting? Pagination cursor vs offset? Autocomplete trie?                 | algorithms-data-structures-architect | Modo degradado (orchestrator) |
| Backend   | Endpoint REST `/api/v1/search/`? Contract OpenAPI? Cache? Rate limit? Query parser?                                          | backend-architect                    | Modo degradado (orchestrator) |
| Frontend  | Onde encaixa em React Router 7? URL state via search params? TanStack Query? Debounce?                                       | frontend-architect                   | Modo degradado (orchestrator) |
| UI/UX     | Combobox WAI-ARIA APG? Tokens M3? Empty/loading/error visuals? Dark mode?                                                    | ui-ux-architect                      | Modo degradado (orchestrator) |

---

## 2. Layer decisions

### 2.1 Software architecture

**Decisão 1 — App boundary**: criar **novo app Django `apps.search`** (não submódulo de `articles`).

Rationale via DDD strategic design: `search` é um **subdomínio genérico de suporte** com ciclo de evolução próprio (mudança de ranking, troca futura de motor para Meilisearch/Algolia, índice próprio, métricas próprias). Manter dentro de `articles` viola **single responsibility** do bounded context "publicação editorial" e cria coupling entre publicação (write-heavy) e consulta (read-heavy). O custo de criar um app Django é baixo (já há 6 apps; padrão estabelecido).

**Decisão 2 — Padrão arquitetural**: **CQRS-lite read-only** dentro de `apps.search` — uma camada `services/query.py` recebe `SearchQuery` (value object) e devolve `SearchResult` (value object). Sem repository genérico DRF padrão para essa rota; ViewSet é fino, delega tudo ao service. Justificativa: search é projeção de leitura sobre `Article`, não recurso CRUD. Tratar como recurso REST padrão polui semântica.

**Decisão 3 — Index ownership**: índice **denormalizado dentro de `Article`** via coluna `search_vector tsvector` (GIN index), **atualizado por trigger SQL no Postgres** (não signal Django). Rationale: signal Django falha em bulk_update; trigger SQL é fonte única e atômica. Em SQLite-dev cai para LIKE fallback (ver §2.2). Reindex completo via management command `rebuild_search_index` (idempotente, para hotfix). Dono do índice: `apps.search` define o trigger via migration; `apps.articles` continua dono do modelo Article. Acoplamento aceito porque é unidirecional (search depende de Article, não o inverso).

**Decisão 4 — Coupling boundaries**: `apps.search` lê `articles.Article`, `articles.Category`, `articles.Tag` (a criar), `users.User` (read-only via FK). **Nenhum outro app pode depender de `apps.search`** nesta fase. Trending searches / analytics ficam num futuro `apps.search_analytics` separado para não inflar este escopo.

**Decisão 5 — Tag model ownership**: criar `articles.Tag` (não em `search`, não app novo). Rationale: ADR-002 já posicionou tags como artefato do `apps.articles` ("`apps/articles/models.py::Tag`"). Search apenas consome. `Tag(name, slug, axis)` com `Article.tags = M2M` é o suficiente para esta fase.

**Decisão 6 — C4 L2 additions**:

- Container novo: `Search Service` (lógica Python dentro do gunicorn — não é processo separado).
- Components novos: `SearchQueryHandler`, `SearchIndexManager`, `RankingScorer`, `QueryParser`.

**ADRs recomendados** (rationale 1 frase):

- ADR-015: Postgres FTS nativo como motor de busca v1 — externalização (Algolia/Meili) só se p95 ultrapassar 300ms a 200k+ artigos.
- ADR-016: App `apps.search` separado de `apps.articles` — bounded context distinto para evoluir motor sem tocar publicação.
- ADR-017: Criação do modelo `articles.Tag` com taxonomia pré-cadastrada (executa ADR-002).
- ADR-018: SQLite-dev usa fallback LIKE/icontains sem ranking — paridade total dev↔prod é trade-off aceito (alternativa: forçar Postgres em dev, custo de DX maior).
- ADR-019: Rate limit search 30/60 rpm via `django-ratelimit` no service (não no middleware) para granularidade por endpoint.
- ADR-020: LGPD — query strings logadas hash-only após 7d via Celery beat task de redação.

**Constraints para downstream**:

- backend-architect: contract `/api/v1/search/articles/` (não `/api/v1/articles/search/` — search é recurso próprio).
- frontend-architect: estado de query vive **na URL como single source of truth**; sem store global.
- ui-ux-architect: combobox segue **WAI-ARIA APG 1.2** combobox pattern; não pode quebrar dark mode existente (ADR-011).

---

### 2.2 Database architecture

**Decisão 1 — Motor**: **Postgres FTS nativo** (tsvector + GIN), não pg_trgm puro, não pgvector, não SaaS externo nesta fase.

Comparativo:

| Opção                           | Pros                                                                                                               | Contras                                                                                   | Veredito v1                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Postgres FTS (tsvector+GIN)** | Zero infra nova; ranking BM25-ish via `ts_rank_cd`; suporta português (`portuguese` config); dentro do KVM 1 atual | Sem fuzzy nativo bom; highlighting limitado                                               | **Escolhido**                                                 |
| pg_trgm puro                    | Excelente fuzzy / typo tolerance                                                                                   | Sem stemming português; ranking ad-hoc                                                    | Adicionar **junto** ao FTS para `q.length ≤ 3` (autocomplete) |
| pgvector                        | Semântica futura (embeddings)                                                                                      | Custo de embedding por artigo + complexity; sem necessidade hoje                          | Adiar para `search_v2`                                        |
| Algolia/Meilisearch             | UX premium pronta, < 50ms                                                                                          | Custo recorrente; saída de dados (LGPD: PII em SaaS estrangeiro = DPIA); coupling externo | Adiar até p95 falhar com Postgres + 200k+ artigos             |

Decisão híbrida v1: **FTS para corpo da query; pg_trgm para autocomplete (≤3 chars).**

**Decisão 2 — Schema**:

```
-- articles.Article (alteração)
ALTER TABLE articles ADD COLUMN search_vector tsvector;
CREATE INDEX articles_search_vector_gin ON articles USING GIN (search_vector);
CREATE INDEX articles_title_trgm ON articles USING GIN (title gin_trgm_ops);

-- Trigger SQL (não signal):
CREATE TRIGGER articles_search_vector_update BEFORE INSERT OR UPDATE
ON articles FOR EACH ROW EXECUTE FUNCTION
  tsvector_update_trigger(search_vector, 'pg_catalog.portuguese',
                          title, excerpt, body);

-- Tag (novo)
CREATE TABLE tags (id UUID PK, name VARCHAR(80) UNIQUE, slug VARCHAR(80) UNIQUE,
                   axis VARCHAR(40), is_draft BOOLEAN DEFAULT false);
CREATE TABLE article_tags (article_id UUID FK, tag_id UUID FK, PRIMARY KEY(...));

-- Índices auxiliares para filtros combinados
CREATE INDEX articles_status_published_at_desc ON articles (status, published_at DESC)
  WHERE status='published';
CREATE INDEX articles_author_id_status ON articles (author_id, status);
CREATE INDEX articles_category_id_status ON articles (category_id, status);
```

**Decisão 3 — Weighting (tsvector setweight)**:

- `title` → peso `A` (1.0)
- `excerpt` → peso `B` (0.4)
- `body` → peso `C` (0.2)

Trigger customizada para isso (`tsvector_update_trigger` não aceita pesos; usar função PL/pgSQL própria).

**Decisão 4 — SQLite-dev fallback**: query manager detecta `connection.vendor`. Em sqlite, cai para `Q(title__icontains=q) | Q(excerpt__icontains=q) | Q(body__icontains=q)` **sem ranking** (ordenado por `-published_at`). DX preserva; testes E2E críticos rodam contra Postgres em CI matrix futura. Documentar essa divergência em ADR-018.

**Decisão 5 — Migrations**: 3 migrations sequenciais:

1. `articles/0NNN_add_tag_model.py` (apps.articles)
2. `search/0001_initial.py` (apps.search vazio — placeholder + ENABLE_EXTENSION pg_trgm/unaccent)
3. `search/0002_article_search_vector.py` (RunSQL conditional via `connection.vendor` check)

**Open questions**:

- Indexar comentários também? **Não nesta fase** — escopo claro de "artigos".
- `unaccent` extension habilitado? **Sim** — Postgres `portuguese` config tem stemming mas não remove acentos por padrão.

---

### 2.3 Algorithms & data structures

**Decisão 1 — Ranking primário**: **`ts_rank_cd(search_vector, query, 32)`** (normalização 32 = log-length; favorece densidade de matches).

Fórmula final composta:

```
final_score = 0.6 * ts_rank_cd(search_vector, plainto_tsquery('portuguese', q))
            + 0.2 * recency_decay(published_at)   -- exp(-Δdias/180)
            + 0.2 * log1p(view_count) / log1p(max_view)
```

- Decisão de pesos: ranqueamento editorial **não é puramente lexical** — leitura longa premia recência (artigo de 2 semanas vs 3 anos atrás) e popularidade leve. View_count tem peso baixo pra não virar "rich get richer".

**Decisão 2 — Highlighting**: `ts_headline('portuguese', excerpt, query, 'MaxFragments=2, MinWords=5, MaxWords=15, ShortWord=2')`. Trade-off: `ts_headline` é caro (~10-30% do custo da query); aplicar **só na página corrente de resultados** (10 itens), não no count total.

**Decisão 3 — Autocomplete**: `q.length ≤ 3` → ramo separado que usa `pg_trgm` similarity em `Article.title` + `Tag.name`, limit 8, sem ranking complexo. Threshold `similarity > 0.3`. Cache LRU de 60s no Redis (keyspace `search:ac:<lowercased_q>`).

**Decisão 4 — Query parser**: input livre é normalizado por `plainto_tsquery('portuguese', q)` (FTS lida com stopwords + stemming português). NÃO aceitar operadores avançados (`AND`/`OR`/`"frase exata"`) nesta v1 — UX exige curva de aprendizado que não combina com leitor editorial. Adiar para `search_v2`.

**Decisão 5 — Pagination**: **cursor-based usando `(score DESC, id ASC)`** com encoding base64url `<score>|<uuid>`. Por quê: offset pagination em FTS degrada em deep pages (Postgres re-ranqueia tudo). Cursor é estável e barato. UI mostra "Carregar mais" (não numeração). Page size = 10.

**Decisão 6 — Filtros combinados**: ordem de aplicação no SQL (importante para performance):

1. Pre-filter por `status='published'` (sempre, parcial index acelera)
2. Filter por `category_id`, `author_id`, `tags` (se vier no payload)
3. Filter por `published_at` range
4. Aplicar `@@` tsquery
5. Calcular `ts_rank_cd` + recency_decay
6. ORDER BY final_score DESC, id ASC LIMIT 11 (10 + 1 para cursor lookahead)

**Decisão 7 — Count estimado**: NÃO fazer `COUNT(*)` exato a cada request (caro). Usar `pg_class.reltuples`-based estimate via `count_estimate(query_sql)` function quando count > 1000. Mostrar "Mais de 1.000 resultados" na UI.

**Complexity targets**:

- p95 query path: ≤ 80ms backend (deixa margem pra serializer + rede até 300ms total)
- Autocomplete: ≤ 30ms p95
- Reindex 50k artigos: ≤ 60s management command (idempotente, reentrante)

---

### 2.4 Backend architecture

**Decisão 1 — Endpoint contract** (OpenAPI 3.1 stub via `drf-spectacular`):

```
GET /api/v1/search/articles/
  Query params:
    q          : string (1..200 chars, optional se houver filtro)
    autor      : UUID[] (multi via repeated key)
    editoria   : slug[]
    tag        : slug[]
    de         : ISO date (YYYY-MM-DD)
    ate        : ISO date
    cursor     : opaque string (next-page token)
    limit      : 1..20 (default 10)
  Headers:
    Accept-Language: pt-BR (default)
  200 Response:
    {
      "results": [
        {
          "id": "uuid", "slug": "...", "title": "...", "excerpt": "...",
          "highlight": "...<mark>match</mark>...",
          "author": {"id":"uuid","name":"..."},
          "category": {"slug":"musica","name":"Música"},
          "tags": [{"slug":"kpop","name":"K-pop"}],
          "published_at": "2026-...", "cover_image": "...",
          "score": 0.83
        }
      ],
      "next_cursor": "base64...|null",
      "count_estimate": 1234,
      "count_is_estimate": true,
      "took_ms": 87
    }
  4xx:
    400 INVALID_QUERY (q vazia + filtros vazios; q > 200 chars; data inválida)
    429 RATE_LIMITED + Retry-After header
    503 SEARCH_DEGRADED (motor offline → fallback shallow LIKE)
```

Separar `/api/v1/search/autocomplete/?q=...` retornando `{suggestions: [{type, text, slug}]}` (artigos + tags).

**Decisão 2 — ViewSet/View**: `SearchArticlesView(APIView)` (GET only, não ViewSet — não há CRUD). Permission: `AllowAny` (leitor anônimo busca). Throttle: classe custom `SearchThrottle` (30/min anônimo via IP, 60/min autenticado via user_id), usando `django-ratelimit` + escopo próprio.

**Decisão 3 — Cache**:

- Cache de **query+filtros idênticos** por 60s em Redis (key: SHA1 dos params normalizados); invalidação implícita por TTL (artigos publicados ao vivo aparecem em ≤ 60s — aceitável).
- **Não cachear** queries com `cursor != null` (segunda página): chance de hit é < 5%; custa memória.

**Decisão 4 — LGPD compliance** (ADR-020):

- Log de query strings em `AuditLog` (já existe no `apps.audit`) com `event_type='search'`, redação automática de PII patterns (CPF, email, telefone) via regex no middleware.
- Celery beat task `redact_old_search_logs` diária: para registros > 7d, substitui `query_raw` por SHA256 hash. Retenção total: 90d (análise de tendências agregadas sem retenção identificável).

**Decisão 5 — Observability**:

- Métrica `search.duration_ms` (histograma) por bucket `[autocomplete, fulltext, filtered_only]`.
- Log estruturado: `event='search', q_len=N, filters=[...], result_count=N, took_ms=N, cache_hit=bool, fallback=bool`.
- Sentry: erros 5xx + queries > 500ms (warning).

**Decisão 6 — Error handling & fallback**: se trigger SQL falhar ou índice corromper, view detecta via timeout `statement_timeout=400ms` e cai para fallback `Article.objects.filter(title__icontains=q).order_by('-published_at')[:10]`. Retorna 200 com header `X-Search-Mode: fallback` + flag no payload. **Nunca 500 para o leitor**.

**Decisão 7 — Schema validation**: serializers DRF: `SearchQuerySerializer` (input) + `SearchResultSerializer` (output). DRF `ValidationError` → 400 com código machine-readable (`INVALID_QUERY.<field>`).

**Estrutura de arquivos do app `apps.search/`**:

```
apps/search/
  __init__.py
  apps.py
  migrations/
  models.py            # vazio (sem models próprios v1)
  serializers.py       # SearchQuerySerializer, SearchResultSerializer
  services/
    __init__.py
    query.py           # SearchQuery, search_articles(query) -> SearchResult
    indexer.py         # rebuild_index() para mgmt command
    ranking.py         # build_ranked_queryset()
    parser.py          # normalize_query(raw)
  views.py             # SearchArticlesView, AutocompleteView
  throttles.py         # SearchThrottle
  urls.py
  management/commands/rebuild_search_index.py
  tests/               # pytest — TDD obrigatório (§6 CLAUDE.md)
```

---

### 2.5 Frontend architecture

**Decisão 1 — Routing**: nova rota `/buscar` em `src/router/AppRouter.tsx`, **code-split via lazy import** (mesma estratégia de `/admin`). Componente `Search` em `src/pages/Search/`. Justificativa: leitor casual não baixa o bundle de busca até clicar.

**Decisão 2 — URL como single source of truth**:

- `useSearchParams` do React Router 7 (não state local) para `q`, `autor`, `editoria`, `tag`, `de`, `ate`, `cursor`.
- Multi-valor (e.g. múltiplas tags) via repeated keys: `?tag=kpop&tag=hiphop`.
- Hook custom `useSearchQueryState()` que serializa/deserializa params para `SearchQuery` typesafe (zod schema). Garante deep-linkability e Back/Forward funcionais.

**Decisão 3 — Data fetching**: **adotar TanStack Query v5** (já roadmap em outros agentes — confirmar se ainda não está no projeto). Hook `useSearchArticles(query)`:

- `queryKey: ['search', serializedQuery]`
- `staleTime: 30_000`, `gcTime: 5*60_000`
- `placeholderData: keepPreviousData` (mantém resultados anteriores enquanto re-fetch — UX search-as-you-type sem flash)
- `enabled: query.q.length >= 2 || hasAnyFilter(query)`

Se TanStack Query não estiver no projeto, alternativa minimalista: hook custom `useDebouncedFetch(url, debounceMs=300)` com `AbortController`. **Recomendação**: adotar TanStack Query como ADR separada (não dentro desta feature).

**Decisão 4 — Debounce strategy**: 250ms para `q` (fast feedback, abaixo do limiar de "lento"); filtros (autor/editoria/tag/data) **sem debounce** — aplicam imediatamente porque são clicks discretos, não keystrokes.

**Decisão 5 — Performance budget**:

- Bundle adicional: ≤ 18 KB gz (componente + hook + zod schema).
- LCP `/buscar`: ≤ 2.5s (target NFR).
- INP: ≤ 200ms.
- CLS: 0 (skeleton com altura fixa idêntica ao card real).

**Decisão 6 — Estratégia de skeleton/streaming**: durante `isFetching`, renderizar 3 skeleton cards com `aria-busy="true"` no container. Não esconder resultados anteriores (`keepPreviousData`).

**Decisão 7 — TypeScript contract**: **adicionar `openapi-typescript`** ao stack (alinha F9 do Improvement-system). Gera `src/types/api.generated.ts` a partir do schema do drf-spectacular. SearchQuery/SearchResult tipados automaticamente — zero drift entre BE e FE.

**Decisão 8 — Error boundary**: rota `/buscar` herda o `ErrorBoundary` global do AppRouter (já existe). Erros de fetch não propagam — capturados pelo `onError` do TanStack Query e exibidos como toast + estado de erro inline.

---

### 2.6 UI/UX design

**Decisão 1 — Padrão de combobox**: seguir **WAI-ARIA APG 1.2 — "Combobox with Both List and Inline Autocomplete"** com `aria-controls`, `aria-activedescendant`, `aria-expanded`, `role="combobox"`. Input visível sempre; popover de sugestões abre on-focus + on-type (≥ 2 chars).

**Decisão 2 — Layout** (mobile-first, 3 breakpoints):

```
┌─ Mobile (< 768px) ────────────────────┐
│ [← Voltar]      Busca                 │
│ ┌───────────────────────────────────┐ │
│ │ 🔍 Buscar artigos…              ⓧ│ │
│ └───────────────────────────────────┘ │
│ [Filtros (3) ▾]                       │ ← bottom-sheet ao tocar
│ ─────────────────────────────────────  │
│ 12 resultados ~                        │
│ ┌──────────────────────────────────┐  │
│ │ [cover]  Título com <mark>kpop</> │  │
│ │          excerpt highlight        │  │
│ │          Música · 02/06/26        │  │
│ └──────────────────────────────────┘  │
│ ...                                    │
│ [Carregar mais]                        │
└────────────────────────────────────────┘

┌─ Desktop (≥ 1024px) ──────────────────────────────────┐
│ Header (existente)                                     │
│ ──────────────────────────────────────────────────     │
│ ┌─────────────┬─────────────────────────────────────┐  │
│ │ Filtros     │ 🔍 [input ...]              [limpar]│  │
│ │ Editoria    │ ─────────────────────────────────    │  │
│ │ □ Música    │ 1.234 resultados (~)                 │  │
│ │ □ Cinema    │ [card] [card] [card] ...             │  │
│ │ Autor (combo)│ [Carregar mais]                      │  │
│ │ Tag (multi) │                                       │  │
│ │ Datas [picker]                                      │  │
│ └─────────────┴─────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Decisão 3 — Tokens (alinhamento com sistema existente)**:

- Usar tokens já em `src/styles/global.css` (`--clr-bg`, `--clr-fg`, `--clr-muted`, `--clr-accent`, `--text-sm`, etc.). Não introduzir token novo neste feature — promover esta tipografia/espaçamento para `src/components/ui/` é trabalho do item F10 do Improvement-system, separado.
- M3 (Material 3) referenciado nos mockups SIRA: aplicar **apenas** elevation/shape tokens via CSS vars novas: `--elev-search-popover: 0 4px 12px rgba(0,0,0,.08)`, `--shape-search-input: 12px`.

**Decisão 4 — Estados**:

| Estado                                          | Visual                                                                                                              | Acessibilidade                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Idle** (q vazia, sem filtro)                  | Card central: "Busque por título, autor, tag ou tema. Exemplos: K-pop, soft power, Hallyu."                         | Anúncio de instrução via `<label for>`                        |
| **Loading** (search-as-you-type)                | Spinner inline no input + 3 skeleton cards                                                                          | `aria-busy="true"` no container + `role="status"` "Buscando…" |
| **Empty results**                               | "Nenhum artigo encontrado para '<query>'. Tente termos mais amplos ou remova filtros." + sugestão de tags populares | `role="status"` "Nenhum resultado" via `aria-live="polite"`   |
| **Error**                                       | Inline alert: "Não conseguimos buscar agora. Tente em instantes." + botão "Tentar novamente"                        | `role="alert"`                                                |
| **Fallback degraded** (X-Search-Mode: fallback) | Banner sutil: "Mostrando busca simplificada." (visível só para curiosos; não bloqueia)                              | `aria-label` informa modo                                     |
| **Rate-limited 429**                            | Alert: "Muitas buscas seguidas. Aguarde X segundos." (countdown)                                                    | `aria-live="assertive"`                                       |

**Decisão 5 — Dark mode (respeitar ADR-011)**:

- Todos tokens já dark-aware. Highlights `<mark>` precisam variant escura: `background: var(--clr-mark-bg)` (amarelo translúcido) com cor `var(--clr-mark-fg)` para contraste ≥ 4.5:1.
- Popover de combobox: `--clr-popover-bg` (existe) + sombra reduzida em dark.

**Decisão 6 — Acessibilidade WCAG 2.2 AA**:

- Focus visível: `:focus-visible` com `outline: 2px solid var(--clr-accent); outline-offset: 2px`.
- Contraste ≥ 4.5:1 em todos textos (validar com axe-core/WAVE — política §6 CLAUDE.md).
- Suporte completo a teclado: ↑↓ navegam sugestões, Enter seleciona, Esc fecha popover sem limpar input, Tab move foco para filtros.
- Anúncios para screen reader: número de resultados via `aria-live="polite"` (atualiza no debounce final, não a cada keystroke).
- `prefers-reduced-motion`: desabilitar fade-in dos cards; resultado aparece estático.
- WCAG 2.2 novidades: **2.4.11 Focus Not Obscured** (popover não pode cobrir input focado; sempre abre abaixo); **2.5.8 Target Size 24×24** (chips de filtro mínimo 44×44 em mobile, 24×24 em desktop).

**Decisão 7 — Microinterações**:

- Chip de filtro ativo com `×` para remover individual + "Limpar filtros" global.
- Histórico de buscas (últimas 5) em localStorage — **opt-in** via toggle no perfil (LGPD: não default). Nunca enviado ao backend.

---

## 3. Cross-layer decisions (orchestrator's call)

### 3.1 Contrato API ↔ FE (zero drift)

**Decisão**: gerar `src/types/api.generated.ts` via `openapi-typescript` no CI (`prebuild` script). FE consome apenas tipos gerados; qualquer mudança de contract no DRF quebra o `tsc --noEmit` no PR.

### 3.2 Naming consistency

**Decisão**:

- Backend: `/api/v1/search/articles/` + params `q`, `author`, `category`, `tag`, `from`, `to`.
- Frontend URL: `/buscar?q=...&autor=...&editoria=...&tag=...&de=...&ate=...` (PT-BR alinha com voz do site — `/noticia/:slug` já é PT).
- Mapper FE: hook `useSearchQueryState` traduz PT-URL ↔ EN-API. **Justificativa**: UX PT (deep-link em PT) ≠ API estável EN (drf-spectacular gera tudo EN). Um único mapper resolve.

### 3.3 Perf budget split (orçamento de 300ms p95 e 2.5s LCP)

| Trecho                                 | Budget                    |
| -------------------------------------- | ------------------------- |
| BE: parse + query SQL + ranking        | ≤ 80ms p95                |
| BE: serializer + ts_headline           | ≤ 40ms p95                |
| Rede (BR→KVM Hostinger via Cloudflare) | ≤ 80ms p95                |
| FE: parse JSON + reconcile + paint     | ≤ 100ms p95               |
| **Total p95**                          | **≤ 300ms**               |
| LCP page load (cold)                   | ≤ 2.5s (chunk + 1ª query) |

### 3.4 Security trade-offs (delegado a cyber-security-architect — agendar review)

- **Rate limit por IP é burlável** atrás de Cloudflare → reforçar com `CF-Connecting-IP` (já consumido pelo `apps.audit`) + rate por `user_id` quando autenticado.
- **DoS via queries pesadas**: `statement_timeout=400ms` por sessão de search + LIMIT obrigatório no parser.
- **SQL Injection**: parser usa `plainto_tsquery` (não concatena raw SQL); ORM Django parametriza tudo.
- **PII em queries**: ADR-020 + regex de redação no middleware.
- **Leak de drafts**: filtro `status='published'` é hard-coded no service (não opcional via param), inclusive em fallback.

### 3.5 Testability (delegado a testing-engineer)

- **Unit**: `parser.normalize_query`, `ranking.score_breakdown`, `cursor.encode/decode`.
- **Integration (Postgres em CI matrix)**: query end-to-end no DB com fixtures de 100 artigos.
- **Contract test**: snapshot do OpenAPI schema; falha PR se mudou sem ADR.
- **E2E (Playwright)**: fluxo "digito, vejo sugestão, navego com ↓, Enter abre artigo" + deep-link.
- **A11y test**: axe-core no DOM da `/buscar` em CI (gate atual: zero violations críticas).
- **Performance test**: query path < 100ms em CI com seed de 10k artigos (gate); reindex < 60s para 50k (alvo aspiracional).
- **TDD obrigatório (§6)**: testes de `parser`, `cursor`, `query service` são escritos PRIMEIRO.

### 3.6 SQLite-dev gap (cross-layer)

Decisão de aceitar fallback LIKE em dev (sem ranking) cria **risco real**: bug de ranking só aparece em prod. Mitigação:

- CI roda matrix Postgres + SQLite.
- README adiciona seção "Quero ranking real? Subir Postgres local via Docker compose" (snippet documental).
- Gate de PR: testes que dependem de FTS marcam `@pytest.mark.requires_postgres` e rodam só em Postgres job.

---

## 4. ADRs a criar

| ADR         | Título                                                           | Rationale (1 frase)                                                                                                                           |
| ----------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **ADR-015** | Postgres FTS nativo como motor v1                                | Zero infra nova, suporta português, p95 cabível em 50k artigos sem externalizar para SaaS (LGPD-friendly).                                    |
| **ADR-016** | App `apps.search` separado de `apps.articles`                    | Subdomínio genérico de leitura com ciclo próprio; permite trocar motor sem tocar publicação.                                                  |
| **ADR-017** | Modelo `articles.Tag` com taxonomia pré-cadastrada               | Executa decisão da ADR-002; tags livres degradam SEO.                                                                                         |
| **ADR-018** | SQLite-dev usa fallback LIKE sem ranking                         | DX preservada; paridade total seria custo alto; CI matrix Postgres fecha o gap.                                                               |
| **ADR-019** | Rate limit search via `django-ratelimit` (30/60 rpm)             | Granularidade por endpoint; throttle DRF global é grosso demais.                                                                              |
| **ADR-020** | LGPD — redação de PII em query logs após 7d via Celery beat      | Lei 13.709 art. 16 + necessidade de análise agregada de tendência.                                                                            |
| **ADR-021** | TanStack Query v5 como cliente HTTP padrão                       | Cache + dedupe + retry policy + keepPreviousData fora-da-caixa; substitui axios bare nas rotas novas. (Cross-feature — pode ser ADR à parte.) |
| **ADR-022** | `openapi-typescript` no `prebuild` para gerar `api.generated.ts` | Elimina drift BE↔FE; tsc trava drift em PR.                                                                                                   |

---

## 5. Open questions (escalar ao usuário antes de iniciar)

1. **Tag axes**: as 4 categorias geopolíticas da taxonomia de ADR-002 já estão definidas em algum lugar? Sem isso, `Tag.axis` fica como TextChoices vazio.
2. **Histórico de buscas no perfil**: feature aceita ou retirar do escopo v1?
3. **Internacionalização**: vamos cair sempre em `portuguese` config? Há previsão de artigos em EN/ES (Soft Power latino)?
4. **TanStack Query**: o projeto já adotou? Se não, ADR-021 vira pré-requisito (e adiciona ~12KB gz ao bundle).
5. **Cloudflare Search Analytics**: usar `cf.bot_management.score` para distinguir bot de leitor real no rate limit? (Hoje a integração com CF não está formalizada além de `CF-Connecting-IP`.)
6. **`statement_timeout=400ms`**: aplicar via `SET LOCAL` no início da view, ou via setting global Postgres? (Trade-off: global afeta outras queries longas; local custa 1 round-trip.)
7. **Sinônimos editoriais**: "K-pop" vs "Kpop" vs "K pop" — tratar via `tsvector` synonyms dict, ou normalizar no parser? (V1: parser normaliza hífens; synonyms dict v2.)

---

## 6. Implementation order (para code-implementer)

**Fase 0 — Pré-requisitos** (não bloqueia feature mas precisa estar OK):

1. ADR-021 decisão de TanStack Query (se for adotar).
2. ADR-022 `openapi-typescript` no build.

**Fase 1 — Schema & infra (backend)**: 3. Migration `articles.Tag` + admin (TDD: testes de modelo). 4. Migration `unaccent` + `pg_trgm` extensions (RunSQL conditional). 5. Migration `Article.search_vector` + trigger SQL (conditional Postgres). 6. Management command `rebuild_search_index` (TDD).

**Fase 2 — Service & API (backend)**: 7. `apps.search` skeleton + URLConf. 8. `services/parser.py` + tests TDD. 9. `services/ranking.py` + tests TDD. 10. `services/query.py` (SearchQuery, search_articles) + tests TDD. 11. `views.py` SearchArticlesView + serializers + tests. 12. `throttles.py` + tests. 13. `AutocompleteView` + tests. 14. drf-spectacular schema review + OpenAPI snapshot test.

**Fase 3 — Frontend**: 15. `openapi-typescript` integrado, `api.generated.ts` no repo (ou gitignored + gerado no prebuild). 16. `useSearchQueryState` hook + tests Vitest. 17. `useSearchArticles` (TanStack Query) + tests. 18. Componente `SearchInput` (combobox APG) + axe tests. 19. Componente `SearchFilters` (mobile sheet + desktop sidebar) + tests. 20. Componente `SearchResults` (cards + skeleton + estados) + tests. 21. Página `Search.tsx` + rota lazy em `AppRouter`. 22. Testes E2E Playwright (fluxos críticos).

**Fase 4 — Observability & LGPD**: 23. `event='search'` em AuditLog + middleware de redação PII. 24. Celery beat task `redact_old_search_logs` + test (freezegun). 25. Métricas Sentry / structured logs.

**Fase 5 — Hardening**: 26. CI matrix Postgres + SQLite jobs. 27. Lighthouse CI gate (LCP ≤ 2.5s) para `/buscar`. 28. Load test (locust ou k6) com seed de 50k artigos → confirmar p95.

---

## 7. Verification gates (RF/RNF → testes)

**RF — Requisitos funcionais**:
| ID | Descrição | Teste |
|---|---|---|
| RF-01 | Buscar por texto livre retorna resultados rankeados | Integration (Postgres) + E2E |
| RF-02 | Filtros combináveis (AND) | Integration |
| RF-03 | URL deep-linkable preserva estado | E2E + unit hook |
| RF-04 | Autocomplete ≤ 3 chars retorna sugestões em ≤ 30ms | Integration + perf gate |
| RF-05 | Paginação cursor estável | Integration |
| RF-06 | Highlighting em `excerpt` | Integration + snapshot |
| RF-07 | Empty/loading/error/fallback states | Frontend unit + E2E |

**RNF — Não-funcionais**:
| ID | Descrição | Gate |
|---|---|---|
| RNF-P1 | p95 ≤ 300ms @ 50k artigos | Load test em CI nightly |
| RNF-P2 | LCP ≤ 2.5s na `/buscar` | Lighthouse CI |
| RNF-A1 | WCAG 2.2 AA — zero violations críticas | axe-core CI |
| RNF-A2 | Teclado-only navega 100% do flow | Playwright + manual |
| RNF-S1 | Rate limit 30/60 rpm efetivo | Integration test |
| RNF-S2 | SQL Injection / DoS via query gigante | Security test (semgrep + integration) |
| RNF-L1 | Query logs > 7d redacted | Celery task test + freezegun |

**INVEST traceability** (engenharia-de-requisitos):

- Independent: ✅ feature stand-alone, sem bloquear comments/moderation.
- Negotiable: ⚠️ autocomplete e highlighting são push/pull (podem virar fase 2 se pressing).
- Valuable: ✅ retenção (KPI primário do produto editorial — overview.md §1).
- Estimable: ✅ ~3-4 sprints para escopo completo.
- Small: ⚠️ feature grande; **slicing recomendado**: v1 = só busca por título + filtro editoria (1 sprint), v2 = corpo+autor+tag+data, v3 = autocomplete+highlighting.
- Testable: ✅ todos critérios mensuráveis (perf, a11y, contrato).

---

## 8. Hand-off para validadores

| Validador                  | Pacote a revisar               | Ponto crítico                                                      |
| -------------------------- | ------------------------------ | ------------------------------------------------------------------ |
| `cyber-security-architect` | §3.4 + ADR-019 + ADR-020       | DPIA para search logs + DoS mitigation + Cloudflare bot score      |
| `testing-engineer`         | §7 (gates) + Fase 1-5 da §6    | Confirmar gates de cobertura + Playwright E2E specs                |
| `documentation-engineer`   | ADRs 015-022 + DESIGN.md final | Materializar ADRs em `docs/planning/adrs/` com template do projeto |

---

## Smoke test report

### ✅ / ❌ Subagents que disparam automaticamente vs. instrução explícita

- ❌ **Nenhum subagent disparou automaticamente nesta sessão**. O tool `Task` (que permitiria fan-out a `software-architect`/`backend-architect`/`frontend-architect`/`ui-ux-architect`) **não está disponível no ambiente atual** — retornou `No such tool available: Task. Task is not available inside subagents`. Isso indica que o design-orchestrator está rodando como subagent ele mesmo (Claude Code não permite nesting), não no topo do stack.
- ❌ Os 2 specialists **adicionais pedidos no brief** (`database-architect`, `algorithms-data-structures-architect`) **não constam na tabela `<subagent_team>` do prompt do design-orchestrator** (que só lista 4: software/backend/frontend/UI-UX). Mesmo com Task disponível, eu precisaria ter consolidado essas lentes em outros agents ou levantado a divergência.
- **Resultado**: DESIGN.md foi produzido em **modo degradado** — orchestrator simulou cada lente internamente, ancorado em leitura real do repo (CLAUDE.md, overview.md, articles/models.py, AppRouter.tsx, ADR-002). Decisões são defensáveis mas **não passaram por challenge externo** de specialists independentes.

### ✅ / ❌ Skills do ecossistema invocadas efetivamente

Como não houve fan-out real, eu (orchestrator) cito as skills que **ancoraram cada lente**:

- **Software**: `ddd-strategic-design` (subdomain genérico vs core), `architecture-patterns` (CQRS-lite), `coupling-analysis` (uni-directional search→articles), `architecture-decision-records` (ADRs 015-022). ✅
- **Database**: `database-design`, `postgresql-optimization`, `postgres-best-practices`. Apenas conceitualmente — sem invocação literal via Skill tool. ⚠️
- **Algoritmo**: `algorithms-data-structures` (BM25-ish, cursor pagination). ⚠️
- **Backend**: `backend-architect`, `api-design-principles`, `api-patterns`. ⚠️ Skills citadas, não carregadas.
- **Frontend**: `react-best-practices`, `react-patterns`, `frontend-api-integration-patterns`. ⚠️
- **UI/UX**: `ecossistemas-ui-ux` (skill local — sumário aplicado), `radix-ui-design-system` (combobox APG), regra dura WCAG 2.2 AA. ✅ (skill local foi referenciada porque está no CLAUDE.md como obrigatória).

### ⚠️ Gaps encontrados

1. **Tool `Task` indisponível para o design-orchestrator quando ele próprio é invocado como subagent**. Esse é o gap mais sério — quebra completamente o design do orchestrator (que existe **para** fan-out). Precisa decisão arquitetural: ou orchestrator vira top-level only, ou ganha modo fallback declarado (single-pass com aviso explícito, como fiz aqui).
2. **Mismatch de specialists**: brief pede 6 (`software`, `database`, `algorithms`, `backend`, `frontend`, `ui-ux`), team tem 4. Os 2 ausentes (`database-architect`, `algorithms-data-structures-architect`) precisam ser adicionados ao `<subagent_team>` OU o brief precisa ser ajustado para mapear DB → `backend-architect` e algoritmo → `software-architect`.
3. **Skill tool não foi invocada** efetivamente — só citei skills por nome. O CLAUDE.md global é explícito que "skills só funcionam quando carregadas". Em modo degradado, decisões ficam mais frágeis (memória do agente em vez de conteúdo carregado).
4. **Hooks de observação no PreToolUse** adicionaram contexto histórico útil (e.g. node version mismatch, vitest stale doc), mas não há canal para alimentá-lo de volta no DESIGN — virou texto em background sem ação.
5. **`engenharia-de-requisitos` skill** foi citada no protocolo do orchestrator como sempre-aplicada — usei como referência (RF/RNF, INVEST traceability em §7) mas sem invocação formal.
6. **Sem ADR escrito de fato em `docs/planning/adrs/`** — listei títulos + rationale, mas a skill `create-adr` espera invocação que não fiz. ADRs ficaram como TODO para próximo ciclo.

### 💡 Sugestões de refino (3)

1. **Adicionar fallback explícito na description do design-orchestrator**: "Se o tool `Task` não estiver disponível, declarar `MODE: degraded` no topo do DESIGN.md, simular cada lente internamente, e marcar todas decisões como `requires-specialist-review`." Isso evita falha silenciosa.
2. **Alinhar o `<subagent_team>` com os specialists realmente usados em briefs reais**: ou inclui `database-architect` e `algorithms-data-structures-architect` na tabela do prompt do orchestrator, OU documenta que esses dois domínios são absorvidos por `backend-architect` + `software-architect`. Hoje há gap silencioso.
3. **Forçar invocação da `Skill` tool (não só citação por nome) nas decisões cross-layer**: a tabela `<skill_invocation_protocol>` lista skills "Always", mas nada no fluxo obriga `Skill(name='architecture-decision-records')` antes de listar ADRs. Adicionar gate: "antes de §4 (ADRs), invocar `architecture-decision-records`; antes de §3.4, invocar `cyber-security-architect`."

---

_Documento gerado pelo design-orchestrator em modo single-pass (degradado) — 2026-06-02. Próximo passo: validar com usuário as 7 open questions, criar ADRs 015-022 em `docs/planning/adrs/`, despachar para testing-engineer + cyber-security-architect + documentation-engineer._
