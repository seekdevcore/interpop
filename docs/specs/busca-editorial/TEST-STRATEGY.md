# TEST-STRATEGY.md — Busca editorial full-text (F-30/F-31/F-32)

**Engenheiro:** `testing-engineer` (sub-agent)
**Sessão:** orquestrada pelo main-loop, gate pré-`code-implementer`
**Data:** 2026-06-03
**Spec-fonte:** [`DESIGN.md` v3](./DESIGN.md) (614 linhas, 6 specialists, 10 bugs detectados)
**Backlog-fonte:** [`BACKLOG.md`](./BACKLOG.md) (EP-10 · 3 features · 12 US · 100 Tasks US-bound · 18 Tasks TX)
**Padrões aplicáveis:** [`docs/tests/testing-standards.md`](../../tests/testing-standards.md) v1.1
**Diretrizes mestras:** §0 do `CLAUDE.md` (Gabarito — extreme ownership, anti-sycophancy, profundidade, elevação de nível, obsessão pelo objetivo)

---

## §0. Veredito

> **APROVADO COM RESSALVAS** — o `code-implementer` **pode começar** pela **fase 1+2 do Sprint 4** (T30.1.4b, T30.1.5b, T30.1.X6, T30.1.X7, T30.1.X8, TX-18), **desde que** assuma os **9 compromissos abaixo** antes do primeiro commit.

### Justificativa

O DESIGN v3 está sólido na **arquitetura** (6 specialists, 20 ADRs, 12 invariantes, 10 bugs preventivos) — mas a **estratégia de teste embutida no §3.5 do DESIGN é insuficiente** para uma feature de busca em produção com NFR p95 ≤300ms, WCAG 2.2 AA e LGPD. Concretamente, as lacunas levantadas a seguir bloqueiam a maturidade do quality gate:

1. **Property-based testing** não está no DESIGN nem no BACKLOG, apesar de 3 invariantes do algorithms (#1 determinismo, #2 normalização simétrica, #6 ROUND simétrico) serem **definicionalmente propriedades**, não casos.
2. **Contract testing entre OpenAPI ↔ openapi-typescript** está implícito no TX-07 mas sem teste real — uma mudança no `SearchSerializer` que o codegen não detecte vira drift silencioso.
3. **Visual regression** está ausente. 5 estados (empty/loading/results/no-results/error/rate-limited) × 2 temas (light/dark) × 2 viewports (390/1440) = 20 superfícies frágeis.
4. **Mutation testing** em `SearchService.query()` (core do recency-boost + cursor stability) não é opcional dada a criticidade.
5. **A11y E2E (axe-playwright)** está mencionado no §3.5 mas sem ownership: TX-17 cobre `@axe-core/react` (unit) — quem cobre runtime real navegado?
6. **`SEARCH_FEATURE_ENABLED` 503 path** não tem teste (T30.1.X4 só declara a Task, sem critério verificável).
7. **Trigger SQL `trg_articles_sync_search`** não tem teste de integração — `pytest-django --reuse-db` não recria triggers em DB cacheado.
8. **Seed Zipfiano sintético do k6** não tem ownership nem CI feasibility (Postgres efêmero com 50k registros realistas em CI = problema novo).
9. **Lighthouse baseline (TX-18)** não é verificável por CI — quem garante que o JSON existe antes do `lhci` rodar?

Esses 9 compromissos viram **9 Tasks novas** + **2 ADRs novos** (§7 e §8 deste documento). Sem eles, a estratégia entrega **falsa segurança** (cobertura percentual alta mascarando ausência de validação real do comportamento sob carga, drift de contrato e regressão visual).

---

## §1. Skills invocadas (declaração obrigatória — Gabarito + skill_invocation_protocol)

| Skill                                                                          | Camada            | Por quê                                                                            |
| ------------------------------------------------------------------------------ | ----------------- | ---------------------------------------------------------------------------------- |
| `superpowers:test-driven-development`                                          | Disciplina mestre | TDD red-green-refactor obrigatório para invariantes 1-12 do algorithms             |
| `tdd-orchestrator`                                                             | Pyramid sweep     | Compor unit→integration→E2E→property→a11y→perf                                     |
| `engenharia-de-requisitos`                                                     | Spec              | BDD pt-BR DADO/QUANDO/ENTÃO traceável a CA01–CA27                                  |
| `playwright-skill-tlc`                                                         | E2E               | Stack oficial planejada (Sprint 3+ no testing-standards), agora aciona em Sprint 4 |
| `e2e-testing-patterns`                                                         | E2E               | Padrões de network mock (MSW), data-testid stable, parallel isolation              |
| `unit-testing-test-generate`                                                   | Unit              | Geração disciplinada dos testes do `SearchService`                                 |
| `web-accessibility`                                                            | A11y              | WCAG 2.2 AA — axe-core unit + axe-playwright E2E + manual NVDA/VoiceOver           |
| `wcag-audit-patterns`                                                          | A11y              | Validação dos 5 estados × 2 temas × `<mark>` semântico × focus order               |
| `core-web-vitals`                                                              | Perf              | LCP/INP/CLS com budgets do DESIGN §3.3                                             |
| `k6-load-testing`                                                              | Perf load         | Seed Zipfiano sintético + p95 gate em CI nightly                                   |
| `testing-patterns` · `python-testing-patterns` · `javascript-testing-patterns` | Stack             | Pytest 9 + Vitest 4 patterns no contexto Interpop                                  |
| `find-bugs` · `bug-hunter`                                                     | Adversarial       | Catalogar edge-cases não cobertos pelo DESIGN §4 do algorithms                     |
| `superpowers:verification-before-completion`                                   | Gate              | Definition of Done — sem flake em 10 runs consecutivos                             |
| `superpowers:systematic-debugging`                                             | Flake protocol    | Método científico se algum teste virar flaky em CI                                 |
| `tlc-spec-driven`                                                              | Trace             | Toda assertion linkada a CA/RF/RNF/invariante                                      |

Skills **descartadas com critério** (não invocadas):

- `referencias-dashboards` — busca não é dashboard.
- `tdd-workflows-tdd-cycle` — redundante com `superpowers:test-driven-development`.
- `bats-testing-patterns` — não há shell crítico.
- `agent-evaluation` — não há agente LLM nesta feature.

---

## §2. Matriz de cobertura por tipo (10 tipos core de `testing-standards.md`)

| #      | Tipo                                           | Aplicabilidade nesta feature                                           | Cenários concretos                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Owner Task                                                                        |
| ------ | ---------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **1**  | **Unitário** (pytest + Vitest)                 | 🔴 Alta                                                                | (a) `normalize_search_text("K-Pop") == normalize_search_text("kpop")` (Inv 2); (b) `encode_cursor(score, pub, id) → decode_cursor(...) == (round(score,6), pub, id)` (Inv 5+6); (c) `validate_q("kpop:*&!") → "kpop"` (sem operadores, Inv 3); (d) `cap_tokens("a b c d e f g h i j")` ≤8 (Inv 8); (e) `useDebouncedValue(value, 250)` emite após 250ms (FE); (f) `useSearch` `getNextPageParam` retorna `undefined` quando `next_cursor === null` (Bug 6, Inv crítica FE); (g) `highlightTerms("cantores", ["cantor"])` casa stem (server-fed)                                                                                                                                                      | T30.1.11, T30.2.6, T30.1.X6, T30.1.X7, T30.1.X10                                  |
| **2**  | **Retroativo (backfill)**                      | 🟡 Média                                                               | Não aplica como entry point (feature nova), MAS: ao refatorar `apps.newsletter` para consumir `SearchService.query()` (Open question #8 do DESIGN), backfill cobre o caminho atual antes do refactor. Sprint 6+.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | (postergado)                                                                      |
| **3**  | **TDD** (vermelho-verde-refactor)              | 🔴 **Obrigatório**                                                     | (a) `SearchService.query(QuerySpec)` — lógica de segurança (cursor HMAC) + cálculo de domínio (ranking) → 5 dos 12 invariantes (1,2,5,6,11) são lógica de domínio crítica conforme §2.3 do testing-standards. Vermelho antes de verde. (b) Trigger SQL `trg_articles_sync_search` — escrever migration de teste primeiro: insert artigo `draft` → search_index vazio → publish → search_index populado → demote → search_index vazio. (c) Throttle DRF 30/min anon → escrever teste de 31ª request retorna 429 antes de implementar throttle class.                                                                                                                                                  | T30.1.7, T30.1.5b, T30.4.5                                                        |
| **4**  | **Integração** (pytest-django + Postgres real) | 🔴 Alta                                                                | (a) `GET /api/v1/search/articles/?q=kpop` → 200 + shape contratual + ordenação rank DESC; (b) Trigger SQL: insert Article publicado → search_index populado em mesma transação; (c) Status filter (Inv 4): artigo draft NÃO aparece; (d) `q="o de da"` (só stopwords) → 200 + `results: []` + **0 queries Postgres** (`CaptureQueriesContext`, Inv 7); (e) Cursor flipado HMAC inválido → 400 (Inv 5); (f) 31 req <60s → 31ª 429 (CA06); (g) Feature flag `SEARCH_FEATURE_ENABLED=False` → 503 (T30.1.X4); (h) `select_related` evita N+1 (`assertNumQueries(≤3)`); (i) LGPD: query plain nunca persistida (verificar `search_log` shape); (j) Retention 7d: `freezegun` salta 8 dias → log purgado. | T30.1.12, T30.4.5, +T30.1.TY2 (nova, ver §7)                                      |
| **5**  | **E2E (Playwright)**                           | 🟠 Alta                                                                | (a) "Leitor realiza busca simples" (US30.1) — Chromium + Firefox; (b) "Leitor visualiza carregamento" (skeleton CLS=0 medido); (c) "Leitor busca por palavra inexistente" (US30.3, msg pt-BR exata); (d) "Leitor ultrapassa limite" (mock 429 + Retry-After); (e) Mobile keyboard iOS (`<dialog>` filter sheet 75dvh, US31.x); (f) Deep-link compartilhado (US32.3) — abrir URL `?q=kpop&editoria=musica` em browser fresh, assert filtros aparecem; (g) Back/forward navegador preserva estado (US32.2).                                                                                                                                                                                            | T30.1.21, T30.1.22, T30.3.5, T30.3.6, T31.1.7, T31.3.6, T31.3.7, T32.1.5, T32.2.4 |
| **6**  | **Regressão**                                  | 🔴 Crítico                                                             | Para os **10 bugs detectados no refino v3** (vide DESIGN §0), criar teste de regressão **antes** do fix correspondente (vermelho-verde). Cada teste referencia o bug pelo número e arquivo:linha do DESIGN. Exemplos: regression_bug_6_next_cursor_null, regression_bug_9_cursor_round, regression_bug_10_cte_limit_500.                                                                                                                                                                                                                                                                                                                                                                             | +T30.1.TY3 (nova, §7)                                                             |
| **7**  | **Smoke**                                      | 🟢 Baixo (já existe)                                                   | `/healthz/` já cobre. Adicionar 1 assertion ao smoke pós-deploy: `GET /api/v1/search/articles/?q=test` → 200 ou 503 (feature flag) em <100ms. NÃO testa lógica.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | +T30.1.TY4 (nova, §7)                                                             |
| **8**  | **A11y**                                       | 🔴 Obrigatório (WCAG 2.2 AA é regra dura §4 CLAUDE.md)                 | (a) **Unit a11y** via `@axe-core/react` + `jest-axe` em todos os 6 estados do `<Buscar />`: empty / loading skeleton / results / no-results / error 5xx / rate-limited 429 — TX-17 já cobre, MAS adicionar 2 estados que TX-17 esqueceu: "filtros abertos mobile dialog" + "highlighted `<mark>` rendered"; (b) **E2E a11y** via `@axe-core/playwright` em `/buscar?q=kpop` real (Chromium); (c) **Manual** NVDA Windows + VoiceOver macOS — fluxo "digitar → ouvir contagem `aria-live` → tab para resultado → Enter abre artigo" gravado em vídeo, arquivado em `docs/tests/a11y-recordings/`; (d) Contraste `<mark>` validado matematicamente (`docs/tests/contrast-check.md` ou usar pa11y).     | TX-17 + ampliar a 8 estados, +T30.1.TY5 (manual, §7)                              |
| **9**  | **Performance**                                | 🔴 Obrigatório (NFR explícito)                                         | (a) **Backend**: pytest-benchmark em `SearchService.query()` com seed 50k Zipfiano (top 100 queries cobrem 70% tráfego) — assert p95 ≤200ms (budget do §3.3 do DESIGN); (b) **k6 load**: 100 req/s × 5min, seed Zipfiano sintético (script `scripts/seed-zipfian.py` — owner: TY6 nova), gate p95 ≤300ms; (c) **N+1**: `assertNumQueries(≤3)` em `SearchView`; (d) **Lighthouse CI** (TX-16): LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 em `/buscar?q=kpop`; (e) **Bundle size**: delta `+TanStack 13KB + mark.js 6KB ≤ 20KB gz` (TX-16); (f) **Baseline pré-busca** (TX-18) — adicionar assertion no `lhci` step: falha se `lighthouse-baseline-pre-busca.json` ausente.                                      | TX-15, TX-16, TX-18, +T30.1.TY6 (nova, §7)                                        |
| **10** | **Segurança**                                  | 🟠 Alta (handoff `cyber-security-architect` confirmado em §3.4 DESIGN) | (a) SQL injection: `q="' OR 1=1 --"` → `plainto_tsquery` escapa, 200 empty (Inv 3) — integration test; (b) XSS via highlight: payload `q="<script>alert(1)</script>"` → `<mark>` sanitizado, sem injection (E2E + unit); (c) CSP test em CI: header presente, mark.js NÃO requer `unsafe-inline`; (d) HMAC cursor: chave rotacionada → cursor antigo retorna 400 (Inv 5); (e) Rate limit bypass: testar com IPs forjados via `X-Forwarded-For` (não deve burlar — DRF `get_client_ip` usa `REMOTE_ADDR` ou CF header confiável); (f) `bandit` + `semgrep` em CI sobre `apps/search/` no PR.                                                                                                          | T30.1.X1...Segurança, +T30.1.TY7 (nova, §7)                                       |

### Resumo de aplicabilidade

| Tipo          | Mandatório? | Estado                         | Tasks novas (§7)  |
| ------------- | ----------- | ------------------------------ | ----------------- |
| 1 Unit        | ✅          | parcial (já no BACKLOG)        | —                 |
| 2 Backfill    | ⚪          | postergado                     | —                 |
| 3 TDD         | ✅          | parcial (declarado, sem rigor) | TY3 (regression)  |
| 4 Integration | ✅          | parcial                        | TY2               |
| 5 E2E         | ✅          | planejado                      | — (BACKLOG cobre) |
| 6 Regression  | ✅          | ausente (apesar de 10 bugs)    | TY3               |
| 7 Smoke       | ✅          | precisa expandir               | TY4               |
| 8 A11y        | ✅          | parcial (só unit)              | TY5               |
| 9 Performance | ✅          | parcial (sem seed CI)          | TY6               |
| 10 Security   | ✅          | parcial                        | TY7               |

**Tipos de extensão (catálogo §2.11)** que esta feature exige criar (vide §8 ADR novo): property-based (Hypothesis), contract testing (schemathesis), mutation testing (mutmut), visual regression (Playwright screenshots).

---

## §3. Cenários BDD em Gherkin pt-BR (por User Story)

> Convenções: pt-BR, sem infinitivo no título, sem termos técnicos no título, DADO/QUANDO/ENTÃO. Cenários **completam ou substituem** os que estão no BACKLOG.md quando há gap.

### 3.1 US30.1 — Apresentação básica e ordenação

```gherkin
Cenário: Leitor digita 1 caractere e nenhum resultado é solicitado
  Dado que o leitor está na página de busca
  Quando o leitor digita apenas "k"
  Então o sistema não envia nenhuma requisição ao servidor
  E nenhuma lista de resultados aparece na tela
  E o foco permanece no campo de busca
```

```gherkin
Cenário: Leitor digita 2 caracteres e recebe resultados ranqueados
  Dado que existem 142 artigos publicados que contêm "kpop"
  E o leitor está na página de busca
  Quando o leitor digita "kp"
  E o leitor aguarda 250 milissegundos sem digitar
  Então o sistema apresenta a lista dos primeiros 20 artigos
  E os artigos aparecem ordenados do mais relevante para o menos relevante
  E artigos com "kpop" no título aparecem antes dos artigos com "kpop" só no corpo
  E a contagem "142 resultados" aparece acima da lista
```

```gherkin
Cenário: Leitor aguarda resultados com skeleton de carregamento
  Dado que o leitor está na página de busca
  Quando o leitor digita "k-pop"
  Então o sistema apresenta três cartões esqueleto enquanto carrega
  E os cartões esqueleto têm a mesma altura dos cartões reais
  E o CLS (Cumulative Layout Shift) medido é menor que 0.05
```

### 3.2 US30.2 — Destaque visual das palavras buscadas

```gherkin
Cenário: Leitor busca por "cantores" e o destaque casa a flexão "cantor"
  Dado que existe um artigo com título "Os melhores cantores de kpop em 2024"
  E o leitor está na página de busca
  Quando o leitor digita "cantores"
  Então o sistema apresenta o artigo na lista de resultados
  E a palavra "cantores" aparece com fundo amarelo no título
  E a palavra "cantor" também aparece destacada em outros artigos
  E o destaque respeita a stemização do português brasileiro
```

```gherkin
Cenário: Leitor tenta injetar HTML no termo de busca
  Dado que o leitor está na página de busca
  Quando o leitor digita "<script>alert(1)</script>"
  Então o sistema apresenta zero resultados ou resultados normais
  E nenhum alerta JavaScript é executado
  E o termo aparece escapado na mensagem "Nenhum resultado encontrado para «<script>alert(1)</script>»"
```

### 3.3 US30.3 — Mensagens para busca sem resultados e erros

```gherkin
Cenário: Leitor recebe mensagem amigável quando a busca não retorna resultados
  Dado que não existe nenhum artigo com a palavra "xyzkpop123"
  E o leitor está na página de busca
  Quando o leitor digita "xyzkpop123"
  Então o sistema apresenta a mensagem "Nenhum resultado encontrado para «xyzkpop123»"
  E o sistema apresenta a sugestão "Tente sinônimos ou remova algum filtro"
  E a mensagem é anunciada pelo leitor de tela (aria-live polite)
```

```gherkin
Cenário: Leitor ultrapassa o limite de buscas por minuto
  Dado que o leitor não autenticado realizou 30 buscas no último minuto
  Quando o leitor tenta realizar a 31ª busca
  Então o sistema apresenta a mensagem "Você fez muitas buscas. Aguarde alguns segundos."
  E o sistema apresenta um contador regressivo lendo o cabeçalho Retry-After
  E o leitor de tela anuncia o erro com prioridade assertive
```

### 3.4 US31.1 — Filtro por autor

```gherkin
Cenário: Leitor seleciona filtro de autor pela lista
  Dado que o leitor realizou a busca pela palavra "kpop"
  E a busca retornou 142 artigos de diversos autores
  Quando o leitor abre o painel de filtros
  E seleciona "João Silva" na lista de autores
  Então o sistema apresenta apenas os artigos do autor "João Silva" que contêm "kpop"
  E uma etiqueta "Autor: João Silva ×" aparece acima dos resultados
  E o parâmetro "autor=joao-silva" é adicionado à URL
```

### 3.5 US31.3 — Filtro por período (cenários adversariais)

```gherkin
Cenário: Leitor tenta filtrar com intervalo maior que 5 anos
  Dado que o leitor está configurando o filtro de período
  Quando o leitor informa data inicial "01/01/2018"
  E o leitor informa data final "31/12/2024"
  Então o sistema apresenta a mensagem "O intervalo máximo entre datas é de 5 anos."
  E o filtro não é aplicado
```

```gherkin
Cenário: Leitor informa data inicial posterior à data final
  Dado que o leitor está configurando o filtro de período
  Quando o leitor informa data inicial "31/12/2024"
  E o leitor informa data final "01/01/2024"
  Então o sistema apresenta a mensagem "A data inicial deve ser anterior à data final."
  E o filtro não é aplicado
```

### 3.6 US31.4 — Remoção dos filtros

```gherkin
Cenário: Leitor remove um único filtro mantendo os demais
  Dado que o leitor aplicou três filtros: "Autor: João Silva", "Editoria: Música" e "Período: 2024"
  Quando o leitor clica no "×" da etiqueta "Editoria: Música"
  Então o sistema mantém os filtros de autor e período
  E o sistema apresenta os resultados sem o filtro de editoria
  E a URL passa a refletir os filtros remanescentes
```

### 3.7 US32.1+32.2 — Deep-linking

```gherkin
Cenário: Leitor recarrega a página e mantém termo e filtros
  Dado que o leitor realizou a busca por "Beyoncé Renaissance" com filtro "Editoria: Música"
  Quando o leitor pressiona F5 para recarregar a página
  Então o termo "Beyoncé Renaissance" continua no campo de busca
  E a etiqueta "Editoria: Música ×" continua acima dos resultados
  E os mesmos resultados aparecem novamente
```

```gherkin
Cenário: Leitor navega para trás e os filtros voltam ao estado anterior
  Dado que o leitor aplicou os filtros e o estado da URL é "/buscar?q=kpop&editoria=musica"
  Quando o leitor clica no botão "voltar" do navegador
  Então a URL volta para "/buscar?q=kpop"
  E a etiqueta "Editoria: Música" desaparece da tela
```

### 3.8 US32.3 — Compartilhamento

```gherkin
Cenário: Leitor recebe link compartilhado e visualiza os mesmos resultados
  Dado que o leitor A realizou uma busca "/buscar?q=kpop&editoria=musica&de=2024-01-01&ate=2024-12-31"
  E enviou o link para o leitor B
  Quando o leitor B abre o link no navegador
  Então o sistema apresenta exatamente os mesmos resultados visualizados pelo leitor A
  E o campo de busca contém "kpop"
  E todos os filtros aparecem como etiquetas acima dos resultados
```

### 3.9 Cenários adversariais (cross-US, não cobertos pelo BACKLOG)

```gherkin
Cenário: Leitor força query patológica de 20 tokens
  Dado que o leitor está na página de busca
  Quando o leitor digita "música pop coreana kpop ídolo grupo seoul agência debut comeback dance line vocal rap visual maknae leader fandom"
  Então o sistema apresenta a mensagem "Sua busca é muito complexa. Tente simplificar."
  E o sistema retorna HTTP 400 com código "query_too_complex"
  E zero queries são executadas no Postgres
```

```gherkin
Cenário: Leitor tenta paginar além do limite seguro
  Dado que o leitor está na página 50 dos resultados de "kpop"
  Quando o leitor clica em "Carregar mais resultados"
  Então o sistema apresenta a mensagem "Refine sua busca para ver mais resultados"
  E o sistema retorna HTTP 400 com código "refine_query"
```

```gherkin
Cenário: Adversário externo forja cursor com payload manipulado
  Dado que o leitor está na página de busca
  Quando uma requisição é feita com cursor "AAAAcurador_falso"
  Então o sistema retorna HTTP 400 com código "invalid_cursor"
  E nenhuma query é executada no Postgres
  E nenhum dado sensível vaza no corpo da resposta
```

```gherkin
Cenário: Leitor busca enquanto a feature está desligada
  Dado que a variável SEARCH_FEATURE_ENABLED está como False
  Quando o leitor acessa /buscar?q=kpop
  Então o sistema retorna HTTP 503 com cabeçalho Retry-After
  E a mensagem "A busca está temporariamente indisponível" aparece na tela
```

```gherkin
Cenário: Leitor recebe 500 resultados e o cursor mantém ordem estável
  Dado que existem 500 artigos publicados que contêm "kpop"
  E o leitor está navegando os resultados página a página
  Quando 100 novos artigos com "kpop" são publicados entre as páginas 1 e 2
  Então a página 2 não repete artigos da página 1
  E a página 2 não pula artigos do ranking anterior
  E o cursor permanece estável até o final da paginação
```

```gherkin
Cenário: Leitor abre o painel de filtros em iPhone com teclado virtual aberto
  Dado que o leitor está em viewport 390×844 (iPhone 14)
  E o teclado virtual está aberto
  Quando o leitor abre o painel de filtros mobile
  Então o painel aparece com altura máxima de 75dvh
  E o conteúdo não fica oculto pelo teclado
  E o padding inferior respeita safe-area-inset-bottom
  E ao focar o input principal, o painel fecha
```

---

## §4. Mapping 12 invariantes → testes (de §2.3 do DESIGN / §8 do specialist 02)

| #   | Invariante                                            | Tipo de teste                                 | Cenário concreto                                                                                                                      | Assertion (pseudo-código)                                                                   | Owner Task                |
| --- | ----------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------- |
| 1   | Determinismo (mesma input → mesma ordem)              | **Property-based** (Hypothesis) + Integration | Gerar 100 `(q, filters, cursor)` aleatórios; chamar `SearchService.query()` × 5; comparar ordem                                       | `assert all(runs[0] == r for r in runs)`                                                    | T30.1.TY8 (nova)          |
| 2   | `normalize_search_text()` simétrica                   | **Unit** + Property-based                     | (a) `normalize("K-Pop") == normalize("kpop")`; (b) for any unicode string s: `normalize(normalize(s)) == normalize(s)` (idempotência) | `assert idx_text == query_text`                                                             | T30.1.X2, T30.1.TY8       |
| 3   | `plainto_tsquery` sempre (nunca `to_tsquery`)         | **Unit** + Integration                        | Grep code: `assert 'to_tsquery(' not in service_source`; integration: `q="kpop:*&!"` retorna 200                                      | `assert response.status_code == 200`                                                        | T30.1.7, T30.1.11         |
| 4   | Status filter sempre presente no WHERE                | **Integration**                               | Criar Article(status='draft'), buscar termo presente no draft, esperar 0 results                                                      | `assert results == []`                                                                      | T30.1.12                  |
| 5   | Cursor HMAC inválido → 400 (não 500, não 200)         | **Unit** (decode) + **Integration** (view)    | (a) `decode_cursor("forjado")` raises `InvalidCursor`; (b) GET com cursor=forjado → 400                                               | `assert response.status_code == 400; assert response.json()['code'] == 'invalid_cursor'`    | T30.1.7, T30.1.12         |
| 6   | `ROUND(score, 6)` simétrico em SELECT e cursor encode | **Unit** + Property-based                     | for any float score in [0,1]: `decode(encode(score)) == round(score, 6)`                                                              | `assert decoded == round(score, 6)`                                                         | T30.1.TY8                 |
| 7   | Empty tsquery early-exit (zero hit DB)                | **Integration** com `CaptureQueriesContext`   | `q="o de da"` (só stopwords) → `len(captured_queries) == 0`                                                                           | `with CaptureQueriesContext(connection) as ctx: ...; assert len(ctx.captured_queries) == 0` | T30.1.12                  |
| 8   | Cap 8 tokens significativos                           | **Unit**                                      | `cap_tokens("a b c d e f g h i j")` retorna lista ≤8                                                                                  | `assert len(tokens) <= 8`                                                                   | T30.1.11                  |
| 9   | Cap 50 páginas (cursor carrega depth)                 | **Integration**                               | Forjar cursor com `depth=51` HMAC válido → 400 "refine_query"                                                                         | `assert response.json()['code'] == 'refine_query'`                                          | T30.1.12                  |
| 10  | `half_life_days` em settings (não literal)            | **Unit** (grep) + Integration                 | `assert 'half_life_days' in inspect.getsource(SearchService)`; setting=30 → ranking diferente de setting=60                           | `assert results_30d != results_60d`                                                         | T30.1.11                  |
| 11  | `query_terms_expanded` na response                    | **Integration** + Contract                    | (a) Response inclui campo; (b) OpenAPI schema declara campo                                                                           | `assert 'query_terms_expanded' in response.json()`                                          | T30.1.X5, +TY9 (contract) |
| 12  | `statement_timeout='500ms'` no role                   | **Integration** (config check)                | `SELECT current_setting('statement_timeout')` retorna `'500ms'`                                                                       | `assert setting == '500ms'`                                                                 | TX-15                     |

**Resumo:** 12 invariantes → **8 testes unit**, **9 testes integration**, **3 testes property-based**, **1 teste contract**. Cobertura total dos invariantes obrigatória antes do PR mergear.

---

## §5. Edge cases + adversariais (consolidados de §4 algorithms + adições)

| Caso                                                                  | Esperado                                | Tipo de teste                   | Status no DESIGN         | Ação                                 |
| --------------------------------------------------------------------- | --------------------------------------- | ------------------------------- | ------------------------ | ------------------------------------ |
| `q=""`, `q=" "`, `q="a"`                                              | 400 `q_too_short`                       | Unit (serializer) + Integration | ✅ coberto               | manter T30.1.8                       |
| `q="!"` (só pontuação)                                                | 200 `results: []` + 0 queries DB        | Integration                     | ⚠️ guard novo (Inv 7)    | T30.1.12                             |
| `q="o de da"` (stopwords)                                             | idem                                    | Integration                     | ⚠️ idem                  | T30.1.12                             |
| `q` com 200 chars exatos                                              | 200 normal                              | Integration                     | ✅ coberto               | manter                               |
| `q` com 201+ chars                                                    | 400 `q_too_long`                        | Unit serializer                 | ✅ coberto               | manter T30.1.8                       |
| `q="' OR 1=1 --"` (SQL injection)                                     | 200, `plainto` escapa                   | Integration + Security          | ✅ coberto               | manter                               |
| `q="kpop:*&music"` (operadores tsquery)                               | 200, `plainto` ignora operadores        | Unit + Integration              | ✅ explicitar invariante | T30.1.11                             |
| Emoji `q="🎵 kpop"`                                                   | 200, ~match igual a `q="kpop"`          | Integration                     | ✅                       | T30.1.12                             |
| `q="Beyoncé"` (diacritic)                                             | matches "beyonce" via unaccent          | Integration                     | ✅                       | T30.1.12                             |
| `q="k-pop"` vs `q="kpop"`                                             | DEVE casar (Inv 2 normalize)            | Integration                     | ⚠️ aplicar simétrico     | T30.1.X2                             |
| Query 20 tokens (A2 adversarial)                                      | 400 `query_too_complex`                 | Unit (serializer cap 8)         | ✅ Inv 8                 | T30.1.11                             |
| Paginação profunda (depth >50)                                        | 400 `refine_query`                      | Integration                     | ✅ Inv 9                 | T30.1.12                             |
| Cursor forjado HMAC                                                   | 400 `invalid_cursor`                    | Integration                     | ✅ Inv 5                 | T30.1.12                             |
| Feature flag OFF                                                      | 503 + Retry-After                       | Integration                     | ⚠️ adicionar             | T30.1.X4 + TY10                      |
| 100 inserts entre pág 1 e 2                                           | Cursor estável, sem duplicata, sem pulo | Integration                     | ✅ Inv 1+6               | TY2 (nova)                           |
| Trigger SQL em bulk update (`Article.objects.update(status='draft')`) | search_index correto                    | Integration                     | ⚠️ trigger é a defesa    | T30.1.5b                             |
| Race signal vs trigger                                                | search_index consistente (trigger wins) | Integration                     | ⚠️ documentar            | T30.1.5c                             |
| Mobile iOS teclado virtual + filter sheet                             | sheet 75dvh + safe-area                 | E2E Playwright mobile           | ⚠️ novo                  | T30.1.X12 + TY11 (Playwright mobile) |
| Dark mode + `<mark>` contraste                                        | ≥4.5:1 medido                           | A11y unit + manual              | ✅ UI-UX confirmou 6.8:1 | TX-17                                |
| Adversário tenta XSS via `q`                                          | escaped no `<mark>`                     | E2E + Security                  | ⚠️ adicionar             | TY7                                  |
| Adversário burla rate limit via `X-Forwarded-For`                     | block mantido                           | Integration + Security          | ⚠️ adicionar             | TY7                                  |

---

## §6. Test pyramid concreto (números absolutos)

Estimativa **mínima de testes** para a feature, alinhada à pirâmide do `testing-standards.md §3` (70% unit / 25% integration / 5% E2E).

### 6.1 Por tipo (números absolutos)

| Tipo                     | Quantidade alvo                                             | Stack                         | Tempo CI estimado                                |
| ------------------------ | ----------------------------------------------------------- | ----------------------------- | ------------------------------------------------ |
| **Unit backend**         | 28                                                          | pytest                        | ~3s                                              |
| **Unit frontend**        | 22                                                          | Vitest + Testing Library      | ~5s                                              |
| **Integration backend**  | 24                                                          | pytest-django + Postgres real | ~25s                                             |
| **Contract**             | 4                                                           | schemathesis (OpenAPI)        | ~8s                                              |
| **E2E (Playwright)**     | 12                                                          | Chromium + Firefox            | ~90s                                             |
| **A11y unit**            | 8 (1 por estado)                                            | jest-axe                      | ~3s                                              |
| **A11y E2E**             | 3 (página principal × 2 temas + mobile dialog)              | axe-playwright                | ~20s                                             |
| **A11y manual**          | 2 sessões gravadas                                          | NVDA + VoiceOver              | n/a (offline)                                    |
| **Performance backend**  | 3 (pytest-benchmark + 1 load k6)                            | benchmark + k6 nightly        | ~5s (benchmark) + 5min (k6 fora do CI principal) |
| **Performance frontend** | 1 (lhci `/buscar?q=kpop`)                                   | Lighthouse CI                 | ~45s                                             |
| **Property-based**       | 5 invariantes                                               | Hypothesis                    | ~12s (100 examples cada)                         |
| **Mutation**             | 1 módulo (`SearchService`)                                  | mutmut                        | ~3min (nightly, não bloqueia merge)              |
| **Visual regression**    | 10 snapshots (5 estados × 2 temas)                          | Playwright `toHaveScreenshot` | ~30s                                             |
| **Smoke pós-deploy**     | 1 endpoint hit                                              | curl                          | ~1s                                              |
| **Security (SAST)**      | bandit + semgrep sobre `apps/search/` + `src/pages/Buscar/` | bandit/semgrep                | ~15s                                             |
| **TOTAL CI (PR)**        | **~110 testes**                                             | —                             | **~4min**                                        |
| **TOTAL nightly**        | +k6 load + mutation                                         | —                             | +8min                                            |

### 6.2 Distribuição vs pirâmide ideal

| Layer       | Ideal | Esta feature | Diagnóstico                                                                                                     |
| ----------- | ----- | ------------ | --------------------------------------------------------------------------------------------------------------- |
| Unit        | ~70%  | 50/110 = 45% | ⚠️ um pouco baixo; OK pois muita lógica é DB-bound (integration faz sentido)                                    |
| Integration | ~25%  | 28/110 = 25% | ✅                                                                                                              |
| E2E         | ~5%   | 15/110 = 14% | ⚠️ um pouco alto, mas justificado pelos 9 fluxos críticos de UX (busca, filtros, deep-link, mobile, rate-limit) |

**Justificativa do desvio do 70/25/5:** busca é feature com forte componente de UX (debounce, deep-link, mobile keyboard, dark/light, a11y) e DB-bound (não há lógica pura suficiente para encher unit). Aceitável dentro do princípio "pyramid ≠ camisa-de-força".

### 6.3 Gates de cobertura para esta feature

| Gate                                          | Valor                       | Comentário                                                          |
| --------------------------------------------- | --------------------------- | ------------------------------------------------------------------- |
| Cobertura backend `apps.search/` (line)       | **≥85%**                    | Acima do gate global (Sprint 4 = 75%); justificado pela criticidade |
| Cobertura frontend `src/pages/Buscar/` (line) | **≥80%**                    | Acima do gate global (Sprint 4 = 60%)                               |
| Mutation score `SearchService`                | **≥75%** (nightly, warning) | Não bloqueia merge; sinaliza testes tautológicos                    |
| Lighthouse a11y score                         | **≥95**                     | gate Lighthouse CI                                                  |
| Lighthouse perf score                         | **≥85**                     | gate Lighthouse CI                                                  |
| Bundle delta vs main                          | **≤20KB gz**                | TX-16                                                               |
| p95 backend k6                                | **≤300ms**                  | NFR explícito                                                       |
| p95 endpoint pytest-benchmark                 | **≤200ms**                  | budget DB §3.3                                                      |

---

## §7. Tasks novas a adicionar ao BACKLOG.md

> Convenção: `T30.1.TYN` (TY = "test yard", N sequencial). NÃO conflitam com `T30.1.X*` (refino arquitetural). Todas linkadas à US30.1 (entry point), expandindo conforme outras US ativam.

| ID             | Descrição                                                                                                                                                                                                                                                                                                 | Prioridade   | Tipo de teste     | Sprint |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ----------------- | ------ |
| **T30.1.TY1**  | Adicionar `hypothesis>=6.100` ao `backend/pyproject.toml` via `uv add hypothesis`. Configurar `conftest.py` com `settings(deadline=200, max_examples=100)` global                                                                                                                                         | 🟠 High      | Setup             | 4      |
| **T30.1.TY2**  | Escrever teste integration `test_cursor_stability_under_concurrent_inserts` — 100 artigos inseridos entre fetch página 1 e 2 (uses freezegun + factory_boy bulk_create + signal disabled hint), assert sem duplicata e sem pulo                                                                           | 🟠 High      | Integration       | 4      |
| **T30.1.TY3**  | Escrever 10 testes de regressão (1 por bug do DESIGN §0), com naming `test_regression_bug_NN_<descricao>`, cada um referenciando `# Ref: DESIGN.md v3 §0 Bug NN` em comentário                                                                                                                            | 🔴 Immediate | Regression        | 4      |
| **T30.1.TY4**  | Expandir `apps/audit/tests/test_health.py` com smoke `test_smoke_search_endpoint_responds_within_100ms` (após feature flag ligada)                                                                                                                                                                        | 🟡 Normal    | Smoke             | 4      |
| **T30.1.TY5**  | Gravar 2 sessões manuais (NVDA + VoiceOver) navegando `/buscar?q=kpop`, salvar em `docs/tests/a11y-recordings/2026-XX-XX_*.mp4`, checklist em `docs/tests/a11y-checklist-busca.md`                                                                                                                        | 🟠 High      | A11y manual       | 4      |
| **T30.1.TY6**  | Criar `scripts/seed-zipfian.py` que popula Postgres efêmero com 50k artigos distribuídos por frequência Zipf (top 100 termos = 70% das ocorrências). Documentar uso em `docs/tests/k6-load-test.md`                                                                                                       | 🟠 High      | Perf setup        | 4      |
| **T30.1.TY7**  | Adicionar testes de segurança: (a) SQL injection via `q` (integration); (b) XSS via highlight (E2E + unit); (c) HMAC cursor forjado (integration); (d) `X-Forwarded-For` spoofing no rate limit (integration); (e) CSP header presente (integration)                                                      | 🟠 High      | Security          | 4      |
| **T30.1.TY8**  | Escrever 5 testes property-based via Hypothesis: (1) `normalize_search_text` idempotência; (2) `normalize` simetria K-Pop/kpop com input gerado; (3) `encode_cursor → decode_cursor` round-trip preserva round(6); (4) determinismo `SearchService.query` × 5 runs; (5) cap_tokens ≤8 para qualquer input | 🟠 High      | Property-based    | 4      |
| **T30.1.TY9**  | Configurar **schemathesis** no CI (`pip install schemathesis`) executando `schemathesis run http://localhost:8000/api/schema/ --endpoint /api/v1/search/articles/ --hypothesis-max-examples=50`. Falha bloqueia merge                                                                                     | 🟠 High      | Contract          | 4      |
| **T30.1.TY10** | Escrever teste integration `test_search_returns_503_when_feature_disabled` — set `SEARCH_FEATURE_ENABLED=False`, GET endpoint → 503 + `Retry-After` header                                                                                                                                                | 🟠 High      | Integration       | 4      |
| **T30.1.TY11** | Escrever teste E2E Playwright mobile (`viewport: 390×844`) "Filter sheet abre com `<dialog>` + 75dvh + safe-area inset + fecha ao focar input"                                                                                                                                                            | 🟡 Normal    | E2E mobile        | 5      |
| **T30.1.TY12** | Configurar **mutmut** no `backend/pyproject.toml` apontando para `apps/search/services.py`. Adicionar GitHub Action nightly `mutation-test.yml` (não bloqueia merge, abre issue se score <75%)                                                                                                            | 🟡 Normal    | Mutation          | 5      |
| **T30.1.TY13** | Configurar **Playwright visual regression**: 10 screenshots (`empty/loading/results/no-results/error/rate-limited × light/dark`). Atualizar via `--update-snapshots` quando UI muda intencionalmente                                                                                                      | 🟡 Normal    | Visual regression | 4      |
| **T30.1.TY14** | Adicionar pre-commit hook `bandit -ll apps/search/ && semgrep --config p/django apps/search/`. Em CI: rodar como step próprio                                                                                                                                                                             | 🟡 Normal    | Security SAST     | 4      |
| **TX-19**      | Configurar `lhci` para **falhar** se `docs/performance/lighthouse-baseline-pre-busca.json` ausente (verificação `[ -f file ]` antes de `lhci assert`). Garante que TX-18 foi executada antes do gate ativar                                                                                               | 🔴 Immediate | Perf gate         | 4      |
| **TX-20**      | Documentar em `docs/tests/trigger-test-protocol.md` o padrão para testar trigger SQL: usar `--create-db` (não `--reuse-db`) no marker `requires_postgres_trigger`, OU `SET session_replication_role='replica'` em testes que querem desabilitar                                                           | 🟠 High      | Doc + protocol    | 4      |
| **TX-21**      | Skill nova `playwright-skill-tlc` instalada — registrar em `skills/playwright-skill-tlc/SKILL.md` link curto + comando de execução para o time. Já existe `e2e-testing-patterns` cobrindo padrões; esta adiciona estilo TLC oficial                                                                       | ⚪ Low       | Skill registry    | 5      |

**Resumo das adições:** **14 Tasks T30.1.TY** + **3 Tasks TX** = **17 Tasks novas**. Story points adicionais estimados: **+8** (Sprint 4).

---

## §8. ADRs novos a propor (test-strategy-related)

> Linkados ao `docs/planning/Improvement-system.md §11.0/§11.2`. Materializar via `documentation-engineer` + skill `create-adr`.

| ID proposto | Título                                                                                                                 | Status | Razão                                                                                                                                                                                                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ADR-035** | Property-based testing via Hypothesis para invariantes de domínio                                                      | new    | 5 invariantes do algorithms são definicionalmente propriedades, não casos. Hypothesis revela edge-cases via geração aleatória. Habilita §2.11 "Property-based" do testing-standards. Trigger: F-30.                                                                     |
| **ADR-036** | Contract testing via schemathesis sobre OpenAPI drf-spectacular                                                        | new    | OpenAPI ↔ openapi-typescript drift é silencioso. Schemathesis valida que toda resposta real bate com schema declarado. Habilita §2.11 "Contract test" do testing-standards. Trigger: F-30 + TX-07.                                                                      |
| **ADR-037** | Mutation testing via mutmut em módulos críticos (nightly, não bloqueia merge)                                          | new    | Cobertura 85% pode ser tautológica. Mutmut em `SearchService` valida que testes pegam mudanças semânticas reais. Habilita §2.11 "Mutation testing" do testing-standards. Trigger: F-30 (modulo crítico = ranking + cursor + HMAC).                                      |
| **ADR-038** | Visual regression via Playwright `toHaveScreenshot` para estados UI                                                    | new    | 5 estados × 2 temas = 10 superfícies. Refactor CSS pode quebrar silenciosamente. Stack já tem Playwright (Sprint 3+ planejado); reusar = zero custo de tooling extra. Alternativa Percy/Chromatic = SaaS pago. Habilita §2.11 "Visual regression" do testing-standards. |
| **ADR-039** | Protocolo de teste de trigger SQL (`requires_postgres_trigger` marker + `--create-db` ou `replication_role='replica'`) | new    | Trigger SQL é fonte de verdade (DESIGN §2.2). Testes precisam exercitar trigger real, MAS `--reuse-db` não recria triggers. Protocolo dedicado evita falsos negativos.                                                                                                  |
| **ADR-040** | Política de a11y E2E: axe-playwright + manual NVDA/VoiceOver gravados                                                  | new    | WCAG 2.2 AA é regra dura (§4 CLAUDE.md). Unit jest-axe pega 30% de violações. E2E pega DOM real; manual pega UX real. 3 camadas obrigatórias.                                                                                                                           |

---

## §9. Itens contestados do DESIGN (anti-sycophancy — Gabarito §0.2)

> Lealdade ao resultado, não ao ego. Os itens abaixo são onde o DESIGN v3 **subentrega** na dimensão teste. Sugestões com justificativa, não palpites.

### 9.1 `@axe-core/react` no MVP — **insuficiente sozinho**

O TX-17 declara `jest-axe` em unit. Isso pega ~30% das violações WCAG (regras estáticas DOM). **Falta**:

- `@axe-core/playwright` em E2E runtime (pega ARIA dinâmico, focus order, live regions sob mudança real).
- Auditoria manual com NVDA + VoiceOver (pega UX de SR que ferramenta automatizada não vê).

**Resposta:** TX-17 cobre unit; **adicionar TY5 (manual) + assertion axe-playwright dentro de T30.1.21/T30.1.22 (E2E)**. Sem isso, a a11y declarada é teórica.

### 9.2 k6 load test com seed Zipfiano — **sem ownership, sem feasibility CI**

O DESIGN §3.5 e TX-15 mencionam k6 + Zipf, mas:

- **Quem fornece o seed?** Não existe Task.
- **Como CI valida sem Postgres real com 50k artigos?** Sem solução proposta.

**Resposta:** TY6 cria `scripts/seed-zipfian.py`. CI **não roda k6 em todo PR** (custo proibitivo) — rodar em **nightly schedule** com Postgres efêmero docker-compose. PR só roda pytest-benchmark (microbench em 1k artigos, gate ≤200ms p95).

### 9.3 Mutation testing — **necessário no MVP**, não postergar

`SearchService` tem 5 invariantes de correção crítica (cursor, HMAC, ranking, normalização). Cobertura 85% pode ser **toda tautológica**. Mutation revela em ~3 min nightly.

**Resposta:** TY12 + ADR-037. Não bloqueia merge; abre issue se score <75%. Sprint 5 ativa por padrão.

### 9.4 Property-based — **lacuna grave do DESIGN**

Não há **nenhuma menção** no DESIGN v3 a property-based, apesar de 3 dos 12 invariantes serem propriedades por definição (determinismo, simetria, round-trip). Hypothesis cobre o que casos não cobrem.

**Resposta:** TY1 + TY8 + ADR-035. Sprint 4 obrigatório.

### 9.5 Contract testing — **drf-spectacular ↔ openapi-typescript sem prova**

TX-06 e TX-07 declaram o pipeline. Mas **quem garante que o OpenAPI gerado reflete a view real?** Mudança em `SearchSerializer.Meta.fields` que o spectacular não detecte vira drift silencioso entre tipo TS e response real.

**Resposta:** TY9 + ADR-036. schemathesis roda no CI sobre OpenAPI gerado, valida 50 exemplos por endpoint. Bloqueia merge.

### 9.6 Visual regression — **5 estados × 2 temas frágeis**

5 estados (empty/loading/results/no-results/error/rate-limited) × 2 temas × 2 viewports = **24 superfícies visuais**. Refactor de CSS (token rename, paleta tweak) pode quebrar silenciosamente. Manual review em PR não escala.

**Resposta:** TY13 + ADR-038. Playwright `toHaveScreenshot` (zero custo de tooling — já temos Playwright). Stack alternativa Percy/Chromatic = SaaS pago, postergar.

### 9.7 Lighthouse CI a11y score — **TX-16 só declara perf**

TX-16 fala em LCP/INP/CLS. **Falta**: `--assert.preset=lighthouse:no-pwa` com `categories:accessibility.minScore: 0.95`.

**Resposta:** Reescrever TX-16: incluir `accessibility >= 95` no gate `lighthouserc.json`.

### 9.8 Coverage gate desta feature — **80% inicial é baixo para crítica**

BACKLOG fala 40%→80% até pós-Sprint 4. Mas **busca é módulo crítico** (RNF p95 + segurança HMAC + LGPD + WCAG). Sprint 4 atual = 75% global; **esta feature deve entregar ≥85%** localmente em `apps/search/` (não bloqueia gate global).

**Resposta:** Gate local `apps/search/` ≥85%, `src/pages/Buscar/` ≥80%. Adicionar ao `.coveragerc` ou via pytest-cov `--cov-fail-under=85 --cov=apps.search`.

### 9.9 TX-18 (baseline Lighthouse) — **não verificável por CI sem novo gate**

TX-18 manda medir baseline e salvar JSON. **Mas como CI sabe que foi feito?** Sem gate, alguém pode pular e o `lhci` rodaria comparando com nada.

**Resposta:** TX-19 (nova) — `lhci` falha se arquivo ausente. Garante TX-18 executada como pré-requisito.

### 9.10 Teste de trigger SQL — **conflito com `--reuse-db`**

`pytest-django --reuse-db` cacheia DB entre runs (5× mais rápido). Mas DB cacheado **não tem trigger novo** após migration M003. Testes de trigger silenciosamente passam por nada.

**Resposta:** TX-20 (nova) — marker `requires_postgres_trigger` força `--create-db` para esses testes. Documentar em `docs/tests/trigger-test-protocol.md`.

### 9.11 SQLite-dev fallback — **risco de CI rodar suite parcial**

`__icontains` é fallback em dev. Marker `requires_postgres` skipa testes FTS em SQLite. Mas **quem garante que CI sempre roda no Postgres**? `.github/workflows/ci.yml` precisa de assertion explícita.

**Resposta:** Adicionar em `ci.yml` step `assert: postgres` via `python -c "import django; from django.db import connection; assert connection.vendor == 'postgresql'"` antes de pytest. Se falhar, CI quebra.

### 9.12 Feature flag — **sprint indefinido para teste**

T30.1.X4 declara a flag. **Mas qual sprint testa o 503 path?** Sem isso, flag vira código morto.

**Resposta:** TY10 (nova) — teste integration explícito do 503. Sprint 4.

---

## §10. Open questions ao usuário (escalar ANTES de implementação)

1. **Postgres real em CI**: o `docker-compose.dev.yml` planejado (TX-09) é suficiente, ou precisa de `services: postgres:` no `.github/workflows/ci.yml`? Se sim, levanta tempo de CI de 4min → 6min. Aceitável?

2. **Playwright em CI**: o `testing-standards.md §2.5` diz "Sprint 3+", "roda só em PR pra main (não em todo push)". F-30 é **Sprint 4**. Confirmar: Playwright ativa em todo PR de `develop`→`develop` ou só em `develop`→`main`?

3. **Mutation testing nightly** custa ~3min. Aceitar custo no GitHub Actions free tier? Ou usar `mutmut` local somente?

4. **k6 nightly** com seed Zipfiano de 50k requer Postgres efêmero por 5min. CI cost ≈ negligível. Confirmar habilitar?

5. **Visual regression baseline**: snapshots iniciais ficam no git? Tamanho ~50KB × 24 = 1.2MB. Aceitável OU usar git-lfs?

6. **NVDA/VoiceOver gravações** (TY5): você tem acesso a Windows (NVDA) + macOS (VoiceOver) OU precisa contratar terceiro? Se sim, postergar para Sprint 5 e marcar bloqueio.

7. **A11y manual cadence**: 1 vez na entrega da F-30, ou trimestral? Recomendação: 1× entrega + trimestral em regressão.

8. **Schemathesis cap de exemplos**: 50 por endpoint é razoável (~8s). Subir para 100 (+CI time)?

9. **`SEARCH_FEATURE_ENABLED` default**: False em prod até backfill terminar (DESIGN §2.2 fase 5). Em dev/test, qual default? Recomendação: dev=True, test=True (marker `feature_flag_off` para os 2 testes que precisam False).

10. **`pa11y` vs `@axe-core` manual contraste**: para o `<mark>` test, qual ferramenta cataloga o relatório? Recomendação `pa11y` (CLI, output JSON arquivável).

11. **Sintetizar seed Zipfiano de termos**: usar **lista de termos pop-cultura real** (kpop, beyoncé, frança, óscar...) ou tokens lorem-ipsum? Recomendação: real (50 termos top-100 + 950 long-tail aleatórios). Pede curadoria do PM.

12. **`audit/test_health.py` ownership** do smoke search: criar arquivo novo `apps/search/tests/test_smoke.py` ou amplifiar `audit/test_health.py`? Recomendação: novo arquivo, locality.

---

## §11. Handoff ao `code-implementer` — ordem de Tasks 🔴 Immediate

O `code-implementer` deve iniciar com **TDD** estrito. A ordem abaixo é **vinculante**:

### Fase 0 — Setup de teste (antes de qualquer linha de produção)

1. **TY1** — `uv add hypothesis pytest-benchmark schemathesis mutmut` no backend; `npm add -D @axe-core/react jest-axe msw @axe-core/playwright @playwright/test` no frontend.
2. **TX-09** + **TX-18** — `docker-compose.dev.yml` rodando + baseline Lighthouse capturado em JSON.
3. **TX-19** — gate Lighthouse falha se JSON ausente (proteção contra ordem errada).
4. **TX-20** — `docs/tests/trigger-test-protocol.md` escrito.

### Fase 1 — DB schema (Sprint 4, dia 1)

5. **T30.1.4b** — `CONFIGURATION pt_unaccent` + função `articles_search_config`.
6. **T30.1.5b** — Trigger SQL `trg_articles_sync_search`.
   - **TDD obrigatório**: escrever teste integration `test_trigger_populates_index_on_publish` ANTES da migration (vermelho), com marker `requires_postgres_trigger`.
7. **T30.1.X2** — `normalize_search_text` utilitário.
   - **TDD obrigatório**: teste unit + property-based (TY8 #1, #2) ANTES.
8. **T30.1.5c** — Signal Python (só cache invalidation).

### Fase 2 — Backend leitura (Sprint 4, dias 2-4)

9. **T30.1.7** — `SearchService.query()` + cursor HMAC.
   - **TDD obrigatório** por cada invariante (1-12): 12 testes vermelhos antes do verde.
   - **TY8 #3 e #4** — property-based de cursor round-trip e determinismo.
   - **TY3** — 10 testes de regressão dos bugs do DESIGN §0.
10. **T30.1.8** — `SearchQuerySerializer` com cap 8 tokens.
11. **T30.1.9** — `SearchView` + endpoint `/api/v1/search/articles/`.
12. **T30.1.X4** — Feature flag + **TY10** teste 503.
13. **TX-15** — Postgres role tuning + integration test invariante 12 (statement_timeout).
14. **T30.4.1-4** — Throttle DRF + **TY7** rate limit bypass test.

### Fase 3 — Contract + Performance backend (paralelo à fase 2)

15. **TX-06** — drf-spectacular configurado.
16. **TY9** — schemathesis no CI.
17. **TY6** — `seed-zipfian.py` + k6 nightly setup.
18. **TY14** — bandit + semgrep pre-commit + CI.

### Fase 4 — Frontend MVP (Sprint 4, dias 5-7)

19. **T30.1.X6** — `useDebouncedValue` hook + **unit test (TDD vermelho primeiro)**.
20. **T30.1.X7** — `useSearch` com `getNextPageParam` fix Bug 6 + **regression test TY3**.
21. **T30.1.X8** — `<input type="search">` (sem `role="combobox"`).
22. **TX-17** — `jest-axe` em 6+ estados (incluir 2 que TX-17 esqueceu — dialog + mark).
23. **TY13** — Playwright visual regression 10 snapshots.

### Fase 5 — E2E + A11y manual (Sprint 4, fim)

24. **T30.1.21** + **T30.1.22** — E2E happy path + skeleton.
25. **T30.3.5** + **T30.3.6** — E2E empty + rate limited.
26. **T30.1.23** + **axe-playwright** dentro destes E2E (não Task separada).
27. **TY5** — Sessões NVDA + VoiceOver gravadas.

### Fase 6 — Performance gates ativam (Sprint 4, final)

28. **TX-16** — `lhci` ativo com gate `LCP≤2.5s, INP≤200ms, CLS≤0.1, a11y≥95, perf≥85, bundle ≤+20KB`.
29. Confirmar `apps/search/` cov ≥85% + `src/pages/Buscar/` cov ≥80%.

### Fase 7 (Sprint 5) — Mutation + Mobile + Filtros

30. **TY12** mutmut nightly.
31. **TY11** E2E mobile dialog.
32. Tasks de F-31/F-32 (filtros, deep-link) — mesma disciplina de cada Task: teste vermelho primeiro.

---

## §12. Definition of Done (perspectiva de teste)

PR de qualquer Task da F-30 **só mergea se**:

- [ ] Cobertura `apps/search/` ≥85% e `src/pages/Buscar/` ≥80% — não baixa em nenhum PR.
- [ ] 12 invariantes do algorithms cobertos (mapping §4).
- [ ] 10 testes de regressão dos bugs do DESIGN §0 verdes (TY3).
- [ ] axe-core sem violação **em todos os 8 estados** (6 do TX-17 + dialog + mark).
- [ ] axe-playwright sem violação em E2E principal.
- [ ] Lighthouse CI passa: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1, a11y ≥95, perf ≥85, bundle delta ≤20KB.
- [ ] pytest-benchmark `SearchService.query` p95 ≤200ms (1k seed).
- [ ] Schemathesis sem violação de contrato.
- [ ] bandit + semgrep sem severity ≥MEDIUM.
- [ ] Sem flake: rodar suite 10× consecutivos → 100% pass (`pytest --count=10` ou loop bash).
- [ ] Testes referenciam RF/RNF/CA/Invariante em docstring ou comentário.
- [ ] Naming respeitando convenção `test_<unidade>_<comportamento>_<contexto>`.
- [ ] Manual NVDA + VoiceOver sessão gravada (TY5) — só na entrega da feature, não por PR.

---

## §13. Cross-refs canônicos

- [`DESIGN.md`](./DESIGN.md) — v3 com 12 invariantes (§2.3), 10 bugs (§0), 20 ADRs (§4), 14 open questions (§5).
- [`BACKLOG.md`](./BACKLOG.md) — EP-10 + 100 Tasks US-bound + 18 TX (após esta estratégia: +14 TY + 3 TX = 117 + 21).
- [`docs/tests/testing-standards.md`](../../tests/testing-standards.md) — política mestre.
- [`CLAUDE.md`](../../../CLAUDE.md) — §0 Gabarito + §6 testes inegociáveis.
- `_specialist-outputs/02-algorithms-architect.md §8-9` — origem dos 12 invariantes e 13 testes que esta estratégia expande para 110.
- `_specialist-outputs/03-frontend-architect.md §9` — origem das 5 estados de a11y e do plano MSW + axe que esta estratégia amplia para 8 estados e adiciona Playwright.
- `_specialist-outputs/04-ui-ux-architect.md §5-6` — base WCAG dos contrastes (light 9.4:1, dark 6.8:1) que esta estratégia confirma como auditável.

---

**Versão**: v1 · **Data**: 2026-06-03 · **Próxima revisão**: após primeira implementação de T30.1.7 (gate de feedback ao testing-engineer).

**Assinatura semântica**: testing-engineer sub-agent · sessão orquestrada · 15 skills invocadas · 9 ressalvas anti-sycophancy · 17 Tasks novas propostas · 6 ADRs novos propostos · 110 testes estimados na pirâmide · cobertura local-feature 85% backend + 80% frontend exigida.
