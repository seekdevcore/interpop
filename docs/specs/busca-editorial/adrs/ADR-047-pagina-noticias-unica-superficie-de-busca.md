# ADR-047: Página "Notícias" (`/noticias`) é a única superfície de busca; `/buscar` vira redirecionamento

- **Status**: Aceita
- **Date**: 2026-11-06
- **Tags**: produto, frontend, roteamento, busca, ui-ux
- **Stakeholders**: Gabriel Marques (decisão de produto), documentation-engineer (registro), frontend-architect, code-implementer
- **Layer**: Produto / Frontend
- **Feature**: [F-33 Página Notícias unificada](../../../backlog/features/F-33-pagina-noticias-unificada.md)

## Context

O site tem duas buscas:

1. **`/noticias`** (`src/pages/News.tsx`): arquivo de artigos com campo "Buscar notícias…" (`?busca=`) e chips de editoria (`?categoria=<slug>`, usado pelos links do menu e do rodapé). Pesquisa via `GET /api/v1/articles/?search=` (DRF SearchFilter, `icontains`, `backend/apps/articles/views.py:34`): sensível a acento, sem ranking.
2. **`/buscar`** (`src/pages/Buscar/`, F-30): busca full-text (`GET /api/v1/search/articles/`, `pt_unaccent` + stemming + ranking relevância×recência, destaque de termos). Nenhum link do site aponta para ela.

Resultado: o leitor encontra a busca fraca e não encontra a boa. Manter duas pesquisas também duplica manutenção, testes e regras de URL.

## Decision Drivers

- Uma pergunta do leitor ("onde eu procuro?") deve ter uma resposta.
- `/noticias` já é o destino do menu, do rodapé e da página 404: mudar a página atrás dele não quebra navegação.
- A pesquisa precisa ignorar acento (pt-BR), o que só a busca editorial faz.
- Links antigos (`?categoria=`, `?busca=`, `/buscar?q=`) não podem quebrar.
- WCAG 2.2 AA e Core Web Vitals, com o carregamento sob demanda da ADR-026 mantido.

## Considered Options

1. **Manter as duas páginas** — custo zero agora; o leitor continua sem achar a busca boa.
2. **Trocar só a pesquisa do campo de `/noticias`** para o endpoint full-text, mantendo o visual do arquivo — resolve o acento, mas perde destaque de termos, estados de erro/429 e área de filtros, e deixa `/buscar` como código órfão.
3. **Unificar: a página de busca editorial passa a ser a página "Notícias" em `/noticias`** ⭐ — com chips de editoria e listagem do arquivo quando o campo está vazio.

## Decision Outcome

**Escolhida: Opção 3** (decisão do usuário em 06/11/2026; requisitos derivados confirmados pelo usuário na mesma data).

- `/noticias` renderiza a página de busca editorial, com título "Notícias".
- Campo vazio: lista os publicados do mais novo para o mais antigo, com "Ver mais".
- Chips "Todos" + 5 editorias; editoria e termo combinam; trocar a editoria não apaga o termo.
- `/noticias?categoria=<slug>` continua válido; `?busca=X` é reescrito para `q=X`; `/buscar?…` redireciona para `/noticias?…` preservando os parâmetros.
- O chip de editoria substitui o seletor em lista suspensa de F-31 CA17. Autor e datas seguem em F-31.
- Pré-condição de deploy: `SEARCH_FEATURE_ENABLED=True` e Postgres em produção antes de remover a pesquisa antiga.
- Demo público segue com as duas buscas até a entrega de F-33 (decisão do usuário em 06/11/2026).

### Positive Consequences

- Uma superfície de busca, encontrável pelo menu.
- Pesquisa que ignora acento e ordena por relevância para todo leitor.
- Menos código: a pesquisa `?search=` do arquivo e `News.tsx` saem após o cutover.

### Negative Consequences

- A página de entrada mais visitada depois da Home passa a depender do endpoint de busca. Mitigação: listagem e chips independem dele (F-33 CA35).
- Ajustes em decisões anteriores: gate Lighthouse da ADR-031-FE muda de `/buscar?q=kpop` para `/noticias?q=kpop`; o `form action` do `SearchInput` e o CA09 de F-30 passam a citar `/noticias`.
- A página só pode ir ao ar depois da correção do [BUG-02](../../../backlog/bugs/BUG-02-busca-nao-aceita-acento-tecla-morta.md).

## Implementation Notes

- **Tasks**: T33.1.1–T33.3.2, TX-65, TX-66 em [F-33](../../../backlog/features/F-33-pagina-noticias-unificada.md).
- Esta ADR não substitui nenhuma outra. Ajusta a URL citada pela ADR-031-FE e o seletor previsto em F-31 CA17.

## References

- [F-30](../../../backlog/features/F-30-busca-texto-livre.md), [F-31](../../../backlog/features/F-31-filtros-busca.md), [F-32](../../../backlog/features/F-32-deep-linking-busca.md), [F-33](../../../backlog/features/F-33-pagina-noticias-unificada.md)
- [ADR-026](./ADR-026-csr-no-mvp-medir-lcp-baseline.md), [ADR-027](./ADR-027-tanstack-query-usedebounced-deferred-url-ssot.md), [ADR-030-UI](./ADR-030-UI-filter-chips-radius-md-cards-thumb-left.md), [ADR-031-FE](./ADR-031-FE-lighthouse-ci-gate-buscar.md)
- Numeração: ADR-046 está reservada para a decisão de Storage da Sprint 6 (`docs/backlog/sprints/sprint-6-supabase-evaluation.md`); por isso esta é a 047.
