# RB-05 — Site demo no Render (para o design)

> **Tipo**: Runbook (procedimento operacional — NÃO é item de backlog)
> **Gatilho**: criar o site demo pela primeira vez, atualizar, tirar do ar ou reverter um deploy ruim
> **Status**: 🚧 Rascunho — build e smoke validados localmente em 2026-11-05; o primeiro deploy no Render ainda não foi feito

---

## Propósito

Dar ao designer um site navegável com a versão atual do frontend, sem backend e sem
dado real. Toda a API `/api/v1/*` é respondida no navegador pelo MSW, com dados
fictícios que ficam no `localStorage` de quem visita.

## Rastreabilidade ↑

| Operacionaliza    | ID  | Onde                                                                                               |
| ----------------- | --- | -------------------------------------------------------------------------------------------------- |
| Nenhum `RNF`      | —   | Ferramenta de design temporária; não faz parte do produto                                          |
| Blueprint         | —   | [`render.yaml`](../../render.yaml)                                                                 |
| Modo demo do Vite | —   | [`.env.demo`](../../.env.demo), scripts `dev:demo` / `build:demo` no package.json                  |
| API simulada      | —   | [`src/mocks/handlers/`](../../src/mocks/handlers/) + [`src/mocks/demo/`](../../src/mocks/demo/)    |
| Guarda do bundle  | —   | [`scripts/check-msw-bundle.mjs`](../../scripts/check-msw-bundle.mjs), passos no job Frontend do CI |

## Como funciona (resumo)

- O Render serve só arquivos estáticos (`npm ci && npm run build:demo`, publica `dist/`).
  O plano free de site estático não hiberna.
- `build:demo` roda o Vite com `--mode demo`. Nesse modo o `main.tsx` liga o MSW com todos
  os handlers e monta o painel "Modo demo" (canto inferior direito).
- O build de produção (`npm run build`) não leva MSW. O CI confere os dois lados:
  `check-msw-bundle.mjs --expect absent` no build normal e `--expect present` no build demo.
- Deploy automático a cada push na `develop`, só depois que os checks do GitHub passam
  (`autoDeployTrigger: checksPass`). PRs não geram preview.
- Todas as respostas levam `X-Robots-Tag: noindex, nofollow`, para o demo não aparecer
  em buscador nem competir com o site real.

## Procedimento

### 1. Criar o site (uma vez)

1. Confirmar que o `render.yaml` está na `develop` do GitHub.
   → **verificar**: `git ls-tree origin/develop render.yaml` mostra o arquivo.
2. Render → **New** → **Blueprint** → conectar o repositório `seekdevcore/interpop` → branch `develop`.
3. Conferir que o Render leu o serviço `interpop-demo` (Static Site) e clicar **Apply**.
   → **verificar**: o primeiro deploy termina como "Live" e a URL (`https://interpop-demo.onrender.com`,
   ou a que o Render mostrar) abre a home com artigos e o botão "Modo demo".
4. Mandar a URL e a seção "Contas e atalhos" abaixo para o designer.

### 2. Atualizar

Nada a fazer: merge na `develop` com CI verde publica sozinho. Para forçar, Render →
`interpop-demo` → **Manual Deploy** → **Deploy latest commit**.

### 3. Reverter um deploy ruim

Render → `interpop-demo` → **Deploys** → escolher o último deploy bom → **Rollback**.
→ **verificar**: a home abre e o painel "Modo demo" aparece.

### 4. Tirar do ar

- Pausar: Render → `interpop-demo` → **Settings** → **Suspend Service**.
- Apagar: **Settings** → **Delete Web Service**. Depois remover o `render.yaml` do repo
  (senão um novo Blueprint recria o serviço).

### 5. Rodar o demo localmente

```bash
npm run dev:demo                            # Vite dev com todos os mocks e o painel
npm run build:demo && npx vite preview      # o mesmo bundle que vai para o Render
```

## Contas e atalhos

O login aceita qualquer senha (só o cadastro valida senha, com as regras do Django).
O painel "Modo demo" troca de conta com um clique.

| Conta                | Papel   | Nome no seed  |
| -------------------- | ------- | ------------- |
| `dev@example.com`    | Dev     | Renata Duarte |
| `admin@example.com`  | Admin   | Marcos Vieira |
| `editor@example.com` | Editora | Ana Lima      |
| `leitor@example.com` | Leitor  | Carlos Rocha  |

- **Resetar dados** (no painel) apaga o que foi criado neste navegador e volta ao seed.
- Descadastro da newsletter: `/newsletter/cancelar/f6000000-0000-4000-8000-000000000001`.
- Redefinir senha: `/redefinir-senha/<qualquer UUID>` aceita o formulário.
- Busca: `q=flood` mostra o estado de limite (429); `q=qzxzqzx` mostra o estado vazio.

## Limitações conhecidas

- Os dados vivem no navegador de cada pessoa: o designer não vê o que outra pessoa criou.
- Imagens enviadas viram `blob:` e somem ao recarregar a página.
- Nenhum e-mail é enviado (newsletter, boas-vindas, redefinição de senha).
- Comentários não têm o limite anti-flood do backend.
- O painel de métricas mistura uma base sintética determinística com as contagens reais
  do seed; os números são plausíveis, não reais.

## Segurança

- Não há segredo no build: `.env.demo` só define `VITE_API_URL=` (vazio, mesma origem).
- O demo não fala com a produção (Hostinger) nem com nenhuma API externa.
- O seed usa só nomes e e-mails fictícios (`@example.com`); não copiar dado do `db.sqlite3`.

## Relacionados

- Postmortems que usaram este runbook: nenhum ainda.
