# F-01 — Autenticação JWT em cookie httpOnly

> **Tipo**: Feature
> **Epic pai**: [EP-01 Fundação da plataforma](../epics/EP-01-fundacao-plataforma.md)
> **Epic complementar**: [EP-06 Administração do sistema](../epics/EP-06-administracao-sistema.md) (hierarquia operada + comandos staff)
> **Sprint de execução**: Sprint 1 (pre-busca, anterior a Sprint 4)
> **Status**: ✅ Done em código · 🚧 Doc retroativa entregue 2026-06-09 com 5 Open Questions
> **Prioridade**: 🔴 Imediato (pré-condição para todo o produto editorial)

---

## Descrição (visão de produto)

Leitor entra no Interpop, cria conta com email + senha, e a partir daí o sistema o reconhece automaticamente entre visitas — sem pedir login a cada página, sem expor o token de sessão para JavaScript (proteção XSS), e renovando a credencial silenciosamente quando ela expira. Se esquecer a senha, recupera pelo email com um link de validade curta (1h); se trocar a senha, todas as outras sessões ativas em outros dispositivos são encerradas (padrão NYT/GitHub/Substack). Tentativas repetidas de login com senha errada bloqueiam temporariamente para conter ataques automatizados. Contas banidas têm o login recusado mesmo com a senha correta.

O sistema também distingue 4 papéis editoriais (dono, admin, redator, leitor) com uma hierarquia estrita — só o dono pode banir admins; admins não banem outros admins; redatores só abrem pedidos de banimento; leitores comuns não banem ninguém. Esta hierarquia é **regra dura** e está implementada como função canônica única (`can_be_banned_by`) que toda permission do sistema chama.

Esta Feature é **pré-condição** para tudo no produto: comentário, publicação, moderação, newsletter e auditoria dependem de identidade autenticada.

---

## Requisitos atendidos (rastreabilidade ↑)

| ID                                                             | Requisito                                                                             | Relação                                                                         |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [RF-005](../../requirements/RF/RF-005-users-auth.md)           | Autenticação e autorização de usuários                                                | **Realiza diretamente** (registro, login, rotação, recuperação, troca de senha) |
| [RNF-security](../../requirements/RNF/RNF-security.md)         | Argon2, cookie httpOnly+Secure+SameSite, brute-force lockout, throttle 10/min em auth | Realiza CA02, CA05, CA06, CA09                                                  |
| [RNF-lgpd](../../requirements/RNF/RNF-lgpd.md)                 | Mensagens neutras anti-enumeration; email em lowercase; pseudonimização em logs       | Realiza CA08, CA13                                                              |
| [RNF-a11y](../../requirements/RNF/RNF-a11y.md)                 | Formulários de auth WCAG 2.2 AA: labels, foco, aria-live em erros, contraste          | Realiza CA12                                                                    |
| [RNF-availability](../../requirements/RNF/RNF-availability.md) | Falha de email (Celery) não derruba registro/login                                    | Realiza CA10                                                                    |
| [RNF-perf](../../requirements/RNF/RNF-perf.md)                 | Login p95 ≤ 400ms (Argon2 deliberado); refresh p95 ≤ 100ms (sem hash)                 | Realiza CA11                                                                    |

---

## Critérios de Aceitação (CAs)

Derivados das invariantes I-01 a I-09 do [DESIGN.md §6](../../specs/users-auth/DESIGN.md). Cada CA é testável em booleano.

| ID       | Critério                                                                                                                                                         | Como verificar                                                          | Status                                                               |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **CA01** | Email é armazenado em lowercase; cadastro com `Foo@Bar.com` e login com `foo@bar.com` resolvem para a mesma conta                                                | Test `RegisterSerializer.validate_email` + login `iexact`               | ✅                                                                   |
| **CA02** | Login só é aceito quando `is_active=True AND is_banned=False`; conta inativa ou banida recebe mensagem **neutra** (sem distinguir entre "não existe" e "banido") | Test `LoginSerializer.validate` 3 cenários                              | ✅                                                                   |
| **CA03** | Username é único `iexact` mas o case original do input é preservado no armazenamento                                                                             | Test `RegisterSerializer.validate_username`                             | ✅                                                                   |
| **CA04** | Token JWT **nunca** sai no body de response — apenas em `Set-Cookie` com flags `HttpOnly`, `Secure`, `SameSite=Lax`                                              | Test `LoginView` inspeciona response body + headers; lint regex em PRs  | ✅ (verificar lint regex automatizado)                               |
| **CA05** | 5 falhas de login em 30 minutos na tupla `(ip, username)` bloqueiam novas tentativas por 30 minutos, **mesmo com credenciais corretas**                          | Test integração django-axes (mock IP)                                   | ✅                                                                   |
| **CA06** | Throttle adicional de 10 req/min escala por IP em `/login/`, `/register/`, `/password-reset/` (defesa em profundidade)                                           | Test `ScopedRateThrottle 'auth'`                                        | ✅                                                                   |
| **CA07** | Mudança de senha (troca **ou** recuperação) blacklista **todos** os `OutstandingToken` não-expirados do usuário                                                  | Test `services.blacklist_all_user_tokens` + integração                  | ✅                                                                   |
| **CA08** | `POST /password-reset/` retorna sempre HTTP 200, independente de o email existir (anti-enumeration)                                                              | Test `PasswordResetRequestView` 2 cenários                              | ✅                                                                   |
| **CA09** | `PasswordResetToken` é one-shot: `is_used=True` após consumo; segunda tentativa com mesmo token é recusada com 400                                               | Test `PasswordResetConfirmSerializer.validate_token` 4 cenários         | ✅                                                                   |
| **CA10** | `PasswordResetConfirmSerializer.save()` é `@transaction.atomic` — crash entre `set_password` e `is_used=True` deixa tudo desfeito                                | Test com `transaction.atomic` revert simulado                           | ✅ (ADR-012 / fix C3)                                                |
| **CA11** | Rotação silenciosa: 401 em endpoint privado dispara refresh transparente; sessão dura 30 dias sem login manual                                                   | Test E2E + test unit `services.rotate_refresh_token`                    | ✅ (fix C1 §11.1)                                                    |
| **CA12** | Função canônica `can_be_banned_by(actor)` é a **única** fonte de verdade para decidir banimentos; nenhuma view duplica lógica role-by-role                       | Test matriz 4×4 (dev/admin/editor/user × alvo dev/admin/editor/user)    | ✅                                                                   |
| **CA13** | Dono (`dev`) é imune a banimento por qualquer ator (inclusive outros dev); admin não bane outro admin (só dono); editor abre pedido (não bane direto)            | Test matriz acima                                                       | ✅                                                                   |
| **CA14** | Formulários de login/registro/recuperação têm labels, foco visível, erro anunciado via `aria-live`, contraste ≥ 4.5:1                                            | Test `a11y.test.tsx` + WAVE manual                                      | 🟡 axe-vitest parcial; E2E pendente                                  |
| **CA15** | `PasswordResetToken` expira em 1h a partir de `created_at`; tentativa após expiração retorna 400                                                                 | Test com `freezegun`                                                    | ✅                                                                   |
| **CA16** | Logout invalida o refresh token no servidor (blacklist), não apenas apaga cookies                                                                                | Test `LogoutView` + assert BlacklistedToken criado                      | ✅                                                                   |
| **CA17** | `IsNotBanned` em `DEFAULT_PERMISSION_CLASSES` impede acesso autenticado a usuário banido a qualquer endpoint privado padrão                                      | Test integração: criar user banido, autenticar, hit `/me/`, esperar 403 | ✅ — risco S-06 latente quando view sobrescreve `permission_classes` |

---

## User Stories

### US01.1 — Leitor cria conta nova

> **Como** visitante anônimo do Interpop
> **Quero** criar uma conta com meu email e senha
> **Para** poder comentar, curtir e receber a newsletter sob minha identidade.

- **Prioridade**: 🔴 Imediato
- **Estimativa**: 5 Story Points
- **Sprint**: 1 (pre-busca)
- **Status**: ✅ Done
- **CAs cobertos**: CA01, CA03, CA04, CA06, CA14
- **Persona**: [visitante anônimo](../../requirements/personas-e-cenarios.md)

#### Cenários BDD (Gherkin pt-BR)

```gherkin
Funcionalidade: Cadastro de leitor
  Como visitante anônimo
  Quero criar uma conta
  Para participar do Interpop como leitor identificado

Cenário: Cadastro válido entrega sessão imediata (caminho feliz)
  Dado que estou na página "/cadastro" como visitante anônimo
  Quando preencho nome "Ana", sobrenome "Silva", email "Ana@Exemplo.com", apelido "ana_silva" e senha "S3nh@F0rte!"
  E confirmo a senha
  E envio o formulário
  Então recebo a resposta com meus dados públicos (sem token no corpo)
  E o navegador recebe os cookies "access_token" e "refresh_token" com flags HttpOnly e Secure
  E meu email é armazenado como "ana@exemplo.com" (lowercase)
  E meu apelido é armazenado como "ana_silva" (case preservado)
  E eu sou redirecionada para a home já autenticada

Cenário: Email já cadastrado é recusado com mensagem clara
  Dado que existe uma conta com email "ana@exemplo.com"
  Quando tento cadastrar nova conta com email "Ana@Exemplo.com"
  Então vejo a mensagem "Este email já está em uso"
  E o foco vai para o campo de email
  E o erro é anunciado por leitores de tela via aria-live

Cenário: Mais de 10 tentativas de cadastro em 1 minuto são bloqueadas
  Dado que sou um visitante anônimo
  Quando envio 11 requisições de cadastro em 60 segundos
  Então a 11ª recebe HTTP 429
  E vejo a mensagem "Muitas tentativas. Aguarde Xs"
  E o header Retry-After indica o tempo até liberação

Cenário: Formulário é acessível por teclado e leitor de tela
  Dado que estou na página "/cadastro" usando apenas teclado
  Quando navego com Tab pelos campos
  Então cada campo tem label visível associado
  E o foco é visualmente destacado em cada elemento
  E erros de validação são anunciados via aria-live="assertive"
  E o contraste de texto/fundo é ≥ 4.5:1 em todos os estados (rest, focus, error)
```

---

### US01.2 — Leitor faz login com sessão persistente de 30 dias

> **Como** leitor já cadastrado
> **Quero** entrar com meu email e senha uma vez
> **Para** continuar autenticado entre visitas sem digitar a senha novamente, com renovação silenciosa.

- **Prioridade**: 🔴 Imediato
- **Estimativa**: 8 Story Points
- **Sprint**: 1 (pre-busca)
- **Status**: ✅ Done (com fix C1 em rotação silenciosa)
- **CAs cobertos**: CA01, CA02, CA04, CA05, CA06, CA11, CA16, CA17
- **Persona**: [leitor autenticado](../../requirements/personas-e-cenarios.md)

#### Cenários BDD (Gherkin pt-BR)

```gherkin
Funcionalidade: Login com sessão persistente
  Como leitor já cadastrado
  Quero entrar e permanecer autenticado
  Para não digitar senha em toda visita

Cenário: Login válido emite cookies httpOnly e sessão de 30 dias (caminho feliz)
  Dado que existe conta ativa, não banida, com email "ana@exemplo.com" e senha "S3nh@F0rte!"
  Quando envio POST "/api/v1/auth/login/" com {email: "Ana@Exemplo.com", password: "S3nh@F0rte!"}
  Então recebo HTTP 200 com dados públicos (sem token no body)
  E o cookie "access_token" tem flags HttpOnly, Secure, SameSite=Lax, validade 30 minutos
  E o cookie "refresh_token" tem flags HttpOnly, Secure, SameSite=Lax, path="/api/v1/auth/refresh/", validade 30 dias
  E meu campo "last_login" no banco é atualizado

Cenário: Rotação silenciosa renova a sessão sem login manual
  Dado que estou autenticado e meu access_token acabou de expirar (>30 minutos)
  Quando o frontend faz GET "/api/v1/auth/me/" e recebe HTTP 401
  E o frontend chama POST "/api/v1/auth/refresh/" automaticamente
  Então recebo HTTP 200 com novos cookies access_token e refresh_token
  E o refresh_token antigo está blacklistado no servidor
  E o frontend refaz o GET "/api/v1/auth/me/" com sucesso (HTTP 200)
  E a transição é invisível para o leitor

Cenário: Login após 5 falhas em 30 minutos é bloqueado mesmo com senha correta
  Dado que falhei 5 vezes seguidas no login com email "ana@exemplo.com" no último 30 minutos
  Quando tento entrar com a senha CORRETA
  Então recebo HTTP 403 com mensagem de lockout
  E o bloqueio dura 30 minutos
  E o evento é registrado no AuditLog

Cenário: Conta banida é recusada com mensagem neutra (anti-enumeration)
  Dado que existe conta ativa porém banida com email "spammer@exemplo.com"
  Quando envio POST "/api/v1/auth/login/" com credenciais corretas
  Então recebo HTTP 401 com mensagem genérica "Credenciais inválidas"
  E a mensagem NÃO distingue "conta não existe" de "conta banida" de "senha errada"

Cenário: Logout invalida refresh no servidor (não só apaga cookie)
  Dado que estou autenticado com refresh_token T1
  Quando envio POST "/api/v1/auth/logout/"
  Então recebo HTTP 205
  E os cookies access_token e refresh_token são removidos do navegador
  E o refresh_token T1 é blacklistado no servidor
  E tentar usar T1 em POST "/api/v1/auth/refresh/" retorna HTTP 401

Cenário: Token JWT nunca aparece no body de response (XSS hardening)
  Dado que faço qualquer request de auth (login, register, refresh, me)
  Quando inspeciono o corpo da resposta
  Então o corpo NÃO contém os caracteres "eyJ" (prefixo Base64 padrão de JWT)
  E o corpo NÃO contém os campos "access" ou "refresh" como string
  E tokens existem apenas em headers Set-Cookie
```

---

### US01.3 — Leitor recupera acesso quando esquece a senha

> **Como** leitor que esqueceu a senha
> **Quero** redefinir minha senha via email
> **Para** voltar a entrar sem perder minha conta, com garantia de que sessões antigas em outros dispositivos sejam encerradas.

- **Prioridade**: 🔴 Imediato
- **Estimativa**: 5 Story Points
- **Sprint**: 1 (pre-busca)
- **Status**: ✅ Done (com fix C3 — atomicidade)
- **CAs cobertos**: CA07, CA08, CA09, CA10, CA15
- **Persona**: [leitor autenticado em recovery](../../requirements/personas-e-cenarios.md)

#### Cenários BDD (Gherkin pt-BR)

```gherkin
Funcionalidade: Recuperação de senha por email
  Como leitor que esqueceu a senha
  Quero redefinir minha senha via link no email
  Para recuperar acesso sem perder minha conta

Cenário: Solicitação com email existente envia link de validade 1h (caminho feliz)
  Dado que existe conta com email "ana@exemplo.com"
  Quando envio POST "/api/v1/auth/password-reset/" com {email: "ana@exemplo.com"}
  Então recebo HTTP 200 com mensagem "Se a conta existir, enviamos um email"
  E uma tarefa Celery "send_password_reset_email" é enfileirada
  E um PasswordResetToken é criado com expires_at = now + 1 hora
  E todos os tokens anteriores não-usados desse usuário são invalidados (is_used=True)

Cenário: Solicitação com email inexistente retorna 200 (anti-enumeration)
  Dado que NÃO existe conta com email "fantasma@exemplo.com"
  Quando envio POST "/api/v1/auth/password-reset/" com {email: "fantasma@exemplo.com"}
  Então recebo HTTP 200 com a MESMA mensagem do cenário anterior
  E NENHUMA tarefa Celery é enfileirada
  E NENHUM PasswordResetToken é criado
  E o tempo de resposta é estatisticamente indistinguível do cenário anterior (timing attack defense)

Cenário: Confirmação com senha nova encerra todas as sessões em outros dispositivos
  Dado que tenho 3 sessões ativas (laptop, celular, tablet) e recebi um PasswordResetToken válido
  Quando envio POST "/api/v1/auth/password-reset/confirm/" com {token: "<uuid>", new_password: "N0v@S3nh4!"}
  Então recebo HTTP 200
  E minha senha é atualizada no banco (Argon2 hash)
  E o token é marcado como is_used=True
  E TODOS os OutstandingToken não-expirados das minhas 3 sessões são blacklistados
  E a próxima request de qualquer um dos 3 dispositivos retorna 401 e força login
  E TODA a operação está dentro de uma transação atomic

Cenário: Token expirado é recusado com 400
  Dado que recebi um PasswordResetToken há 2 horas
  Quando envio POST "/api/v1/auth/password-reset/confirm/" com esse token + senha nova
  Então recebo HTTP 400 com mensagem "Token expirado ou inválido"
  E minha senha NÃO é alterada
  E o token permanece com is_used=False (não foi consumido)

Cenário: Token já usado é recusado (one-shot)
  Dado que consumi um PasswordResetToken com sucesso há 5 minutos (is_used=True)
  Quando envio POST "/api/v1/auth/password-reset/confirm/" com o MESMO token e outra senha
  Então recebo HTTP 400 com mensagem "Token expirado ou inválido"
  E minha senha NÃO é alterada novamente

Cenário: Formulário de recuperação é acessível
  Dado que estou na página "/recuperar-senha" usando leitor de tela
  Quando navego pelos campos com teclado
  Então o campo de email tem label visível e descrição programática
  E o estado de envio é anunciado via aria-live="polite"
  E erros (token expirado, senha fraca) são anunciados via aria-live="assertive"
  E o contraste de texto/fundo é ≥ 4.5:1 em todos os estados
```

---

## Tasks (implementação)

Tasks foram executadas em **Sprint 1 (pre-busca)** — anteriores ao versionamento detalhado de commits que começou em Sprint 4. Marcadas como `✅ Done` sem hash específico; código vive em `backend/apps/users/`.

### Tasks US-bound (T01.M.K)

#### Para US01.1 (cadastro)

| ID      | Descrição                                                                                                | Prioridade | Status                        | Sprint |
| ------- | -------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------- | ------ |
| T01.1.1 | Custom `User` UUID-PK herdando `AbstractBaseUser + PermissionsMixin` (sem `username` clássico do Django) | 🔴         | ✅ Done (Sprint 1, pre-busca) | 1      |
| T01.1.2 | `USERNAME_FIELD = 'email'`; email validado lowercase `iexact`                                            | 🔴         | ✅ Done (Sprint 1, pre-busca) | 1      |
| T01.1.3 | `RegisterSerializer` com regex `[A-Za-z0-9_.-]+` em `username`; case preservado, unicidade `iexact`      | 🔴         | ✅ Done (Sprint 1, pre-busca) | 1      |
| T01.1.4 | `RegisterView` emite tokens imediatos via `services.issue_tokens_for_user`                               | 🔴         | ✅ Done (Sprint 1, pre-busca) | 1      |
| T01.1.5 | Migration inicial — `users_user` com índice composto `(role, is_active, is_banned)`                      | 🟠         | ✅ Done (Sprint 1, pre-busca) | 1      |

#### Para US01.2 (login + sessão + rotação)

| ID      | Descrição                                                                                                                                                      | Prioridade | Status                                | Sprint |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------- | ------ |
| T01.2.1 | `LoginSerializer.validate` chama `authenticate()` + assert `is_active and not is_banned`                                                                       | 🔴         | ✅ Done (Sprint 1, pre-busca)         | 1      |
| T01.2.2 | `services.issue_tokens_for_user(user)` seta cookies `access_token` (30min, path=/) e `refresh_token` (30d, path=/api/v1/auth/refresh/)                         | 🔴         | ✅ Done (Sprint 1, pre-busca)         | 1      |
| T01.2.3 | Flags de cookie: `HttpOnly=True`, `Secure=True` (False em dev override), `SameSite=Lax`                                                                        | 🔴         | ✅ Done (Sprint 1, pre-busca)         | 1      |
| T01.2.4 | `services.rotate_refresh_token` — lê refresh do cookie, blacklista, emite par novo                                                                             | 🔴         | ✅ Done (Sprint 1) + **fix C1** §11.1 | 1      |
| T01.2.5 | **Fix C1**: substituir `refresh.access_token.user` (atributo inexistente) por `User.objects.get(pk=refresh['user_id'])` + log `exc_info` ao invés de silenciar | 🔴         | ✅ Done (mid-Sprint, pre-busca)       | 1      |
| T01.2.6 | `LogoutView` blacklista refresh + chama `services.logout_user` (clear cookies)                                                                                 | 🔴         | ✅ Done (Sprint 1, pre-busca)         | 1      |
| T01.2.7 | `RefreshView` (`AllowAny`) lê refresh do cookie, blacklista, emite par novo                                                                                    | 🔴         | ✅ Done (Sprint 1, pre-busca)         | 1      |
| T01.2.8 | `MeView` (GET retorna `UserPublicSerializer`; PATCH usa `UpdateProfileSerializer`)                                                                             | 🟠         | ✅ Done (Sprint 1, pre-busca)         | 1      |
| T01.2.9 | `ChangePasswordView` valida senha antiga → `services.blacklist_all_user_tokens` → `services.logout_user`                                                       | 🔴         | ✅ Done (Sprint 1, pre-busca)         | 1      |

#### Para US01.3 (recuperação de senha)

| ID      | Descrição                                                                                                                                             | Prioridade | Status                          | Sprint |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------- | ------ |
| T01.3.1 | `PasswordResetToken` model — UUID token, `expires_at = created_at + 1h`, one-shot via `is_used`                                                       | 🔴         | ✅ Done (Sprint 1, pre-busca)   | 1      |
| T01.3.2 | `PasswordResetRequestView` — sempre HTTP 200 (anti-enumeration); enfileira `send_password_reset_email.delay()`                                        | 🔴         | ✅ Done (Sprint 1, pre-busca)   | 1      |
| T01.3.3 | `PasswordResetConfirmSerializer.validate_token` — assert UUID + `is_valid` (not used and not expired)                                                 | 🔴         | ✅ Done (Sprint 1, pre-busca)   | 1      |
| T01.3.4 | **Fix C3**: envolver `PasswordResetConfirmSerializer.save()` em `@transaction.atomic` — `set_password` + `is_used=True` + `blacklist_all_user_tokens` | 🔴         | ✅ Done (mid-Sprint, pre-busca) | 1      |
| T01.3.5 | Tarefa Celery `send_password_reset_email(email, token)` — template HTML + texto                                                                       | 🟠         | ✅ Done (Sprint 1, pre-busca)   | 1      |

#### Para hierarquia (compartilhada US01.2 / EP-06)

| ID      | Descrição                                                                                                                                    | Prioridade | Status                        | Sprint |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------- | ------ |
| T01.4.1 | 4 roles em choices: `dev`, `admin`, `editor`, `user`; default = `user`                                                                       | 🔴         | ✅ Done (Sprint 1, pre-busca) | 1      |
| T01.4.2 | Properties canônicas em `User`: `is_admin` (admin OU dev), `can_publish` (dev/admin/editor)                                                  | 🔴         | ✅ Done (Sprint 1, pre-busca) | 1      |
| T01.4.3 | Função canônica `can_be_banned_by(actor)` — única fonte de verdade para hierarquia. Toda permission/view DEVE chamá-la (não duplicar lógica) | 🔴         | ✅ Done (Sprint 1, pre-busca) | 1      |
| T01.4.4 | `can_be_unbanned_by(actor)` espelha mesma regra — impede admin de desfazer ban que dev aplicou em outro admin                                | 🟠         | ✅ Done (Sprint 1, pre-busca) | 1      |
| T01.4.5 | DRF permissions: `IsAdminUser`, `IsAdminOrReadOnly`, `IsPublisherOrReadOnly`, `IsOwnerOrAdmin`, `IsNotBanned`, `IsEditorOrAdmin`             | 🔴         | ✅ Done (Sprint 1, pre-busca) | 1      |
| T01.4.6 | `IsNotBanned` em `REST_FRAMEWORK.DEFAULT_PERMISSION_CLASSES` (defense in depth — risco S-06 quando view sobrescreve `permission_classes`)    | 🟠         | ✅ Done (Sprint 1, pre-busca) | 1      |

### Tasks transversais (TX-NN)

| ID    | Descrição                                                                                                                                     | Prioridade | Status                             | Sprint |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------- | ------ |
| TX-01 | Configuração `SIMPLE_JWT` em `config/settings/base.py:132-159` (HS256, ACCESS=30min, REFRESH=30d, ROTATE=True, BLACKLIST_AFTER_ROTATION=True) | 🔴         | ✅ Done (Sprint 1, pre-busca)      | 1      |
| TX-02 | Argon2 como `PASSWORD_HASHERS[0]` em `base.py:106`                                                                                            | 🔴         | ✅ Done (Sprint 1, pre-busca)      | 1      |
| TX-03 | django-axes settings: `AXES_FAILURE_LIMIT=5`, `AXES_COOLOFF_TIME=30min`, `AXES_LOCKOUT_PARAMETERS=['ip_address', 'username']`                 | 🔴         | ✅ Done (Sprint 1, pre-busca)      | 1      |
| TX-04 | `ScopedRateThrottle 'auth': 10/min` em login/register/password-reset                                                                          | 🟠         | ✅ Done (Sprint 1, pre-busca)      | 1      |
| TX-05 | Management command `seed_team_users` — cria dev/admin/editor staff idempotente lendo `.env` (escopo de EP-06 também)                          | 🟠         | ✅ Done (Sprint 1, pre-busca)      | 1      |
| TX-06 | URLs `/api/v1/auth/*` em `apps/users/urls.py:15-26`, montadas em `config/urls.py`                                                             | 🔴         | ✅ Done (Sprint 1, pre-busca)      | 1      |
| TX-07 | Refresh cookie path-restrito a `/api/v1/auth/refresh/` (reduz superfície)                                                                     | 🟠         | ✅ Done (Sprint 1, pre-busca)      | 1      |
| TX-08 | **Hotfix S-02 (candidato)**: `JWT_SIGNING_KEY` hard-fail em prod replicando padrão `SEARCH_CURSOR_HMAC_SECRET` (commit `96cdad5`, ADR-035)    | 🔴         | ⏳ **Pendente** — backlog imediato | TBD    |

### Tasks pendentes (housekeeping / hotfix)

| ID     | Descrição                                                                                                                                            | Prioridade  |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| T01.X1 | **Hotfix S-02**: `production.py` lê `JWT_SIGNING_KEY` obrigatório; `raise ImproperlyConfigured` se ausente OU igual a `SECRET_KEY`                   | 🔴 Imediato |
| T01.X2 | **Mitigação S-04**: fechar `/admin/` por firewall/WireGuard até 2FA TOTP entrar (decisão pendente: TOTP via `django-otp` ou WebAuthn)                | 🔴 Imediato |
| T01.X3 | **Audit S-06**: enumerar todas as views privadas; assertar que `IsNotBanned` aparece explícito (não delega ao DEFAULT). Test de integração genérico  | 🟠 Alta     |
| T01.X4 | **Sessões pós-ban**: chamar `services.blacklist_all_user_tokens(banned_user)` no ato do ban — hoje sessão ativa sobrevive até access expirar (30min) | 🟠 Alta     |
| T01.X5 | **LGPD DELETE account**: endpoint `DELETE /me/` com decisão anonimização vs hard-delete; tratar artigos/comentários órfãos                           | 🟡 Normal   |
| T01.X6 | **Email verification flow** — adicionar campo `email_verified` + token de confirmação; cadastro hoje emite sessão sem verificar email                | 🟡 Normal   |
| T01.X7 | **Test E2E a11y completo** dos 3 formulários de auth (login, registro, recuperação) com `axe-playwright` nos estados rest/focus/error                | 🟡 Normal   |
| T01.X8 | `request.session.cycle_key()` pós-login (S-08 — session fixation latente se XSS chegar)                                                              | 🟡 Normal   |
| T01.X9 | Decidir: remover `is_banned` de `UserPublicSerializer` público OU manter intencional (info-disclosure observação `860`)                              | ⚪ Baixa    |

---

## Definition of Done — verificação

- [x] CA01–CA13, CA15, CA16 verificados por automated test
- [x] CA14 verificado parcialmente (axe-vitest nos componentes; E2E pendente — T01.X7)
- [x] CA17 verificado por test integração; risco S-06 latente identificado (T01.X3 audit pendente)
- [x] US01.1, US01.2, US01.3 com cenários BDD documentados
- [x] Todas as Tasks 🔴 Imediato (exceto TX-08 hotfix S-02) com status `✅ Done` em Sprint 1
- [x] Fix C1 (rotação silenciosa) e Fix C3 (atomicidade reset) aplicados mid-Sprint 1
- [x] Mergeada em `main` via Sprint 1 (pre-2026-05; sem PR # específico documentado)
- [x] Em produção no Hostinger KVM 1 desde Sprint 1
- [ ] **2FA / TOTP para staff** — deliberadamente DEFERRED para backlog (S-04 crítico mas exige UX dedicada; mitigação imediata é firewall em `/admin/`)
- [ ] **Hotfix S-02 (JWT_SIGNING_KEY hard-fail)** — pendente; candidato a próxima ação não-Sprint-5

**Status final**: ✅ **Done em código** com 5 Open Questions abertas, 1 hotfix candidato (TX-08 / T01.X1) e 1 mitigação operacional crítica (T01.X2).

---

## Specs técnicas relacionadas

- [`docs/specs/users-auth/DESIGN.md`](../../specs/users-auth/DESIGN.md) — fonte de verdade técnica (responsabilidade, data model, public contract, fluxos críticos com diagramas Mermaid, invariantes, conhecimento operacional, status/débitos, open questions)
- [`docs/planning/session-auth-strategy.md`](../../planning/session-auth-strategy.md) (gitignored) — comparativo NYT/G1/BBC + roadmap TTL diferenciada por papel + step-up auth + multi-device session list. **Não duplicado** no DESIGN.
- [`docs/planning/Improvement-system.md`](../../planning/Improvement-system.md) §11.1 — histórico dos fixes C1 (rotação silenciosa) e C3 (atomicidade reset)

---

## Open Questions (próximas decisões)

Espelha [DESIGN.md §10](../../specs/users-auth/DESIGN.md). Bloco crítico que **deve** virar Sprint de housekeeping de auth:

1. **S-04 — 2FA staff (CRÍTICO)**: TOTP via `django-otp` ou WebAuthn primeiro? Sem 2FA, a única barreira para `dev/admin/editor` é senha + axes. Mitigação imediata: T01.X2 (firewall em `/admin/`).
2. **S-02 — JWT_SIGNING_KEY fallback para SECRET_KEY**: vazamento de uma compromete a outra. **Candidato a hotfix** (T01.X1 / TX-08) replicando padrão F2-B-03 da busca (`96cdad5`). Esforço estimado: 1h.
3. **S-06 — IsNotBanned em DEFAULT_PERMISSION_CLASSES vaza por omissão**: DRF substitui (não merge) quando view declara `permission_classes`. Toda view privada nova precisa **repetir** `IsNotBanned`. **Audit pendente** (T01.X3).
4. **Sessões ativas pós-ban**: banimento impede login novo mas sessões ativas continuam até access expirar (≤30min). Aceitável para reader, problemático para staff. Fix: `blacklist_all_user_tokens(banned_user)` no ato do ban (T01.X4).
5. **DELETE account flow (LGPD)**: hoje só admin via Django admin. Decisão pendente: anonimização vs hard-delete; tratar artigos/comentários órfãos. (T01.X5)

Adicionais (não-bloqueadores do MVP):

6. **Email verification flow** — não existe; cadastro emite tokens imediatos (T01.X6).
7. **Social login (OAuth Google)** — sem ADR; demanda de produto bloqueada por decisão de identidade primária.
8. **Session invalidation em mudança de email** — `MeView PATCH` não invalida sessões hoje (mesmo padrão S7?).
9. **Endpoint API de promote/demote role** — hoje só management command + Django admin.
10. **TTL diferenciada por role** — `reader=60-90d / editor=14d / admin=4-8h` no roadmap de `session-auth-strategy.md`.

---

## Cross-references resumidas

| Direção                    | Onde                                                                                                                                                                                                                                                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ↑ Requisitos atendidos     | [RF-005](../../requirements/RF/RF-005-users-auth.md), [RNF-security](../../requirements/RNF/RNF-security.md), [RNF-lgpd](../../requirements/RNF/RNF-lgpd.md), [RNF-a11y](../../requirements/RNF/RNF-a11y.md), [RNF-availability](../../requirements/RNF/RNF-availability.md), [RNF-perf](../../requirements/RNF/RNF-perf.md) |
| ↑ Epic pai                 | [EP-01 Fundação da plataforma](../epics/EP-01-fundacao-plataforma.md)                                                                                                                                                                                                                                                        |
| ↑ Epic complementar        | [EP-06 Administração do sistema](../epics/EP-06-administracao-sistema.md) (ferramentas operadas de hierarquia + banimento + comandos staff)                                                                                                                                                                                  |
| → Specs técnicas           | [users-auth/DESIGN.md](../../specs/users-auth/DESIGN.md)                                                                                                                                                                                                                                                                     |
| → Sprint(s)                | Sprint 1 (entrega original, pre-busca) · Sprint TBD (housekeeping / hotfix S-02 / 2FA)                                                                                                                                                                                                                                       |
| → Features filhas          | n/a (F-01 é Feature, não Epic)                                                                                                                                                                                                                                                                                               |
| ← Features irmãs sob EP-01 | F-02 (Django bootstrap), F-03 (Observability), F-04 (CI gates), F-05 (Frontend bootstrap) — 🚧 docs retroativas pendentes                                                                                                                                                                                                    |
| → Consumido por (todos)    | F-XX articles, F-XX comments, F-XX moderation, F-XX newsletter, F-XX audit, [F-30 busca](F-30-busca-texto-livre.md)                                                                                                                                                                                                          |
| → ADRs                     | [ADR-008](../../planning/adrs/ADR-008-dpo-lgpd-baseline.md), [ADR-010](../../planning/adrs/ADR-010-api-v1-versioning.md), [ADR-012](../../planning/adrs/ADR-012-integridade-transacional.md), ADR-035 (padrão HMAC env-driven a replicar)                                                                                    |
| → CLAUDE.md                | [§4 hierarquia `dev > admin > editor > user`](../../../CLAUDE.md)                                                                                                                                                                                                                                                            |

---

_F-01 doc retroativa criada em 2026-06-09 (Skills aplicadas: `engenharia-de-requisitos`, `security-requirement-extraction`, `tlc-spec-driven`, `architecture-decision-records`). Código em `backend/apps/users/` desde Sprint 1. Próxima ação: aplicar hotfix S-02 (T01.X1) e definir janela de 2FA (S-04). Fonte de verdade técnica: [DESIGN.md](../../specs/users-auth/DESIGN.md)._
