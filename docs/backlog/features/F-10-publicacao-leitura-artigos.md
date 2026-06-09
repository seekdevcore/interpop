# F-10 — Publicação e leitura de artigos

> **Tipo**: Feature consolidada (4 sub-capacidades)
> **Epic pai**: [EP-02 Publicação editorial](../epics/EP-02-publicacao-editorial.md)
> **Sprint de execução**: Sprint 1-2 (pre-busca) — bootstrap + pivô editorial
> **Status**: ✅ Done em produção · 🚧 2 hotfix candidates ativos (OPS-1, D-10)
> **Prioridade**: 🔴 Imediato (núcleo editorial)

---

## Descrição (visão de produto)

Editor (papel `editor`, `admin` ou `dev`) cria rascunho de artigo preenchendo título, resumo, corpo de texto, imagem de capa com legenda obrigatória, e escolhe uma das 5 editorias canônicas (Música, Moda, Cinema, Literatura, Cultura Digital). Quando publica, o sistema carimba o momento da publicação, dispara notificação assíncrona para assinantes da newsletter, e o artigo passa a aparecer no listing público.

Leitor (anônimo ou autenticado) acessa o artigo via URL pública `/noticia/<slug-humano>`, com slug em português (`/noticia/a-nova-hegemonia-coreana-no-spotify`). Cada leitura conta como visualização, mas o mesmo IP só conta uma vez a cada 5 minutos para impedir inflação por F5. Quando alguém compartilha o link em WhatsApp/Twitter/Facebook/LinkedIn/Telegram/Discord/Slack, o robô do aplicativo recebe HTML enriquecido com Open Graph e Twitter Card — independente da SPA do navegador.

Esta é a **Feature consolidada** que materializa todo o ciclo editorial. As 4 sub-capacidades cobertas (publicação, leitura, view_count, OG meta) são acopladas no app `apps.articles` por razões históricas — refactor para `apps/seo/` é débito OPS-2 documentado.

---

## Requisitos atendidos (rastreabilidade ↑)

| ID                                                             | Requisito                                                                                        | Relação                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| [RF-001](../../requirements/RF/RF-001-articles.md)             | Sistema permite publicação editorial + leitura via slug humano + OG meta + view_count anti-abuse | Realiza diretamente (todas as 5 subseções) |
| [RNF-perf](../../requirements/RNF/RNF-perf.md)                 | Listing público p95 ≤ 200ms; índices `(status, -published_at)` + `(author, status)`              | Realiza CA12                               |
| [RNF-security](../../requirements/RNF/RNF-security.md)         | `IsPublisherOrReadOnly` + `IsOwnerOrAdmin` object-level; escape XSS no boundary                  | Realiza CA13                               |
| [RNF-a11y](../../requirements/RNF/RNF-a11y.md)                 | WCAG 2.2 AA na página de artigo; landmarks; contraste em legenda                                 | Realiza implícito (frontend)               |
| [RNF-lgpd](../../requirements/RNF/RNF-lgpd.md)                 | IP do leitor usado apenas como chave de bucket (5 min TTL); não persistido                       | Realiza CA06                               |
| [RNF-availability](../../requirements/RNF/RNF-availability.md) | Crawler social tem path server-side dedicado; SPA quebrada não impede preview                    | Realiza CA07                               |

---

## Critérios de Aceitação (CAs)

| ID       | Critério                                                                                                                                                                                                                                               | Como verificar                                                                                         | Status                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| **CA01** | Editor publica artigo com título, corpo de texto, autor, editoria, capa e legenda da capa (capa + legenda obrigatórias na criação)                                                                                                                     | `test_create_article_requires_cover_image_and_caption`                                                 | ✅                                                                                   |
| **CA02** | Slug é gerado automaticamente a partir do título (kebab-case, único — sufixa `-1`, `-2` em caso de colisão), aceita acentuação portuguesa                                                                                                              | DB constraint `unique=True` + `_unique_slug()` + conversor `<uslug:>`                                  | ✅                                                                                   |
| **CA03** | Mudança de status `draft → published` via API carimba `published_at = now()` automaticamente                                                                                                                                                           | `test_article_publish_triggers_send_article_notification_once`                                         | 🟠 **violado via Django admin** (OPS-1 — hotfix candidato)                           |
| **CA04** | Artigo com `status=published` nunca tem `published_at NULL` (invariante I1)                                                                                                                                                                            | Query `Article.objects.filter(status='published', published_at__isnull=True).count() == 0`             | 🟠 violado por OPS-1 (mesma causa de CA03)                                           |
| **CA05** | Leitor lê artigo via `/noticia/<slug>` em qualquer dispositivo; slug em português (`/noticia/o-novo-disco-da-céu`) funciona                                                                                                                            | Conversor `UnicodeSlugConverter` registrado em `apps.py:17`                                            | ✅                                                                                   |
| **CA06** | `view_count` incrementa apenas 1× por tupla (article, IP, janela 5 min) — bucket anti-abuse                                                                                                                                                            | `test_view_count_incremented_once_per_5min_window`                                                     | 🟡 **vaza entre workers gunicorn** (S-06 — Redis resolve)                            |
| **CA07** | Crawler social conhecido (Twitterbot, WhatsApp, facebookexternalhit, LinkedInBot, Slackbot, Discordbot, TelegramBot, Pinterest, redditbot, Applebot) recebe HTML com OG/Twitter Card meta — interceptado por `SocialOGMiddleware` em `/noticia/<slug>` | Manual `curl -A "WhatsApp/2.0" .../noticia/<slug>/`                                                    | 🟡 **sem teste automatizado** (GAP-1)                                                |
| **CA08** | Sistema oferece exatamente 5 editorias canônicas (Música, Moda, Cinema, Literatura, Cultura Digital) — data migration `0003` idempotente                                                                                                               | Migration `0003_seed_pop_culture_categories.py` (linhas 1-19)                                          | ✅                                                                                   |
| **CA09** | Cada editoria tem cor e ícone próprios na UI (tokens `--clr-cat-*`)                                                                                                                                                                                    | Tokens em `src/styles/global.css`                                                                      | ✅                                                                                   |
| **CA10** | Imagem de capa tem fallback se ausente; serializer força `cover_image` + `cover_caption` obrigatórios na criação                                                                                                                                       | `ArticleWriteSerializer.validate` linha 60 (`is_create = self.instance is None`)                       | ✅                                                                                   |
| **CA11** | Apenas 1 artigo `is_featured=True` por vez (invariante I2) — setar como `True` desmarca todos os outros em uma única transação atômica                                                                                                                 | `test_marking_article_featured_unsets_previous`, `test_only_one_featured_after_multiple_marks`         | ✅                                                                                   |
| **CA12** | Ordenação default em listings: `-published_at, -created_at`                                                                                                                                                                                            | `Article.Meta.ordering` (`models.py:65`)                                                               | ✅                                                                                   |
| **CA13** | Corpo de texto (`body`) é tratado como texto puro — frontend escapa via JSX (defesa em camada única, débito S-01 documentado)                                                                                                                          | Inspeção manual: zero `dangerouslySetInnerHTML` em `src/`                                              | 🟡 **defesa única** (S-01 — quando `body` virar JSON estruturado, sanitização migra) |
| **CA14** | Anon **não vê** rascunhos; editorial autenticado (`user.can_publish`) vê drafts seus na listagem                                                                                                                                                       | `test_list_articles_anon_returns_only_published`, `_editor_sees_drafts`, `_reader_does_not_see_drafts` | ✅                                                                                   |
| **CA15** | Editor X não edita/apaga artigo de editor Y via API — `IsOwnerOrAdmin` object-level garante                                                                                                                                                            | `test_editor_cannot_update_other_editors_article`, `_cannot_delete_`                                   | ✅                                                                                   |

---

## User Stories

### US10.1 — Editor publica artigo editorial (draft → published)

> **Como** editor (papel `editor`, `admin` ou `dev`)
> **Quero** criar um rascunho de artigo e publicá-lo quando estiver pronto
> **Para** entregar conteúdo editorial revisado ao leitor e disparar notificação automática para a newsletter.

- **Prioridade**: 🔴 Imediato
- **Estimativa**: 13 Story Points (consolidada — bootstrap completo)
- **Sprint**: 1-2 (pre-busca)
- **Status**: ✅ Done
- **CAs cobertos**: CA01, CA02, CA03, CA04, CA10, CA11, CA13, CA14, CA15
- **Persona**: [editor + admin + dev](../../requirements/personas-e-cenarios.md)

#### Cenários BDD (Gherkin pt-BR)

```gherkin
Funcionalidade: Publicação de artigo editorial
  Como editor do Interpop
  Quero criar e publicar artigos
  Para entregar conteúdo revisado ao leitor

Cenário: Editor cria rascunho com todos os campos obrigatórios
  Dado que estou autenticado como editor "ana@interpop.com.br"
  Quando envio POST para "/api/v1/articles/" com título, resumo, corpo, capa, legenda da capa e editoria "Música"
  Então recebo 201 Created
  E o artigo tem status="draft"
  E o slug é gerado automaticamente a partir do título
  E o campo published_at está vazio
  E o autor do artigo é "ana@interpop.com.br"

Cenário: Editor publica rascunho via API
  Dado que existe um artigo draft de minha autoria com slug "sobre-o-bts"
  Quando envio PATCH "/api/v1/articles/sobre-o-bts/" com {"status": "published"}
  Então recebo 200 OK
  E published_at é preenchido com o momento atual
  E o signal post_save dispara send_article_notification.delay(article_id)
  E o artigo aparece na listagem pública anônima

Cenário: Editor publica via Django admin (BUG conhecido OPS-1)
  Dado que existe um artigo draft de minha autoria
  Quando publico pelo Django admin alterando status para "published" e salvando
  Então o status fica como "published"
  Mas published_at permanece NULL
  E o artigo some da ordenação default ("-published_at, -created_at")
  E o invariante I1 é violado
  # Hotfix candidato Sprint 5: mover lógica de carimbo para Article.save() OU override ArticleAdmin.save_model

Cenário: Editor X não edita artigo de editor Y
  Dado que estou autenticado como editor "joao@interpop.com.br"
  E existe um artigo de "ana@interpop.com.br" com slug "sobre-o-bts"
  Quando envio PATCH "/api/v1/articles/sobre-o-bts/" com {"title": "Tentativa hostil"}
  Então recebo 403 Forbidden
  E o título original permanece inalterado
  # IsOwnerOrAdmin object-level — admin e dev seguem podendo editar

Cenário: Slug é único — sufixa em caso de colisão
  Dado que já existe um artigo com slug "sobre-o-bts"
  Quando crio outro artigo com título "Sobre o BTS"
  Então o novo artigo recebe slug "sobre-o-bts-1"

Cenário: Hero único — marcar como featured desmarca o anterior atomicamente
  Dado que existe artigo A com is_featured=True
  Quando salvo artigo B com is_featured=True
  Então B fica com is_featured=True
  E A fica com is_featured=False
  E a transação é atômica (transaction.atomic)

Cenário: Capa e legenda da capa são obrigatórias na criação
  Dado que estou autenticado como editor
  Quando envio POST "/api/v1/articles/" sem cover_image
  Então recebo 400 Bad Request
  E a resposta contém mensagem pt-BR "A imagem de capa é obrigatória"
```

---

### US10.2 — Leitor lê artigo via URL com slug humano

> **Como** leitor (anônimo ou autenticado)
> **Quero** acessar o artigo via URL legível em português
> **Para** ler conteúdo editorial e compartilhar o link com colegas.

- **Prioridade**: 🔴 Imediato
- **Estimativa**: 5 Story Points
- **Sprint**: 1-2 (pre-busca)
- **Status**: ✅ Done
- **CAs cobertos**: CA05, CA06, CA12, CA14
- **Persona**: [leitor anônimo + leitor autenticado](../../requirements/personas-e-cenarios.md)

#### Cenários BDD (Gherkin pt-BR)

```gherkin
Funcionalidade: Leitura de artigo via slug humano
  Como leitor do Interpop
  Quero acessar artigo por URL legível
  Para ler e compartilhar conteúdo editorial

Cenário: Anônimo lê artigo publicado via slug
  Dado que existe artigo publicado com slug "a-nova-hegemonia-coreana"
  Quando acesso "/noticia/a-nova-hegemonia-coreana"
  Então vejo título, capa, legenda da capa, corpo e autor
  E vejo a editoria com cor e ícone próprios
  E o body aparece como texto puro (escapado via JSX)

Cenário: Slug com acentuação portuguesa funciona
  Dado que existe artigo publicado com slug "o-novo-disco-da-céu"
  Quando acesso "/noticia/o-novo-disco-da-céu"
  Então recebo 200 OK e vejo o artigo
  # Conversor <uslug:> aceita \w unicode-aware

Cenário: Anônimo NÃO vê rascunho
  Dado que existe artigo com status="draft"
  Quando o anônimo lista "/api/v1/articles/"
  Então o draft NÃO aparece na resposta
  # IsPublisherOrReadOnly + filter status='published' para anon

Cenário: Editor autenticado vê drafts seus na listagem
  Dado que estou autenticado como editor com 2 drafts e 1 published
  Quando faço GET "/api/v1/articles/"
  Então a resposta contém os 3 artigos (incluindo drafts)
  # user.can_publish controla o boundary

Cenário: View_count incrementa 1× por (article, IP, 5min)
  Dado que existe artigo publicado com slug "sobre-o-bts" e view_count=10
  Quando o IP 192.0.2.1 envia POST "/api/v1/articles/sobre-o-bts/view/" 5× em 1 minuto
  Então view_count fica 11 (não 15)
  E o bucket "view_count:sobre-o-bts:192.0.2.1" expira em 5 minutos
  # Em prod com 3 workers gunicorn: vaza para 13 (S-06 — Redis A20 resolve)

Cenário: View_count NÃO incrementa em artigo draft
  Dado que existe artigo draft
  Quando envio POST "/api/v1/articles/<slug>/view/"
  Então recebo 204 No Content
  Mas view_count permanece em 0
  # Invariante I8: filter status='published' na query de UPDATE

Cenário: Ordenação default privilegia publicação recente
  Dado que existem 3 artigos publicados em datas diferentes
  Quando faço GET "/api/v1/articles/"
  Então a ordem é "-published_at, -created_at" (mais recente primeiro)
```

---

### US10.3 — Crawler social recebe cartão rico com OG meta

> **Como** robô de rede social (Twitterbot, WhatsApp, facebookexternalhit, LinkedInBot, Slackbot, Discordbot, TelegramBot, Pinterest, redditbot, Applebot)
> **Quero** receber HTML server-side com Open Graph e Twitter Card preenchidos
> **Para** mostrar prévia (cartão) com título, capa, autor e resumo quando o leitor compartilhar o link.

- **Prioridade**: 🟠 Alta (60-80% do tráfego vem de redes sociais)
- **Estimativa**: 5 Story Points
- **Sprint**: 2 (entrou junto com pivô editorial)
- **Status**: ✅ Done · 🟡 sem teste automatizado (GAP-1)
- **CAs cobertos**: CA07
- **Persona**: crawler social (não-humano)

#### Cenários BDD (Gherkin pt-BR)

```gherkin
Funcionalidade: Cartão social rico via SocialOGMiddleware
  Como robô de rede social
  Quero receber HTML server-side com OG meta
  Para renderizar prévia correta do artigo

Cenário: WhatsApp recebe HTML com OG meta
  Dado que existe artigo publicado com slug "sobre-o-bts"
  Quando o User-Agent "WhatsApp/2.0" faz GET "/noticia/sobre-o-bts/"
  Então recebo 200 text/html com meta tags OG
  E vejo og:title=<título do artigo>
  E vejo og:description=<excerpt truncado em 300 chars>
  E vejo og:image=<URL absoluta da capa, prefixada com SITE_URL>
  E vejo og:url=<SITE_URL>/noticia/sobre-o-bts/
  E vejo twitter:card=summary_large_image

Cenário: Crawler em artigo draft recebe 404
  Dado que existe artigo draft com slug "rascunho-vazado"
  Quando "facebookexternalhit/1.1" faz GET "/noticia/rascunho-vazado/"
  Então recebo 404
  # Middleware filtra status='published' explicitamente

Cenário: Navegador comum NÃO é interceptado
  Dado o mesmo artigo publicado
  Quando User-Agent "Mozilla/5.0" (humano) faz GET "/noticia/sobre-o-bts/"
  Então a requisição vai direto para o SPA (não passa pelo middleware OG)
  # _CRAWLER_RE só casa com 10 user agents conhecidos (case-insensitive)

Cenário: SITE_URL ausente em produção falha cedo (RNF — anti-OPS-3)
  Dado que SITE_URL não está definido em produção
  Quando o backend inicializa
  Então o boot falha com ImproperlyConfigured
  # Hoje: fallback localhost:5173 hardcoded — OPS-3 ativo
```

---

### US10.4 — Editor categoriza artigo em uma das 5 editorias canônicas

> **Como** editor
> **Quero** classificar o artigo em uma das 5 editorias canônicas (Música, Moda, Cinema, Literatura, Cultura Digital)
> **Para** sustentar a identidade taxonômica da marca e permitir filtragem pelo leitor.

- **Prioridade**: 🟠 Alta
- **Estimativa**: 3 Story Points
- **Sprint**: 2 (pivô editorial)
- **Status**: ✅ Done
- **CAs cobertos**: CA08, CA09
- **Persona**: editor

#### Cenários BDD (Gherkin pt-BR)

```gherkin
Funcionalidade: Categorização editorial em 5 editorias fixas
  Como editor do Interpop
  Quero escolher entre 5 editorias canônicas
  Para classificar o artigo dentro da identidade da marca

Cenário: Sistema oferece exatamente 5 editorias canônicas após migrations
  Dado que as migrations 0001-0003 foram aplicadas
  Quando consulto Category.objects.all().order_by('name')
  Então vejo exatamente: Cinema, Cultura Digital, Literatura, Moda, Música
  E nenhuma categoria legada (Política, Tecnologia, Cultura, Negócios, Internacional, Economia) sobrevive vazia

Cenário: Apagar categoria deixa artigo órfão (rótulo, não conteúdo)
  Dado que existe artigo na editoria "Música"
  Quando a categoria "Música" é apagada
  Então o artigo permanece (category=NULL via SET_NULL)
  # Invariante I10: conteúdo sobrevive sem categoria

Cenário: API NÃO permite criar categoria nova
  Dado que estou autenticado como editor ou admin
  Quando tento POST "/api/v1/categories/" com {"name": "Esportes"}
  Então recebo 405 Method Not Allowed
  # Vocabulário só muda via data migration OU Django admin (ADR-002)

Cenário: Editor escolhe editoria ao criar artigo
  Dado que estou autenticado como editor
  Quando crio artigo com category_id=<id de "Cinema">
  Então o artigo é salvo com category="Cinema"
  E na resposta vejo o nome e slug da categoria nested

Cenário: Filtrar listagem por editoria
  Quando faço GET "/api/v1/articles/?category__slug=cinema&status=published"
  Então recebo apenas artigos publicados da editoria Cinema
```

---

## Tasks (implementação — retroativas Sprint 1-2, pre-busca)

### Tasks US-bound (T10.X — todas ✅ Done — Sprint 1-2, pre-busca)

| ID       | Descrição                                                                                                                                       | Prioridade | Sprint | Nota                                                                                             |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------ |
| T10.1.1  | Bootstrap `apps.articles` (apps.py, urls.py, admin.py, models.py base)                                                                          | 🔴         | 1      | ✅ Done (Sprint 1-2, pre-busca)                                                                  |
| T10.1.2  | Model `Article` (UUID PK, title, slug unique, excerpt, body, cover_image, author PROTECT, status)                                               | 🔴         | 1      | ✅ Done (Sprint 1-2, pre-busca)                                                                  |
| T10.1.3  | Model `Category` (name unique, slug unique, ordering by name)                                                                                   | 🔴         | 1      | ✅ Done (Sprint 1-2, pre-busca)                                                                  |
| T10.1.4  | Migrations `0001_initial` + `0002_initial` — schema base                                                                                        | 🔴         | 1      | ✅ Done (Sprint 1-2, pre-busca)                                                                  |
| T10.1.5  | `Article._unique_slug()` — sufixa `-1`, `-2` em caso de colisão                                                                                 | 🟠         | 1      | ✅ Done (Sprint 1-2, pre-busca)                                                                  |
| T10.1.6  | `Article.save()` override com `transaction.atomic` para invariante I2 (único featured)                                                          | 🟠         | 1      | ✅ Done (Sprint 1-2, pre-busca) — ADR-012                                                        |
| T10.1.7  | `Category.save()` override com `slugify(name, allow_unicode=True)`                                                                              | 🟡         | 1      | ✅ Done (Sprint 1-2, pre-busca)                                                                  |
| T10.1.8  | `ArticleWriteSerializer` — `cover_image` + `cover_caption` obrigatórios na criação                                                              | 🟠         | 1      | ✅ Done (Sprint 1-2, pre-busca)                                                                  |
| T10.1.9  | `ArticleListSerializer` (plano, sem body) + `ArticleDetailSerializer` (com body + cover_caption)                                                | 🟠         | 1      | ✅ Done (Sprint 1-2, pre-busca)                                                                  |
| T10.1.10 | `ArticleListView` + `ArticleDetailView` (DRF generic views) com filtros `category__slug`, `status`, `is_featured`, busca `?search=`, ordering   | 🟠         | 1      | ✅ Done (Sprint 1-2, pre-busca)                                                                  |
| T10.1.11 | `CategoryListView` (read-only, AllowAny — 5 itens fixos)                                                                                        | 🟡         | 1      | ✅ Done (Sprint 1-2, pre-busca)                                                                  |
| T10.1.12 | URLs `/api/v1/articles/` + `/api/v1/articles/<uslug:slug>/` + `/api/v1/categories/` (prefixo ADR-010)                                           | 🟠         | 1      | ✅ Done (Sprint 1-2, pre-busca)                                                                  |
| T10.1.13 | `ArticleDetailView.perform_create/update` carimba `published_at = now()` em transição draft → published                                         | 🔴         | 1      | ✅ Done (Sprint 1-2, pre-busca) — **causa de OPS-1** (não roda via admin)                        |
| T10.1.14 | Permissions: `IsPublisherOrReadOnly` (view-level) + `IsOwnerOrAdmin` (object-level — editor X não toca artigo de editor Y)                      | 🔴         | 1      | ✅ Done (Sprint 1-2, pre-busca)                                                                  |
| T10.1.15 | Signal `pre_save` — snapshot `_prev_status` (anti-double-fire de newsletter)                                                                    | 🟠         | 2      | ✅ Done (Sprint 1-2, pre-busca)                                                                  |
| T10.1.16 | Signal `post_save` — dispara `send_article_notification.delay(article_id)` (lazy import anti-circular)                                          | 🟠         | 2      | ✅ Done — refactor Sprint 4 (C12: Celery `.delay()` substituiu chamada síncrona)                 |
| T10.1.17 | `ArticleAdmin` Django — `list_display`, `list_filter`, `search_fields`, `prepopulated_fields={'slug':('title',)}`, action `resend_notification` | 🟡         | 1      | ✅ Done (Sprint 1-2, pre-busca) — **OPS-1 origina aqui** (admin não chama perform_create/update) |
| T10.1.18 | Migration `0003_seed_pop_culture_categories` — idempotente via `get_or_create`; remove 6 legadas se vazias                                      | 🔴         | 2      | ✅ Done (Sprint 1-2, pre-busca) — pivô editorial                                                 |
| T10.1.19 | Migration `0004_article_cover_caption` — `CharField(300)` blank/default                                                                         | 🟡         | 2      | ✅ Done (Sprint 1-2, pre-busca)                                                                  |
| T10.2.1  | `ArticleViewCountView` (POST `/api/v1/articles/<slug>/view/`) — bucket anti-abuse `cache.add(key, True, 300)`                                   | 🟠         | 2      | ✅ Done (Sprint 1-2, pre-busca)                                                                  |
| T10.2.2  | Atomic update `Article.objects.filter(slug=..., status='published').update(view_count=F('view_count')+1)`                                       | 🟠         | 2      | ✅ Done (Sprint 1-2, pre-busca) — invariante I8                                                  |
| T10.2.3  | `apps.audit.get_client_ip` — extração X-Forwarded-For única no projeto (C13)                                                                    | 🟠         | 2      | ✅ Done (Sprint 1-2, pre-busca)                                                                  |
| T10.3.1  | `og_middleware.py` — `SocialOGMiddleware` com regex `_CRAWLER_RE` (10 user agents)                                                              | 🟠         | 2      | ✅ Done (Sprint 1-2, pre-busca)                                                                  |
| T10.3.2  | `_render_og_html(article)` — gera HTML mínimo com OG/Twitter Card meta; escape via `_escape` custom (débito S-11)                               | 🟡         | 2      | ✅ Done (Sprint 1-2, pre-busca)                                                                  |
| T10.3.3  | `sitemaps.py` — sitemap.xml manual (SimplerXMLGenerator) apontando para `SITE_URL` (frontend), não backend                                      | 🟡         | 2      | ✅ Done (Sprint 1-2, pre-busca)                                                                  |
| T10.3.4  | `robots_view.py` — robots.txt dinâmico com `Disallow: /api/`, `/django-admin/` + linha Sitemap                                                  | 🟡         | 2      | ✅ Done (Sprint 1-2, pre-busca)                                                                  |
| T10.3.5  | `converters.py` — `UnicodeSlugConverter` registrado como `<uslug:>` global em `ready()` (anti-`RemovedInDjango60Warning`)                       | 🟠         | 2      | ✅ Done (Sprint 1-2, pre-busca)                                                                  |
| T10.4.1  | `Category` admin com `prepopulated_fields={'slug':('name',)}` (criação manual rápida)                                                           | 🟡         | 2      | ✅ Done (Sprint 1-2, pre-busca)                                                                  |

### Tasks de teste (baseline retroativa — Sprint 1-2, pre-busca)

| ID      | Descrição                                                                                          | Prioridade | Sprint | Status                          |
| ------- | -------------------------------------------------------------------------------------------------- | ---------- | ------ | ------------------------------- |
| T10.5.1 | `test_views.py` — 21+ testes cobrindo CRUD, permissões, filtros, featured-único, view_count        | 🔴         | 1-2    | ✅ Done (Sprint 1-2, pre-busca) |
| T10.5.2 | `test_article_publish_triggers_send_article_notification_once` — invariante I1 + dispatcher Celery | 🔴         | 4      | ✅ Done (refactor Celery C12)   |
| T10.5.3 | `test_view_count_incremented_once_per_5min_window` — bucket anti-abuse (I4)                        | 🟠         | 2      | ✅ Done (Sprint 1-2, pre-busca) |
| T10.5.4 | `test_only_one_featured_after_multiple_marks` — invariante I2 (atomic)                             | 🟠         | 1      | ✅ Done (Sprint 1-2, pre-busca) |

### Tasks transversais (TX-NN — configurações técnicas e infraestrutura cruzada)

| ID    | Descrição                                                                                 | Prioridade | Quando                                                   |
| ----- | ----------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------- |
| TX-01 | Configurar `MEDIA_URL` + `MEDIA_ROOT` para `cover_image` upload (`media/covers/%Y/%m/`)   | 🔴         | ✅ Done (Sprint 1-2, pre-busca)                          |
| TX-02 | Wire de `MIDDLEWARE` em `config/settings/base.py` (`SocialOGMiddleware` na ordem correta) | 🟠         | ✅ Done (Sprint 1-2, pre-busca)                          |
| TX-03 | Wire de URLs globais para `/sitemap.xml` + `/robots.txt` + `/noticia/<uslug:slug>/`       | 🟠         | ✅ Done (Sprint 1-2, pre-busca)                          |
| TX-04 | Configurar `SITE_URL` em `.env` (fallback `localhost:5173` hardcoded — débito OPS-3)      | 🟠         | ✅ Done (Sprint 1-2, pre-busca) — **débito OPS-3 ativo** |

---

## Definition of Done — verificação

- [x] CA01, CA02, CA05, CA08, CA09, CA10, CA11, CA12, CA14, CA15 verificados por test automatizado
- [ ] **CA03, CA04 violados em produção via Django admin** (OPS-1 — hotfix candidato Sprint 5)
- [x] CA06 ok em dev/testes; 🟡 vaza entre workers gunicorn em prod (S-06 — A20 Redis resolve)
- [ ] CA07 sem teste automatizado (GAP-1 — Sprint de hardening de testes)
- [x] CA13 mantido por escape JSX (defesa única — débito S-01 documentado)
- [x] US10.1, US10.2, US10.3, US10.4 com cenários BDD rodando verde (`apps/articles/tests/test_views.py` 21+ testes)
- [x] Todas as Tasks Imediate/Alta done com referência ao código
- [x] Code-review implícito (módulo em produção desde Sprint 2)
- [x] Documentação cruzada atualizada — RF-001 + EP-02 + [DESIGN.md](../../specs/articles/DESIGN.md) citam esta Feature
- [x] Em produção desde Sprint 2 (sem hotfix de regressão até 2026-06-09)

**Status final**: ✅ **Done** com 2 hotfix candidates (OPS-1 admin published_at + D-10 cover URL relativa em email) e 1 GAP de teste (GAP-1 crawler social). Não bloqueia evolução do produto, mas justifica Sprint de housekeeping.

---

## Open Questions (para futuro DESIGN evolutivo)

1. **OPS-1 — Publicar via Django admin não preenche `published_at`** (artigos somem da ordenação default). Hotfix: mover lógica de carimbo do `views.py:64,87` para `Article.save()` OU override `ArticleAdmin.save_model`. Prefira o segundo: mais cirúrgico, não acopla model a regra de boundary. **Sprint 5 candidato.**
2. **S-06 — `view_count` bucket vaza entre workers gunicorn** (LocMemCache per-process; 3 workers = 3× o limite por IP). Resolve com Redis distribuído (A20). Sem isso, ranking "mais lidos" infla artificialmente.
3. **ADR-002 — Tags livres entram quando?** Vocabulário fixo é decisão deliberada, mas re-avaliar quando volume passar de ~500 artigos publicados. Métrica de gatilho: editor pedindo classificação fora das 5 categorias > 5×/mês.
4. **ADR-014 — `body` JSONField estruturado entra quando?** Quando time editorial demandar blocos tipados (citação, embed de tweet/Instagram, mídia). Migração: dual-write durante 2 sprints, depois flip de leitura, depois drop do `body` texto puro.
5. **OPS-2 — Refactor SEO para `apps/seo/`?** Extrair `sitemap.py` + `robots_view.py` + `og_middleware.py` + conversor. Custo: tocar `MIDDLEWARE` em `base.py` + URLs globais + dependência circular com Article. Benefício: SRP + reuso do middleware em outros tipos de página (Sobre, Newsletter landing).
6. **Soft-delete em Article?** Padrão NYT/Folha (never delete) vs LGPD (apagar = remover dado pessoal de leitor). Decisão depende de pedido editorial. Re-avaliar a partir de 200 publicados.
7. **OG meta — sem teste automatizado (GAP-1)**. Test client + `HTTP_USER_AGENT='WhatsApp/2.0'` cobre invariante I5 em 5 LoC. Por que não temos? Sprint 1-2 priorizou cobertura de domínio sobre middleware.
8. **D-10 — newsletter envia link de capa quebrado** (relativo em email). Hotfix: usar `SITE_URL + article.cover_image.url` em template de email. Sprint 5 candidato (junto com OPS-1).

---

## Specs técnicas relacionadas

- [DESIGN.md](../../specs/articles/DESIGN.md) — spec retroativo completo (fonte de verdade técnica)
- [CONCERNS.md](../../specs/codebase/CONCERNS.md) — débitos S-01, S-06, S-11, D-07, D-10, OPS-1..6, GAP-1..4
- [ARCHITECTURE.md](../../specs/codebase/ARCHITECTURE.md) — grafo de apps (Ca=4 / Ce=3 / I=0.43)
- [CONVENTIONS.md](../../specs/codebase/CONVENTIONS.md) — permissions, slug, UUID
- [STRUCTURE.md](../../specs/codebase/STRUCTURE.md) — `backend/apps/articles/`
- [Improvement-system.md](../../planning/Improvement-system.md) — backlog mestre pré-reorg

---

## Cross-references resumidas

| Direção                    | Onde                                                                                                                                                                                                                                                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ↑ Requisitos atendidos     | [RF-001](../../requirements/RF/RF-001-articles.md), [RNF-perf](../../requirements/RNF/RNF-perf.md), [RNF-security](../../requirements/RNF/RNF-security.md), [RNF-a11y](../../requirements/RNF/RNF-a11y.md), [RNF-lgpd](../../requirements/RNF/RNF-lgpd.md), [RNF-availability](../../requirements/RNF/RNF-availability.md) |
| ↑ Epic pai                 | [EP-02](../epics/EP-02-publicacao-editorial.md)                                                                                                                                                                                                                                                                            |
| → Sprint(s)                | Sprint 1 (bootstrap), Sprint 2 (pivô editorial + middleware OG)                                                                                                                                                                                                                                                            |
| → Specs técnicas           | [DESIGN.md retroativo](../../specs/articles/DESIGN.md) + ADRs 002/009/010/012/014/018                                                                                                                                                                                                                                      |
| → Features filhas          | n/a (F-10 consolida — não é Epic)                                                                                                                                                                                                                                                                                          |
| → Features que dependem    | [F-30 Busca por texto livre](F-30-busca-texto-livre.md) (read-projection via trigger PL/pgSQL sobre Article — ADR-018)                                                                                                                                                                                                     |
| ← Features irmãs sob EP-02 | (única Feature do Epic — granularidade deliberada)                                                                                                                                                                                                                                                                         |

---

_F-10 ✅ Done desde Sprint 2 (2026 H1, pre-busca). Formalizada retroativamente em 2026-06-09. **Hotfix candidate Sprint 5**: OPS-1 (admin published_at NULL) — bug latente que viola invariante I1 e some artigos da ordenação default. Custo de fix: ~30 LoC + 1 teste. Impacto: alto (qualquer artigo publicado pelo admin Django fica "invisível" no listing default)._
