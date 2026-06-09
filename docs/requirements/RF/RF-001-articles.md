# RF-001 — Publicação e leitura de artigos editoriais

> **Tipo**: Requisito Funcional
> **Prioridade**: 🔴 Imediato (núcleo editorial — sem isto não há produto)
> **Status**: ✅ Realizado em produção (Sprint 1-2, pre-busca) · 🚧 documentação retroativa formalizada nesta entrega

---

## Enunciado de negócio (pt-BR, sem termo técnico)

> **Sistema permite que editor publique artigos editoriais com título, resumo, corpo de texto, capa, autor e editoria, e que leitor anônimo ou autenticado leia esses artigos via URL com slug humano, com contagem de visualização anti-abuso e meta tags ricas para crawlers sociais.**

### Subseção §publicação

> Editor (papel `editor`, `admin` ou `dev`) cria artigo em rascunho, preenche título, resumo, corpo de texto, imagem de capa com legenda obrigatória e escolhe uma das 5 editorias canônicas. Quando publica, o sistema registra automaticamente o momento da publicação e notifica assinantes de newsletter por e-mail.

### Subseção §leitura

> Qualquer leitor (anônimo ou autenticado) acessa o artigo via URL pública no formato `/noticia/<slug-humano>`. O slug aceita acentuação portuguesa (`/noticia/o-novo-disco-da-céu`). Leitor anônimo nunca vê artigo em rascunho; editorial autenticado vê rascunhos seus na listagem administrativa.

### Subseção §view_count

> Cada leitura conta como uma visualização, mas o mesmo leitor (mesmo IP) só conta uma vez a cada 5 minutos por artigo. Isso impede inflação artificial por F5 ou recarga acidental. A contagem é usada para ranquear "mais lidos" e nunca decresce.

### Subseção §OG-meta

> Quando alguém compartilha um link de artigo em WhatsApp, Twitter, Facebook, LinkedIn, Telegram, Discord, Slack ou Pinterest, a prévia mostrada (cartão social) traz título, resumo, capa e autor corretos. O sistema detecta o robô do aplicativo de mensagem e responde com a página enriquecida em meta tags, sem depender do JavaScript do navegador.

### Subseção §categorias-fixas

> Sistema oferece exatamente 5 editorias canônicas (Música, Moda, Cinema, Literatura, Cultura Digital). Editor escolhe uma por artigo. Vocabulário é estável — adicionar nova editoria é decisão editorial deliberada, não criação livre por editor (ver Restrição "tags livres deferidas").

---

## Justificativa (por que este requisito existe)

Interpop é um veículo editorial brasileiro de análise crítica de Soft Power e geopolítica da cultura pop. Publicação editorial **é o produto** — sem ela, não há leitor, não há retenção, não há newsletter, não há comentário, não há busca. Todos os demais módulos (`comments`, `newsletter`, `search`, `audit`, `moderation`) lêem ou referenciam `Article`.

Por que cada subseção existe:

- **§publicação**: editor precisa de fluxo de rascunho → publicado para permitir revisão antes do leitor ver. Sem isso, todo erro de digitação vira erro público.
- **§leitura**: URL humana (`/noticia/a-nova-hegemonia-coreana`) é melhor para SEO, compartilhamento e memorização do que `/articles/uuid/`. Acentuação portuguesa importa porque o público é brasileiro e títulos editoriais brasileiros têm acento.
- **§view_count**: KPI editorial mais usado pelo time é "mais lidos da semana". Contagem inflada por F5 do próprio autor invalida o ranking.
- **§OG-meta**: 60-80% do tráfego de artigos editoriais brasileiros vem de redes sociais (Twitter/X + WhatsApp). Cartão social pobre = cliques perdidos.
- **§categorias-fixas**: editorias são identidade de marca. Tag livre cria caos taxonômico (sinônimos, plurais, capitalização) e dilui SEO.

**Implicação de produto**: este RF é a **fundação editorial** — qualquer Sprint que toque artigos deve preservar todos os 5 sub-comportamentos sem regressão.

---

## Realizado por (rastreabilidade ↓)

Este requisito é executado pelos seguintes Epics e Features:

| Epic                                                                            | Feature(s)                                                                                        | Status                          |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------- |
| [EP-02 Publicação editorial](../../backlog/epics/EP-02-publicacao-editorial.md) | [F-10 Publicação e leitura de artigos](../../backlog/features/F-10-publicacao-leitura-artigos.md) | ✅ Done (Sprint 1-2, pre-busca) |

---

## Requisitos Não-Funcionais que limitam este RF

| RNF                                            | Limite imposto                                                                                                                                                         |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [RNF-perf](../RNF/RNF-perf.md)                 | Listing público p95 ≤ 200ms server (cobre índice `(status, -published_at)` em `articles`); LCP/INP/CLS dentro dos gates                                                |
| [RNF-security](../RNF/RNF-security.md)         | `IsPublisherOrReadOnly` + `IsOwnerOrAdmin` (editor X não toca artigo de editor Y); escape XSS no boundary do `body` (defesa em camada única documentada — débito S-01) |
| [RNF-a11y](../RNF/RNF-a11y.md)                 | Página de artigo passa WCAG 2.2 AA; landmarks corretos (`<article>`, `<main>`, `<aside>`); contraste em legenda de capa                                                |
| [RNF-lgpd](../RNF/RNF-lgpd.md)                 | IP do leitor usado apenas como chave de bucket anti-abuse (5 min TTL); não persistido em log de leitura                                                                |
| [RNF-availability](../RNF/RNF-availability.md) | Crawler social tem código próprio — middleware funciona mesmo com SPA quebrada; sitemap.xml e robots.txt servidos dinamicamente                                        |

---

## Restrições e fora-de-escopo

- **Tags livres por artigo**: fora de escopo (ADR-002). Vocabulário taxonômico fica restrito às 5 editorias canônicas. Re-avaliar quando volume de artigos passar de ~500.
- **Corpo de texto estruturado em blocos**: fora de escopo hoje (ADR-014). `body` é texto puro (`TextField` sem `max_length`). Migração para JSON estruturado (com blocos tipados: parágrafo, citação, embed) é decisão editorial futura — depende de demanda do time de redação.
- **Sanitização HTML server-side no boundary**: hoje é **defesa em camada única** (React escapa via JSX). Documentado como débito S-01. Não bloqueia o RF porque o frontend hoje cobre o caso; entra como hardening quando `body` virar JSON estruturado.
- **Status expandido (`submitted`, `archived`)**: fora de escopo. Hoje só `draft` e `published`. Decisão editorial: time aceita "publicar = revisado" sem etapa formal de review-before-publish.
- **Soft-delete**: fora de escopo. `DELETE` é físico e cascateia em `Comment` (LGPD-OK: dado pessoal do leitor sai junto). Padrão NYT/Folha (never delete) será re-avaliado quando volume de artigos publicados passar de ~200.
- **Personalização por leitor**: fora de escopo. Listagem é única para todos. Recomendação por ML / embeddings é roadmap Sprint 6+.
- **Múltiplos autores por artigo**: fora de escopo. Hoje `author` é FK single (`PROTECT`). Coautoria entra se demanda editorial aparecer.
- **Internacionalização (en/es)**: fora de escopo. Conteúdo é pt-BR; UI também.

---

## Decisões técnicas relacionadas (ADRs)

Detalhe completo em [`docs/planning/Improvement-system.md`](../../planning/Improvement-system.md) (gitignored — ver O-01 em CONCERNS). Destaques que afetam diretamente o enunciado deste RF:

- **ADR-002** — Tags livres deferidas: vocabulário editorial fica restrito a 5 editorias canônicas (justifica §categorias-fixas)
- **ADR-009** — Newsletter via Celery: `signals.post_save` em `Article` enfileira notificação assíncrona (justifica fluxo de publicação não-bloqueante)
- **ADR-010** — Prefixo `/api/v1/` em todos os endpoints REST (justifica `GET /api/v1/articles/` vs URL pública `/noticia/<slug>`)
- **ADR-012** — `transaction.atomic` em saves com side-effect múltiplo: garante invariante "apenas 1 artigo featured por vez" (`Article.save()` linha 87-92)
- **ADR-014** — `body` texto puro hoje, JSON estruturado deferido (justifica fora-de-escopo "corpo estruturado")
- **ADR-018** — `SearchIndex` mantido por trigger PL/pgSQL e não por signal (CQRS-lite — `articles` é write model, `search` é read projection)

---

## Histórico

| Data       | Evento                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sprint 1   | Módulo `apps.articles` bootstrap; `Article` + `Category` models; admin Django; serializers + views                                                                              |
| Sprint 2   | Pivô editorial: 5 categorias canônicas (`migrations/0003`); `cover_caption` obrigatório; `SocialOGMiddleware`; sitemap.xml + robots.txt; conversor `<uslug:>` unicode           |
| Sprint 4   | Refactor: `send_article_notification` migrou de chamada síncrona para `.delay()` Celery (ADR-009 — C12); read-projection `apps.search` instalada via trigger PL/pgSQL (ADR-018) |
| 2026-06-09 | DESIGN.md retroativo materializado ([`docs/specs/articles/DESIGN.md`](../../specs/articles/DESIGN.md)); RF-001 + EP-02 + F-10 preenchidos retroativamente (esta entrega)        |

---

## Cross-references

- [Spec técnica retroativa completa](../../specs/articles/DESIGN.md) — fonte de verdade técnica
- [Epic pai](../../backlog/epics/EP-02-publicacao-editorial.md)
- [Feature](../../backlog/features/F-10-publicacao-leitura-artigos.md)
- [Personas e cenários](../personas-e-cenarios.md) — leitor anônimo, leitor autenticado, editor, admin, dev
- [Architecture overview §5 apps Django](../../architecture/overview.md)
- [CONCERNS.md — débitos S-01, S-06, S-11, D-07, D-10, OPS-1..3](../../specs/codebase/CONCERNS.md)
- [Improvement-system.md](../../planning/Improvement-system.md) — backlog mestre pré-reorg
- RFs vizinhos: [RF-002 comments](RF-002-comments.md), [RF-004 newsletter](RF-004-newsletter.md), [RF-007 busca editorial](RF-007-busca-editorial.md) — todos lêem `Article`
