# ADR-048: Login com Google como outra forma de entrar na mesma conta (o e-mail continua sendo a identidade)

- **Status:** Aceita
- **Data:** 2026-11-15
- **Tags:** produto, auth, segurança, lgpd, frontend, backend
- **Stakeholders:** Gabriel Marques (decisão de produto), code-implementer, cyber-security-architect
- **Camada:** Produto / Backend / Frontend
- **Requisito:** [RF-005: Usuários e autenticação](../../requirements/RF/RF-005-users-auth.md), item "SSO Google", que estava bloqueado por esta decisão
- **Origem:** réplica animada de 14/11, onde o login começa com "Entrar com Google" e o divisor "ou entre com seu e-mail" (ver `docs/planning/2026-11-14-replica-animada-execucao.md`)

## Contexto

O login com Google estava no backlog, travado por uma pergunta de produto: o e-mail com senha continua sendo a identidade principal da conta? A réplica aprovada em 14/11 põe o Google no topo das telas de login e de cadastro. Por isso a pergunta precisou ser respondida agora.

Dois fatos do sistema atual pesam na decisão:

1. **O cadastro não confirma o e-mail** (RF-005, item "Email verification" no backlog). Qualquer pessoa pode criar uma conta com o e-mail de outra.
2. **A sessão é JWT em cookie httpOnly**, gravado por `apps/users/services.py`, com django-axes contra força bruta no login por senha.

## O que guiou a decisão

- Cada pessoa tem uma conta só, sem conta duplicada para quem entra das duas formas.
- Ninguém pode ganhar acesso a uma conta que não é sua, mesmo sem a confirmação de e-mail.
- A sessão continua igual (o mesmo cookie e o mesmo `/auth/me/`), e o resto do site não percebe como a pessoa entrou.
- Banimento vale para qualquer forma de entrar.
- Minimização de dados (ADR-008).

## Opções consideradas

**Identidade da conta:**

1. **O e-mail continua sendo a identidade, e o Google é só mais uma porta para a mesma conta.** Escolhida.
2. Contas Google separadas das contas com senha. Descartada: a mesma pessoa poderia acabar com duas contas.

**E-mail do Google igual ao de uma conta que já tem senha:**

1. **Pedir a senha uma vez para ligar as duas.** Escolhida por Gabriel em 15/11.
2. Ligar direto e desligar a senha antiga. É seguro, mas a senha some sem a pessoa esperar.
3. Ligar direto e manter a senha. Descartada: quem criou a conta com o e-mail de outra pessoa continuaria entrando com a senha. Como o cadastro não confirma o e-mail, isso deixa a conta ser roubada antes mesmo de o dono aparecer.

**Implementação:**

1. **Google Identity Services com o botão oficial do Google e um token assinado, verificado no backend com a biblioteca `google-auth`.** Escolhida. Não precisa de client secret nem de redirecionamento, e se encaixa no login por cookie que já existe.
2. django-allauth. Descartada: é pesada, trabalha com sessão e redirecionamento, e não combina com o JWT em cookie.
3. Botão próprio usando o fluxo de código do OAuth. Daria controle total do visual, mas exige client secret no servidor e mais uma rota de retorno. Fica para depois, se o botão oficial destoar demais.

## Decisão

1. **O e-mail é a identidade.** Há uma conta por e-mail, e o Google é mais uma forma de entrar nela. A conta guarda o identificador do Google (`sub`) num campo novo, `User.google_sub`, único e opcional.
2. **Rota `POST /api/v1/auth/google/`** com o `credential` que o botão do Google devolve. O backend confere o token com `google.oauth2.id_token.verify_oauth2_token`, com `audience = GOOGLE_OAUTH_CLIENT_ID`, e só aceita se `email_verified` for verdadeiro. Os casos:
   - **O `sub` já está ligado a uma conta:** entra.
   - **Nenhuma conta com esse e-mail:** cria uma conta de leitor sem senha. O nome e o sobrenome vêm do Google, e o nome de usuário é gerado a partir do e-mail, com sufixo se já existir. A pessoa entra.
   - **Já existe uma conta com esse e-mail, sem Google:** a resposta é `409` com `code: "link_required"` e um `link_token` assinado (`django.core.signing`, vale 10 minutos, leva o `sub` e o e-mail). A tela pede a senha da conta e manda as duas para `POST /api/v1/auth/google/link/`. O backend confere a senha com `authenticate(request, ...)`, então o django-axes conta as tentativas erradas, grava o `sub` e a pessoa entra. Quem não lembra a senha usa "Esqueceu a senha?". Se a conta não tem senha (foi criada pelo Django admin), o caminho é o mesmo.
   - **Conta banida:** a mesma mensagem neutra do login por senha.
3. **A equipe também pode usar o Google** (decidido em 15/11). O Google nunca muda o cargo: conta nova é sempre de leitor, e promover continua sendo pelo painel ou por comando.
4. **Os dois endpoints usam o mesmo limite de tentativas do login** (`ScopedRateThrottle`, escopo `auth`).
5. **Dados:** guardar só o `sub`, o e-mail, o nome e o sobrenome. A foto do Google não é guardada (ADR-008). A Política de privacidade passa a dizer que o login com Google existe e quais dados vêm dele.
6. **Termos:** abaixo do botão, nas telas de login e de cadastro, aparece o aviso "Ao continuar com o Google, você aceita os Termos de uso e a Política de privacidade", com links para os dois.
7. **Configuração:** `GOOGLE_OAUTH_CLIENT_ID` no backend e `VITE_GOOGLE_CLIENT_ID` no frontend, os dois com o mesmo valor, que é público. Sem a variável, o botão não aparece e a rota responde `404`. O site demo (MSW, Render) não mostra o botão.
8. **Cabeçalhos:**
   - a CSP (hoje em Report-Only, débito S-03) passa a liberar `https://accounts.google.com` em `script-src`, `frame-src`, `connect-src` e `style-src`;
   - as páginas que mostram o botão precisam de `Cross-Origin-Opener-Policy: same-origin-allow-popups`, porque com `same-origin` a janela do Google não devolve o resultado. Conferir no Nginx de produção.
9. **Desempenho:** o script do Google (`https://accounts.google.com/gsi/client`) só carrega nas telas de login e de cadastro, com `async`, num espaço de altura fixa, para não mexer no LCP das outras páginas nem causar CLS.

## Pré-requisito fora do código

Criar o OAuth Client ID no Google Cloud com a conta Google do projeto:

1. Em console.cloud.google.com, criar ou escolher o projeto Interpop.
2. Na tela de consentimento OAuth, escolher o público Externo e preencher o nome "Interpop", o e-mail de suporte e o domínio do site. Os escopos são só `openid`, `email` e `profile`, que não exigem verificação do Google.
3. Em Credenciais, criar um ID do cliente OAuth do tipo **Aplicativo da Web**:
   - em **Origens JavaScript autorizadas**, pôr `http://localhost`, `http://localhost:5173` e `https://<domínio de produção>`;
   - URI de redirecionamento não é necessária, porque o fluxo do botão não usa redirecionamento.
4. Pôr o Client ID em `backend/.env` (`GOOGLE_OAUTH_CLIENT_ID`) e num `.env.local` na raiz (`VITE_GOOGLE_CLIENT_ID`). Os dois arquivos não vão para o Git.

## Consequências

**Positivas:**
- cadastro em um clique, que é a principal fricção que a réplica atacou;
- sem conta duplicada e sem conta roubada antes de o dono aparecer;
- a sessão e o banimento continuam num lugar só.

**Negativas:**
- uma dependência nova no backend (`google-auth`);
- um script de terceiro nas telas de acesso;
- o botão é o do Google, então o visual pode ficar um pouco diferente do da réplica (o tema "outline" com formato pílula é o mais próximo);
- quem já tem conta com senha passa por uma tela a mais, uma vez só.

**Fora desta decisão (backlog):**
- desligar o Google pela tela de perfil;
- outros provedores (Apple, Microsoft);
- confirmar o e-mail no cadastro por senha (continua no RF-005).

## Testes exigidos (§6)

- **pytest**, com a verificação do Google substituída por um dublê, cobrindo:
  - os quatro casos da decisão: `sub` já ligado, conta nova, conta existente pedindo a ligação e conta banida;
  - token com `email_verified=false` ou com outro `aud` é recusado;
  - `link_token` vencido ou adulterado é recusado;
  - senha errada na ligação conta para o django-axes;
  - conta criada pelo Google é de leitor e não tem senha;
  - sem a variável `GOOGLE_OAUTH_CLIENT_ID`, a rota responde `404`.
- **vitest**:
  - sem `VITE_GOOGLE_CLIENT_ID`, o botão não aparece;
  - a resposta `link_required` abre o pedido de senha;
  - o aviso dos termos tem os dois links.
