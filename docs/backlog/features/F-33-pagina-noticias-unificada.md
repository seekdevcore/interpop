# F-33 — Página Notícias unificada (arquivo + busca)

> **Tipo**: Feature
> **Epic pai**: [EP-10 Busca editorial](../epics/EP-10-busca-editorial.md)
> **Sprint de execução**: a planejar
> **Status**: ⏳ Pending
> **Prioridade**: 🟠 Alta
> **Origem**: decisão de produto do usuário em 06/11/2026 (requisitos derivados confirmados pelo usuário na mesma data)
> **Decisão registrada em**: [ADR-047](../../specs/busca-editorial/adrs/ADR-047-pagina-noticias-unica-superficie-de-busca.md)

---

## Descrição (visão de produto)

Hoje o site tem duas buscas. A página **Notícias** (`/noticias`) é o arquivo de artigos com um campo "Buscar notícias…" e chips de editoria, mas a pesquisa dela é simples: não ignora acento e não ordena por relevância. A página de busca editorial (`/buscar`, entregue em [F-30](F-30-busca-texto-livre.md)) faz a pesquisa completa (acento, plurais, relevância, destaque dos termos), mas nenhum link do site leva até ela.

Esta Feature junta as duas numa página só. A página de busca editorial, com o visual e o comportamento atuais (campo grande, dica, área de filtros, resultados com destaque), passa a ser a página **Notícias**: título "Notícias", endereço `/noticias`, o mesmo destino que o menu já chama de "Notícias". Ela ganha os chips de editoria no estilo dos que existem hoje no arquivo ("Todos" + as 5 editorias). Com o campo vazio, a página mostra o arquivo completo, do artigo mais novo para o mais antigo. Com um termo, mostra os resultados da busca editorial, dentro da editoria escolhida.

O leitor deixa de ter de escolher entre "a busca que ele acha" e "a busca que funciona".

---

## Requisitos atendidos (rastreabilidade ↑)

| ID                                                                   | Requisito                                                                           | Relação             |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------- |
| [RF-007](../../requirements/RF/RF-007-busca-editorial.md)            | Leitor encontra artigos publicados a partir de um termo livre                       | Realiza diretamente |
| [RF-007](../../requirements/RF/RF-007-busca-editorial.md) §filtros   | Filtro por editoria (passa a ser feito por chips nesta Feature)                     | Realiza em parte    |
| [RF-007](../../requirements/RF/RF-007-busca-editorial.md) §deep-link | Estado da página (termo + editoria) fica na URL                                     | Mantém              |
| [RF-001](../../requirements/RF/RF-001-articles.md)                   | Leitura do acervo publicado (o arquivo de notícias continua existindo, agora aqui)  | Mantém              |
| [RNF-a11y](../../requirements/RNF/RNF-a11y.md)                       | WCAG 2.2 AA em todos os estados da página                                           | Realiza CA36        |
| [RNF-perf](../../requirements/RNF/RNF-perf.md)                       | LCP ≤ 2,5 s · INP ≤ 200 ms · CLS ≤ 0,1; carregamento sob demanda da busca (ADR-026) | Realiza CA37        |
| [RNF-availability](../../requirements/RNF/RNF-availability.md)       | Degradação graciosa quando a busca está desligada no servidor                       | Realiza CA35        |

### Relação com Features irmãs e com o bug

| Item                                                                                   | Relação                                                                                                                                      |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [F-30 Busca por texto livre](F-30-busca-texto-livre.md)                                | Base reaproveitada. A página `/buscar` muda de endereço para `/noticias` (nota registrada em F-30).                                          |
| [F-31 Filtros](F-31-filtros-busca.md)                                                  | O seletor de editoria em lista suspensa (CA17) é substituído pelos chips desta Feature (CA30). Autor e intervalo de datas continuam em F-31. |
| [F-32 Deep-linking](F-32-deep-linking-busca.md)                                        | A ordem canônica dos parâmetros (CA22) passa a valer em `/noticias`. Compartilhamento continua em F-32.                                      |
| [BUG-02 Acento com tecla morta](../bugs/BUG-02-busca-nao-aceita-acento-tecla-morta.md) | **Bloqueante.** A página unificada não pode ir ao ar enquanto o campo de busca não aceitar letras acentuadas (CA32 depende da correção).     |

---

## Critérios de Aceitação (CAs)

Numeração contínua de EP-10 (F-30: CA01–CA15 · F-31: CA16–CA21 · F-32: CA22–CA27). Todos os CAs abaixo são **decisão confirmada pelo usuário em 06/11/2026**.

| ID       | Critério                                                                                                                                                                                                                                                   | Como verificar                                                                                               | Status |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------ |
| **CA28** | O site tem uma única página de busca: `/noticias`, com o título "Notícias" e o visual atual da busca editorial (campo grande, dica, área de filtros, resultados com termos destacados)                                                                     | Teste de componente da página + smoke manual                                                                 | ⏳     |
| **CA29** | Com o campo vazio, a página lista todos os artigos publicados, do mais novo para o mais antigo, com o botão "Ver mais" para carregar a próxima página                                                                                                      | Teste de integração (campo vazio → lista ordenada + "Ver mais")                                              | ⏳     |
| **CA30** | A página mostra os chips "Todos", "Cinema", "Cultura Digital", "Literatura", "Moda" e "Música"; só um fica ativo por vez, o ativo é anunciado como pressionado, e "Todos" remove o filtro de editoria                                                      | Teste de componente dos chips (`aria-pressed`, clique, teclado)                                              | ⏳     |
| **CA31** | Editoria e termo combinam (ex.: "Música" + "kpop" mostra só artigos de Música que casam com "kpop"); trocar a editoria mantém o termo digitado, e apagar o termo mantém a editoria                                                                         | Teste de integração com os dois filtros + troca de chip                                                      | ⏳     |
| **CA32** | A pesquisa não diferencia acento nos dois sentidos ("política" encontra "politica" e vice-versa) e o campo mostra a letra acentuada como foi digitada, inclusive com tecla morta, IME e teclado de celular                                                 | Testes de regressão do [BUG-02](../bugs/BUG-02-busca-nao-aceita-acento-tecla-morta.md) + teste de integração | ⏳     |
| **CA33** | Endereços antigos continuam funcionando: `/noticias?categoria=<slug>` abre com o chip da editoria ativo; `/noticias?busca=X` abre com o termo X (o endereço passa a usar `q=X`); `/buscar?q=X` leva para `/noticias?q=X`, preservando os demais parâmetros | Teste de roteamento cobrindo os três formatos                                                                | ⏳     |
| **CA34** | Todo link interno que leva à busca ou ao arquivo aponta para `/noticias` (menu, rodapé, página 404, retorno após ação de administração); nenhum link do site aponta para `/buscar`, e a pesquisa antiga do arquivo deixa de existir                        | Busca no código (`grep`) + teste dos links do menu/rodapé/404                                                | ⏳     |
| **CA35** | Se a busca estiver desligada no servidor, a listagem e os chips de editoria continuam funcionando; só a pesquisa por termo mostra o aviso de indisponibilidade já existente, sem quebrar a página                                                          | Teste de integração com resposta 503 + `Retry-After`                                                         | ⏳     |
| **CA36** | A página passa sem violações no axe-core em todos os estados (arquivo, carregando, resultados, nada encontrado, erro, excesso de buscas), em tema claro e escuro, no celular e no computador; chips e campo são operáveis só por teclado                   | `a11y.test.tsx` estendido + checklist manual NVDA/VoiceOver (ADR-045)                                        | ⏳     |
| **CA37** | Em `/noticias` e `/noticias?q=kpop`: LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1; o código da busca continua carregado sob demanda (ADR-026), com acréscimo ≤ +20 KB gz em relação à linha de base                                                                | Lighthouse (gate ADR-031-FE, agora apontado para `/noticias?q=kpop`)                                         | ⏳     |

---

## User Stories

### US33.1 — Leitor percorre o arquivo de notícias por editoria

> **Como** leitor (anônimo ou autenticado)
> **Quero** abrir "Notícias" e ver os artigos mais recentes, filtrando por editoria com um clique
> **Para** acompanhar o que saiu sem precisar saber o que procurar.

- **Prioridade**: 🟠 Alta
- **Estimativa**: 5 Story Points
- **Status**: ⏳ Pending
- **CAs cobertos**: CA28, CA29, CA30, CA33, CA34
- **Persona**: [leitor anônimo + leitor autenticado](../../requirements/personas-e-cenarios.md)

#### Cenários BDD (Gherkin pt-BR)

```gherkin
Funcionalidade: Arquivo de notícias com filtro por editoria
  Como leitor do Interpop
  Quero ver os artigos mais recentes e filtrar por editoria
  Para acompanhar as publicações

Cenário: Página aberta sem termo mostra o arquivo completo
  Dado que existem artigos publicados
  Quando acesso "/noticias"
  Então vejo o título "Notícias"
  E vejo os artigos publicados do mais novo para o mais antigo
  E vejo o botão "Ver mais"
  E o chip "Todos" está pressionado

Cenário: Ver mais carrega a próxima página do arquivo
  Dado que estou em "/noticias" com o campo vazio
  Quando clico em "Ver mais"
  Então novos artigos aparecem abaixo dos que já estavam na tela
  E a ordem do mais novo para o mais antigo se mantém

Cenário: Chip de editoria filtra o arquivo
  Dado que estou em "/noticias"
  Quando clico no chip "Moda"
  Então vejo só artigos da editoria Moda
  E o chip "Moda" está pressionado
  E o endereço contém "categoria=moda"

Cenário: Link antigo do rodapé abre a editoria certa
  Quando acesso "/noticias?categoria=cinema"
  Então o chip "Cinema" está pressionado
  E vejo só artigos da editoria Cinema

Cenário: Endereço antigo da busca leva para Notícias
  Quando acesso "/buscar?q=moda&categoria=moda"
  Então sou levado para "/noticias?q=moda&categoria=moda"
  E o campo de busca mostra "moda"

Cenário: Parâmetro antigo do arquivo vira o novo
  Quando acesso "/noticias?busca=kpop"
  Então o campo de busca mostra "kpop"
  E o endereço passa a conter "q=kpop" no lugar de "busca=kpop"

Cenário: Menu leva à página unificada
  Dado que estou na página inicial
  Quando clico em "Notícias" no menu
  Então estou em "/noticias"
  E vejo o campo de busca da página
```

### US33.2 — Leitor pesquisa dentro de Notícias, com ou sem acento

> **Como** leitor
> **Quero** digitar um termo, com ou sem acento, e combinar com uma editoria
> **Para** achar uma análise específica sem me preocupar com a grafia exata.

- **Prioridade**: 🟠 Alta
- **Estimativa**: 5 Story Points
- **Status**: ⏳ Pending — bloqueada por [BUG-02](../bugs/BUG-02-busca-nao-aceita-acento-tecla-morta.md)
- **CAs cobertos**: CA31, CA32, CA35

#### Cenários BDD (Gherkin pt-BR)

```gherkin
Funcionalidade: Pesquisa por termo na página Notícias
  Como leitor do Interpop
  Quero pesquisar por termo dentro de uma editoria
  Para encontrar análises específicas

Cenário: Termo com acento digitado com tecla morta
  Dado que estou em "/noticias"
  Quando digito "polí" usando a tecla de acento agudo seguida de "i"
  Então o campo mostra "polí"
  E não aparece o caractere "´" solto no campo

Cenário: Busca ignora acento nos dois sentidos
  Dado que existe um artigo publicado com "política" no título
  E que existe um artigo publicado com "politica" no resumo
  Quando digito "politica"
  Então vejo os dois artigos nos resultados
  Quando troco o termo para "política"
  Então continuo vendo os dois artigos

Cenário: Editoria e termo combinados
  Dado que estou em "/noticias"
  Quando clico no chip "Música"
  E digito "kpop"
  Então vejo só artigos da editoria Música que casam com "kpop"
  E o endereço contém "q=kpop" e "categoria=música"

Cenário: Trocar a editoria não apaga o termo
  Dado que estou em "/noticias?q=kpop&categoria=música"
  Quando clico no chip "Moda"
  Então o campo continua mostrando "kpop"
  E vejo só artigos da editoria Moda que casam com "kpop"

Cenário: Apagar o termo volta ao arquivo da editoria
  Dado que estou em "/noticias?q=kpop&categoria=moda"
  Quando apago o conteúdo do campo
  Então vejo o arquivo da editoria Moda, do mais novo para o mais antigo
  E o chip "Moda" continua pressionado

Cenário: Busca desligada no servidor não derruba a página
  Dado que a busca por termo está desligada no servidor
  Quando acesso "/noticias"
  Então vejo o arquivo de artigos normalmente
  Quando digito "cinema"
  Então vejo o aviso de que não foi possível buscar agora
  E os chips de editoria continuam funcionando
```

### US33.3 — Leitor usa a página Notícias sem barreira de acesso ou de velocidade

> **Como** leitor que usa teclado, leitor de tela ou conexão móvel lenta
> **Quero** usar a página Notícias com a mesma facilidade dos demais leitores
> **Para** não ser excluído da descoberta editorial.

- **Prioridade**: 🟠 Alta
- **Estimativa**: 3 Story Points
- **Status**: ⏳ Pending
- **CAs cobertos**: CA36, CA37

#### Cenários BDD (Gherkin pt-BR)

```gherkin
Funcionalidade: Acessibilidade e desempenho da página Notícias

Cenário: Navegação só por teclado
  Dado que estou em "/noticias" usando apenas o teclado
  Quando avanço com Tab a partir do campo de busca
  Então o foco passa por cada chip de editoria de forma visível
  E Enter ou Espaço ativa o chip em foco
  E o leitor de tela anuncia o chip ativo como pressionado

Cenário: Mudança de resultado é anunciada
  Dado que estou em "/noticias" com leitor de tela ativo
  Quando digito "moda"
  Então o leitor de tela anuncia a quantidade de resultados sem roubar o foco do campo

Cenário: Página dentro do orçamento de desempenho
  Quando a página "/noticias?q=kpop" é medida no Lighthouse em perfil móvel
  Então o LCP é de no máximo 2,5 segundos
  E o CLS é de no máximo 0,1
  E o código da busca é carregado sob demanda, sem entrar no pacote inicial do site
```

---

## Tasks (rascunho — refinar no planejamento da sprint)

| ID      | Descrição                                                                                                                                                                  | Prioridade | US     |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| T33.1.1 | Rota `/noticias` passa a renderizar a página de busca (lazy + `Suspense`, ADR-026); título "Notícias"; remover `src/pages/News.tsx` só depois do cutover                   | 🟠         | US33.1 |
| T33.1.2 | Listagem com `q` vazio: `GET /api/v1/articles/?status=published&category__slug=<slug>` ordenado por `-published_at`, paginação "Ver mais" (escolha final da implementação) | 🟠         | US33.1 |
| T33.1.3 | Componente de chips de editoria (Todos + 5), estilo de `.home-filters__cat` + tokens `--clr-cat-*` / ADR-030-UI, `aria-pressed`                                            | 🟠         | US33.1 |
| T33.1.4 | `useSearchParamsState`: aceitar `categoria` (slug, inclusive `música` com acento), migrar `busca` → `q` com `replace: true`                                                | 🟠         | US33.1 |
| T33.1.5 | Rota `/buscar` vira redirecionamento para `/noticias` preservando a query string; `form action` do `SearchInput` passa a `/noticias`                                       | 🟠         | US33.1 |
| T33.1.6 | Revisar links: `Navbar.tsx`, `Footer.tsx`, `NotFound.tsx`, `ArticleAdminActions.tsx`; comentário "navbar futura" em `AppRouter.tsx`                                        | 🟡         | US33.1 |
| T33.2.1 | Com `q` ≥ 2: `GET /api/v1/search/articles/?q=&category=` (mapear slug → filtro aceito pelo endpoint); confirmar contrato com `SearchQuerySerializer`                       | 🟠         | US33.2 |
| T33.2.2 | Trocar chip não limpa `q`; limpar `q` mantém `categoria`; trocar `q` ou categoria reseta `cursor` (F-32 CA25)                                                              | 🟠         | US33.2 |
| T33.2.3 | Estado 503 só na área de resultados do termo; listagem por categoria segue independente (ErrorBoundary local, ADR-030-FE)                                                  | 🟡         | US33.2 |
| T33.2.4 | MSW: handler de listagem com `q` vazio + categoria no build do demo (`src/mocks/handlers/`)                                                                                | 🟡         | US33.2 |
| T33.3.1 | Estender `a11y.test.tsx` com o estado "arquivo" e os chips                                                                                                                 | 🟠         | US33.3 |
| T33.3.2 | Atualizar a URL do gate Lighthouse (ADR-031-FE / TX-16) de `/buscar?q=kpop` para `/noticias?q=kpop`                                                                        | 🟡         | US33.3 |

### Tasks transversais

| ID    | Descrição                                                                                                                                     | Prioridade | Para qual US   |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------- |
| TX-65 | Checklist de cutover: `SEARCH_FEATURE_ENABLED=True` + Postgres ativos em produção, verificados **antes** de remover a busca antiga do arquivo | 🔴         | US33.1, US33.2 |
| TX-66 | Atualizar o runbook do demo ([RB-05](../../runbooks/RB-05-demo-render.md)) quando o demo passar a mostrar a página unificada                  | 🟡         | US33.1         |

> Testes vêm antes do código (política §6 do projeto): cada Task de código abre com o teste que a cobre falhando.

---

## Pré-condição de deploy (decisão confirmada pelo usuário em 06/11/2026)

A busca antiga do arquivo (`GET /api/v1/articles/?search=`) só sai do ar depois que a busca editorial estiver ativa em produção: `SEARCH_FEATURE_ENABLED=True` (default hoje é `False`, [`backend/config/settings/base.py:437`](../../../backend/config/settings/base.py)) e banco Postgres (o fallback SQLite, ADR-020, diferencia acento). Sem isso o site fica sem pesquisa por termo. Verificação: TX-65.

---

## Estado atual do demo

O demo público (https://interpop-demo.onrender.com, build `npm run build:demo`, API simulada pelo MSW, runbook [RB-05](../../runbooks/RB-05-demo-render.md)) **segue com as duas buscas temporariamente**, por decisão do usuário em 06/11/2026: `/noticias` com a pesquisa simples e `/buscar` com a busca editorial. Isso muda quando esta Feature for entregue; o demo passa a mostrar só a página unificada (TX-66).

---

## Evidência do estado atual (código, branch `develop`)

- `src/pages/News.tsx` — arquivo com `?busca=` e `?categoria=`; trocar a editoria limpa o termo (`updateUrl(slug, '')`, linha 123).
- `backend/apps/articles/views.py:34` — `search_fields` do DRF SearchFilter (`icontains`, sensível a acento, sem ranking).
- `src/router/AppRouter.tsx` — rota lazy `/buscar`; comentário cita "navbar futura".
- `src/components/layout/Navbar.tsx`, `Footer.tsx`, `src/pages/NotFound.tsx` — apontam para `/noticias`; nenhum aponta para `/buscar`.
- `src/pages/Buscar/components/EmptyState.tsx` — campo vazio mostra só "Digite ao menos 2 caracteres para buscar artigos."

---

## Cross-references resumidas

| Direção                    | Onde                                                                                                                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ↑ Requisitos atendidos     | [RF-007](../../requirements/RF/RF-007-busca-editorial.md), [RNF-a11y](../../requirements/RNF/RNF-a11y.md), [RNF-perf](../../requirements/RNF/RNF-perf.md), [RNF-availability](../../requirements/RNF/RNF-availability.md) |
| ↑ Epic pai                 | [EP-10](../epics/EP-10-busca-editorial.md)                                                                                                                                                                                |
| → Sprint(s)                | a planejar                                                                                                                                                                                                                |
| → Decisão                  | [ADR-047](../../specs/busca-editorial/adrs/ADR-047-pagina-noticias-unica-superficie-de-busca.md)                                                                                                                          |
| → Bug bloqueante           | [BUG-02](../bugs/BUG-02-busca-nao-aceita-acento-tecla-morta.md)                                                                                                                                                           |
| ← Features irmãs sob EP-10 | [F-30](F-30-busca-texto-livre.md) (base), [F-31](F-31-filtros-busca.md) (CA17 substituído), [F-32](F-32-deep-linking-busca.md) (URL canônica)                                                                             |

---

_Criado em 2026-11-06 a partir de decisão de produto do usuário. Pending — sprint a planejar._
