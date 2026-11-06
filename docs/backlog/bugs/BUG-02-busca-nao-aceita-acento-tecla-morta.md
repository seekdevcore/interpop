# BUG-02 — Busca não aceita letras acentuadas digitadas com tecla morta

> **Tipo**: Bug (defeito)
> **Severidade**: 🟠 Alta — barra o leitor pt-BR em qualquer palavra acentuada
> **Camada**: Frontend
> **Status**: ⏳ Aberto
> **Sprint**: a planejar · **Reportado**: 06/11/2026 (print do usuário no demo público)

---

## Defeito (observado × esperado)

- **Observado**: na página de busca (`/buscar`), digitar "polí" com teclado de tecla morta (acento agudo seguido de "i") gera "pol´i". O acento sai solto (U+00B4, `´`) e a busca responde "Nada encontrado para 'pol´i'".
- **Esperado**: "polí" aparece no campo como foi digitado (tecla morta, IME, teclado de celular), e a busca não diferencia acento nos dois sentidos: "política" encontra "politica" e "politica" encontra "política".

## Passos para reproduzir

1. Abrir https://interpop-demo.onrender.com/buscar (ou `npm run dev` → `/buscar`).
2. Com layout de teclado com tecla morta (ex.: ABNT2, US-Internacional), digitar `p`, `o`, `l`, `´`, `i`.
3. O campo mostra "pol´i" em vez de "polí", e o resultado é "Nada encontrado para 'pol´i'".

## Causa raiz (curto)

`src/pages/Buscar/components/SearchInput.tsx:84-85` usa `value={state.q}` lido direto da URL (`useSearchParamsState` → `setSearchParams`), "sem state local intermediário" de propósito (comentário nas linhas 7-10). O `BrowserRouter` do React Router 7 aplica cada mudança de estado de navegação dentro de `React.startTransition` (`startTransition(() => setStateImpl(newState))`, em `node_modules/react-router/dist/development/chunk-*.mjs`). No render síncrono que segue cada tecla, o input controlado volta ao valor antigo; isso interrompe a composição da tecla morta, que vira o caractere solto `´`. A documentação do React avisa que uma Transition não pode controlar um input de texto.

O campo "Buscar notícias…" de `/noticias` (`src/pages/News.tsx`, `useState` local nas linhas 37-38) não tem o defeito.

### Camada de comparação (não é a causa, mas entra no teste)

- **Postgres** (produção): já ignora acento (`CONFIGURATION pt_unaccent`, ADR-019).
- **Mock do demo** (`src/mocks/handlers/search.ts:33`): também ignora (NFD + remoção de marcas).
- **SQLite do dev** (fallback `__icontains`, ADR-020): **diferencia acento**. Risco de dev/teste: um teste ou verificação manual rodando em SQLite pode dar falso negativo para "política" ↔ "politica". Não é a causa deste bug.

### Relação com a ADR-027

O código de exemplo da [ADR-027](../../specs/busca-editorial/adrs/ADR-027-tanstack-query-usedebounced-deferred-url-ssot.md) lê o valor do campo direto da URL (`const inputQ = params.get("q")`), e a implementação seguiu esse exemplo à risca. A mesma ADR, em "Negative Consequences", já lista "input local" como um dos quatro estados. A correção abaixo cumpre essa intenção: a URL continua sendo a fonte da verdade do termo **comprometido**, o campo tem estado próprio enquanto o leitor digita. Avaliar no momento da correção se isso pede só uma nota de implementação ou uma ADR nova que substitua o trecho de escrita da ADR-027.

## Rastreabilidade ↑ (o que este defeito VIOLA)

| Viola     | ID                                      | Onde                                                                                                         |
| --------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Feature   | `F-30` — Busca por texto livre (US30.1) | [F-30](../features/F-30-busca-texto-livre.md) — cenário BDD "Termos com acento e plurais casam com radicais" |
| Feature   | `F-33` — Página Notícias unificada      | [F-33](../features/F-33-pagina-noticias-unificada.md) — CA32 (bloqueia a entrega)                            |
| Epic      | `EP-10` — Busca editorial               | [EP-10](../epics/EP-10-busca-editorial.md)                                                                   |
| Requisito | `RF-007` — Busca editorial              | [RF-007](../../requirements/RF/RF-007-busca-editorial.md) (idioma pt-BR é restrição explícita)               |

## Origem ← (de onde veio)

- Relato direto do usuário em 06/11/2026, com print do demo público. Causa localizada por leitura do código (`SearchInput.tsx`, `useSearchParamsState.ts`) e do React Router 7 instalado (`react-router-dom` ^7.15.1).

## Resolução ↓ (rastreabilidade da correção)

| Artefato            | Referência                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Direção da correção | Manter o valor digitado em estado local síncrono no `SearchInput`; sincronizar com a URL depois (debounce ou `compositionend`); não reescrever o campo enquanto `event.nativeEvent.isComposing` for verdadeiro; atualizar o campo a partir da URL só em navegação externa (voltar, link)                                                                                                   |
| Fix Task            | `[front]` — a criar quando entrar em sprint                                                                                                                                                                                                                                                                                                                                                |
| Commit / PR         | —                                                                                                                                                                                                                                                                                                                                                                                          |
| Teste de regressão  | **Exigido antes do código (política §6).** (1) Teste de componente do `SearchInput`: `compositionstart` → `´` → `i` → `compositionend` resulta em valor "í" (e "polí" para a sequência completa). (2) Teste de integração: termo "política" encontra artigo com "politica" e vice-versa, rodando contra o mock que normaliza acento (não contra SQLite). **Vermelho antes, verde depois.** |
| Postmortem          | Não exigido (sem perda de dado; defeito de UX pré-lançamento da busca em produção)                                                                                                                                                                                                                                                                                                         |

> Lição: controlar um input de texto com estado que o roteador aplica em Transition quebra composição de teclado. Estado do campo e estado da URL são coisas diferentes.
