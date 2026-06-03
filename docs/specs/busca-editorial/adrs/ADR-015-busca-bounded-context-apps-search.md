# ADR-015: Busca como bounded context separado (`apps.search`)

- **Status**: Accepted
- **Date**: 2026-06-03
- **Tags**: software-architecture, ddd, modular-monolith, search, bounded-context
- **Stakeholders**: software-architect (autor), code-implementer, backend-architect, documentation-engineer
- **Layer**: Software
- **Decisão alinhada com**: roadmap.sh/software-design-architecture (Bounded Context, Modular Monolith)

## Context

O Interpop é um modular monolith Django com 6 apps (`articles`, `comments`, `moderation`, `newsletter`, `users`, `audit`). A feature de busca editorial full-text precisa ser materializada como código de produção. A pergunta direta: **busca vive como método em `apps.articles` ou como app próprio?**

Forças em jogo:

- `apps.articles` já carrega CRUD editorial + workflow de publicação + view_count + featured + slug + status. Adicionar FTS + ranking + suggest + manutenção de índice empurraria para "god component" (≥7 responsabilidades públicas).
- Lei da mudança comum (Common Closure Principle): ranking weights, dicionários FTS, sinônimos, recency boost, A/B de scoring são razões de mudança **distintas** dos motivos para mudar `Article` (publicação, slug, status, view_count).
- Newsletter já foi identificada como **segundo cliente** que precisa do mesmo vocabulário ("consulta editorial filtrada por autor + editoria + datas"). Sinal forte de **shared kernel emergindo** — se busca ficasse em `articles`, newsletter teria que importar Article QuerySet e duplicar filtros.
- Roadmap futuro inclui `/search/comments/` e `/search/all/` (sugerido pelo `backend-architect` §2.4), o que reforça busca como capability transversal sobre o corpus, não feature de Article.

## Decision Drivers

- Common Closure Principle (Robert Martin): "classes que mudam juntas ficam juntas".
- Ownership clara: ranking/index/dicionários têm dono explícito, não diluído em Article.
- Acyclic dependency (Article não importa nada de search → search é folha de leitura).
- Reuso real comprovado (newsletter) — não especulativo.

## Considered Options

1. **Método estático em `apps.articles.services`** — `ArticleService.search(spec)` chama queryset com FTS annotation.
2. **Mixin/Manager em `apps.articles.models`** — `Article.objects.search(q, filters)`.
3. **App próprio `apps.search`** — bounded context separado, `SearchService.query(spec)`, `SearchIndex` como modelo dedicado.

## Decision Outcome

**Chosen option**: **Opção 3 — `apps.search` como bounded context separado**, porque:

- Newsletter já confirmou demanda de reuso (não especulação).
- FTS/ranking/index têm ciclo de mudança próprio (semanas/meses, independente do roadmap editorial de Article).
- `Article` mantém Ce (Coupling Efferent) baixo — não importa `tsvector`, ts_rank, weights, search_log.
- Permite Repository abstrato futuro (Elasticsearch, Meilisearch) sem cirurgia em `articles`.

### Boundaries (regra dura — viola = revert do PR)

| De → Para             | Permitido                                          | Proibido                                  |
| --------------------- | -------------------------------------------------- | ----------------------------------------- |
| `search → articles`   | Importar `Article`, `Category` (read-only)         | Mutar Article; escrever campos editoriais |
| `search → users`      | FK lookup (id, display_name)                       | Lógica de role/permissão                  |
| `articles → search`   | **Nada** (zero import)                             | Qualquer import                           |
| `newsletter → search` | Consumir `SearchService.query()`                   | Reimplementar filtros sobre Article       |
| `search ↔ qualquer`   | Comunicação write via Django signals + trigger SQL | Chamadas síncronas cruzadas para reindex  |

### Estrutura concreta do app

```
apps/search/
  __init__.py
  apps.py
  models.py                          # SearchIndex (read-projection)
  services.py                        # SearchService (entry point público)
  dto.py                             # QuerySpec, SearchResultPage (frozen dataclasses)
  signals.py                         # listener Article post_save → cache invalidation
  views.py                           # SearchView (DRF)
  serializers.py                     # SearchQuerySerializer + SearchResultSerializer
  urls.py
  management/commands/reindex_search.py
  migrations/                        # 0001 schema, 0002 indexes, 0003 triggers, 0004 vacuum
  tests/
```

### Positive Consequences

- `Article` permanece coeso (CRUD editorial + workflow); Ce não cresce.
- `apps.search` tem dono cognitivo único; mudanças de ranking não tocam editorial.
- Newsletter consome `SearchService.query(spec)` como cliente — fecha o princípio de shared kernel sem violar boundaries.
- Hooks futuros (Elasticsearch, Meilisearch, suggest endpoint) entram em `apps.search` sem cirurgia.
- Permite ADR-016 (CQRS leve) e ADR-017 (Service Layer puro) materializarem em código sem ambiguidade.

### Negative Consequences (trade-offs)

- Mais um app no `INSTALLED_APPS` para code-implementer manter.
- Custo de manutenção de sincronia (`SearchIndex` ↔ `Article`) — endereçado por ADR-018 (trigger SQL).
- Newsletter precisa importar de `apps.search.services`, não mais de `apps.articles` — refator one-shot.

## Pros and Cons of the Options

### Opção 1 — Método estático em `ArticleService`

- 👍 Zero overhead estrutural; menos diretórios.
- 👎 Diluição de ownership; god-service emerge em 6 meses.
- 👎 Newsletter importaria `ArticleService` para busca — couple errado.

### Opção 2 — Mixin/Manager em `Article.objects`

- 👍 ORM-native, idiomático Django.
- 👎 `Article.objects.search()` mistura write + read na mesma façade.
- 👎 Migration de FTS = migration de Article (alto risco).

### Opção 3 — `apps.search` separado ⭐

- 👍 Common Closure respeitado; ownership clara; reuso real fechado.
- 👍 Permite ADRs 016, 017 sem conflito.
- 👎 +1 app no monorepo (custo aceitável).

## Implementation Notes

- **Task IDs no BACKLOG**: T30.1.1 (criar app), T30.1.2 (registrar `INSTALLED_APPS`)
- **Referência no DESIGN.md**: §2.1 (preservado v2)
- **Referência no specialist output**: `DESIGN-v2-hybrid.md` §2.1 linhas 37-80
- **Newsletter refactor**: rastreado em Open Question #8 do DESIGN §5 (refator ou aceitar dívida)
- **Verificação ARCH**: scripts de lint Python devem proibir `apps.articles` importar de `apps.search` (regra estrutural via `import-linter` ou test de arquitetura)

## References

- DESIGN.md §2.1 e §4 (tabela de ADRs)
- `DESIGN-v2-hybrid.md` §2.1 (output literal do software-architect)
- ADR-016 (CQRS leve — depende deste)
- ADR-017 (Service Layer puro — depende deste)
- roadmap.sh/software-design-architecture — Bounded Context, DDD Strategic Design
- Robert Martin — _Clean Architecture_ cap. "Common Closure Principle"
