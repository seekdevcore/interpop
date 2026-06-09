# EP-02 — Publicação editorial

> **Tipo**: Epic
> **Status**: ✅ Done em produção (Sprint 1-2, pre-busca) · 🚧 manutenção contínua (OPS-1 hotfix candidato)
> **Prioridade global**: 🔴 Imediato (núcleo editorial — sem isto não há produto)
> **Owner**: Gabriel Marques
> **Criado em**: Sprint 1 (bootstrap) · **Formalizado retroativamente**: 2026-06-09

---

## Visão de produto

Interpop é veículo editorial brasileiro de análise crítica de Soft Power e cultura pop. **Publicação editorial é o produto** — sem ela, não há leitor, retenção, newsletter, comentário ou busca. Este Epic materializa o ciclo completo: editor cria rascunho, publica, sistema avisa assinantes, leitor encontra via URL humana com slug em português, redes sociais mostram cartão rico, ranking "mais lidos" reflete leitura real (não F5).

Cinco editorias canônicas (Música, Moda, Cinema, Literatura, Cultura Digital) sustentam a identidade visual e taxonômica da marca. Vocabulário fixo é decisão deliberada (ADR-002): caos taxonômico de tag livre dilui SEO e identidade.

KPIs sustentados por este Epic:

- 100% dos artigos com `status=published` têm `published_at` preenchido (invariante I1) — **achado OPS-1**: hoje só vale via API; admin Django deixa NULL
- Cartão social renderiza corretamente em ≥ 95% dos compartilhamentos (Twitterbot, WhatsApp, facebookexternalhit, LinkedInBot, Slackbot, Discordbot, TelegramBot, Pinterest, redditbot, Applebot)
- `view_count` reflete leitura real — bucket anti-abuse 5min/(article,IP) impede inflação
- Apenas 1 artigo em destaque (`is_featured=True`) por vez — garantido por `transaction.atomic` em `Article.save()`

---

## Requisitos realizados (rastreabilidade ↑)

| ID                                                             | Requisito                                                                             | Tipo            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------- |
| [RF-001](../../requirements/RF/RF-001-articles.md)             | Sistema permite publicação editorial + leitura via slug humano + OG meta + view_count | Funcional       |
| [RNF-perf](../../requirements/RNF/RNF-perf.md)                 | Listing público p95 ≤ 200ms server; LCP/INP/CLS dentro dos gates                      | Performance     |
| [RNF-security](../../requirements/RNF/RNF-security.md)         | OWASP + `IsPublisherOrReadOnly` + `IsOwnerOrAdmin` object-level + escape XSS em body  | Segurança       |
| [RNF-a11y](../../requirements/RNF/RNF-a11y.md)                 | WCAG 2.2 AA na página de artigo + landmarks + contraste                               | Acessibilidade  |
| [RNF-lgpd](../../requirements/RNF/RNF-lgpd.md)                 | IP do leitor usado apenas como chave de bucket; não persistido em log de leitura      | LGPD            |
| [RNF-availability](../../requirements/RNF/RNF-availability.md) | Crawler social funciona mesmo com SPA quebrada (middleware server-side)               | Disponibilidade |

---

## Features sob este Epic (rastreabilidade ↓)

| ID   | Nome                            | Sprint | Status                          | Arquivo                                                |
| ---- | ------------------------------- | ------ | ------------------------------- | ------------------------------------------------------ |
| F-10 | Publicação e leitura de artigos | 1-2    | ✅ Done (Sprint 1-2, pre-busca) | [F-10](../features/F-10-publicacao-leitura-artigos.md) |

> **Decisão deliberada de granularidade**: F-10 consolida 4 capacidades em **uma única Feature** (publicação, leitura, view_count anti-abuse, OG meta + crawler middleware) porque na realidade do código essas 4 responsabilidades vivem no mesmo app (`apps.articles`) e foram entregues juntas no mesmo Sprint. Decompor retroativamente em F-10/F-11/F-12/F-13 seria ficção documental. A própria spec retroativa ([DESIGN.md](../../specs/articles/DESIGN.md) §0) reconhece esse acoplamento como **dívida arquitetural OPS-2** (candidato a `apps/seo/` futuro), não como design intencional.

### Sub-capacidades cobertas por F-10

| Sub-capacidade                                 | Sub-CAs em F-10 | Componentes técnicos                                                                                                                         |
| ---------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅ Publicação editorial (draft → published)    | CA01-CA04       | `ArticleWriteSerializer`, `ArticleDetailView.perform_update`, signals `pre_save`+`post_save`, Celery dispatch (ADR-009)                      |
| ✅ Leitura via URL com slug humano             | CA02, CA05      | Conversor `<uslug:>` (`converters.py`), rota `/noticia/<slug>`, `_unique_slug()` auto-sufixa                                                 |
| ✅ Categorização editorial (5 editorias fixas) | CA08, CA09      | `Category` model, data migration `0003_seed_pop_culture_categories`, admin `prepopulated_fields`                                             |
| ✅ View_count anti-abuse                       | CA06, CA12      | `ArticleViewCountView`, bucket `cache.add(key, True, 300)`, `apps.audit.get_client_ip`, `F('view_count')+1` atômico                          |
| ✅ OG meta tags + crawler middleware           | CA07            | `SocialOGMiddleware`, regex `_CRAWLER_RE` (10 user agents), `_render_og_html`, sitemap.xml + robots.txt apontando para frontend (`SITE_URL`) |
| ✅ Hero único (apenas 1 featured por vez)      | CA11            | `Article.save()` override + `transaction.atomic` (ADR-012)                                                                                   |

---

## Métricas de sucesso do Epic

| Métrica                                                                        | Alvo          | Como medir                                                                                                   | Status                                                                                                         |
| ------------------------------------------------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| 100% dos artigos `status=published` têm `published_at != NULL` (invariante I1) | 100%          | Query `Article.objects.filter(status='published', published_at__isnull=True).count() == 0`                   | 🟠 **violado por admin Django** (OPS-1 — hotfix candidato)                                                     |
| Apenas 1 artigo `is_featured=True` por vez (invariante I2)                     | 100%          | `Article.objects.filter(is_featured=True).count() <= 1`                                                      | ✅ ok (testes `test_marking_article_featured_unsets_previous` + `test_only_one_featured_after_multiple_marks`) |
| Editor X não toca artigo de editor Y via API (invariante I7)                   | 100%          | `IsOwnerOrAdmin` object-level + testes `test_editor_cannot_update_other_editors_article`, `_cannot_delete_`  | ✅ ok                                                                                                          |
| Cartão social renderiza OG meta em crawler conhecido (invariante I5)           | ≥ 95% UA hits | Manual via `curl -A "WhatsApp/2.0" .../noticia/<slug>/` em prod                                              | 🟡 **sem teste automatizado** (GAP-1)                                                                          |
| View_count não infla por F5 do mesmo IP em 5min (invariante I4 + I8)           | bucket OK     | Teste `test_view_count_incremented_once_per_5min_window`; em prod limitado por LocMemCache per-worker (S-06) | 🟡 **vaza entre workers gunicorn** (S-06 — A20 Redis resolve)                                                  |
| Crawler de WhatsApp resolve preview em ≤ 1.5s sob carga                        | p95 ≤ 1.5s    | Sentry transactions tag `crawler:true`                                                                       | ⏳ baseline pendente                                                                                           |

---

## ADRs relacionadas (decisões locked-in)

ADRs vivem em [`docs/planning/Improvement-system.md`](../../planning/Improvement-system.md) (gitignored — débito O-01 em CONCERNS). Destaques por camada:

- **Domínio**: ADR-002 (tags livres deferidas), ADR-014 (`body` texto puro), ADR-012 (`transaction.atomic` em save com side-effect múltiplo)
- **Backend**: ADR-010 (prefixo `/api/v1/`), ADR-009 (newsletter Celery `.delay()` substituiu chamada síncrona — C12)
- **Read-projection vizinha**: ADR-018 (`SearchIndex` mantido por trigger PL/pgSQL, não signal)
- **Operacional**: ADR-020 (UUID em PK), A20 (Redis para cache distribuído — resolve S-06)

---

## Sprints envolvidas

| Sprint   | Escopo                                                                                                                                                                                                           | Status  |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Sprint 1 | Bootstrap `apps.articles`: `Article` + `Category` models, migrations 0001/0002, serializers, views, admin, URLs `/api/v1/`                                                                                       | ✅ Done |
| Sprint 2 | Pivô editorial: 5 categorias canônicas (`0003`), `cover_caption` obrigatório (`0004`), `SocialOGMiddleware`, sitemap.xml + robots.txt, conversor `<uslug:>` unicode                                              | ✅ Done |
| Sprint 4 | Refactor adjacente: `send_article_notification` migrou para Celery `.delay()` (C12); read-projection `apps.search` via trigger PL/pgSQL (ADR-018) — **não toca F-10 diretamente**, mas afeta fluxo de publicação | ✅ Done |

---

## Débitos ativos (cross-ref [CONCERNS.md](../../specs/codebase/CONCERNS.md))

| #     | Item                                                                                                                       | Severidade | Quando virar Sprint?                                                                                     |
| ----- | -------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------- |
| OPS-1 | Publicar via Django admin **não preenche `published_at`** (artigo somem da ordenação default `-published_at, -created_at`) | 🟠 Alta    | **Hotfix candidato Sprint 5** (override `ArticleAdmin.save_model` ou mover lógica para `Article.save()`) |
| S-01  | `body` aceita HTML cru no boundary serializer (React escapa hoje, mas é defesa única)                                      | 🔴 Crítica | Quando `body` virar JSON estruturado (ADR-014)                                                           |
| S-06  | `view_count` bucket vaza entre workers gunicorn (LocMemCache per-process — 3 workers infla 3×)                             | 🟠 Alta    | A20 — Redis para cache distribuído                                                                       |
| D-10  | Newsletter envia link de capa quebrado (`cover_image.url` é relativo, email não resolve)                                   | 🟠 Alta    | Hotfix candidato Sprint 5                                                                                |
| OPS-2 | Acoplamento de responsabilidades em `apps.articles` (SEO + sitemap + robots + middleware OG)                               | 🟡 Normal  | Refactor para `apps/seo/` quando custo justificar                                                        |
| OPS-3 | `SITE_URL` com fallback `localhost:5173` hardcoded em 3 lugares; esquecer var em prod publica URL de dev                   | 🟠 Alta    | `raise ImproperlyConfigured` em `production.py`                                                          |
| GAP-1 | Sem teste automatizado para crawler social vê OG meta (regressão silenciosa no middleware)                                 | 🟡 Normal  | Sprint de hardening de testes                                                                            |

---

## Histórico de mudanças

| Data       | Evento                                                                                                                                 |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Sprint 1   | Epic iniciado implicitamente no bootstrap de `apps.articles` (sem documentação formal — débito retroativo)                             |
| Sprint 2   | Pivô editorial cristalizou 5 editorias canônicas; `SocialOGMiddleware` + sitemap entram em produção                                    |
| Sprint 4   | Newsletter virou assíncrona (Celery `.delay()`); `apps.search` instala trigger PL/pgSQL como read-projection                           |
| 2026-06-09 | EP-02 formalizado retroativamente (esta entrega); cross-ref RF-001 + F-10 + [DESIGN.md](../../specs/articles/DESIGN.md) materializadas |

---

## Cross-references

- [RF-001](../../requirements/RF/RF-001-articles.md) — requisito de negócio
- [F-10](../features/F-10-publicacao-leitura-artigos.md) — Feature consolidada (4 sub-capacidades)
- [DESIGN.md](../../specs/articles/DESIGN.md) — spec retroativo (fonte de verdade técnica)
- [CONCERNS.md](../../specs/codebase/CONCERNS.md) — débitos S-01, S-06, S-11, D-07, D-10, OPS-1..3
- [ARCHITECTURE.md](../../specs/codebase/ARCHITECTURE.md) — grafo de apps (Ca=4 / Ce=3 / I=0.43)
- [Improvement-system.md](../../planning/Improvement-system.md) — backlog mestre pré-reorg
- Epics vizinhos: [EP-03 engajamento](EP-03-engajamento-comunidade.md) (`comments` consome Article), [EP-04 newsletter](EP-04-newsletter-comunicacao.md) (signal `post_save` enfileira `.delay()`), [EP-10 busca editorial](EP-10-busca-editorial.md) (read-projection via trigger PL/pgSQL)

---

_Formalizado retroativamente em 2026-06-09. EP-02 é Epic de **infraestrutura editorial** — quase estável, mas com 2 hotfix candidates (OPS-1, D-10) que justificam Sprint de housekeeping antes de evoluções maiores._
