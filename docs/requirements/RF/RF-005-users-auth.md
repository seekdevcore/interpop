# RF-005 — Autenticação e autorização de usuários

> **Tipo**: Requisito Funcional
> **Prioridade**: 🔴 Imediato (sem este RF, nenhum outro RF de produto existe — comentário, publicação, moderação e administração dependem de identidade autenticada)
> **Status**: ✅ Realizado em código (Sprint 1, pre-busca) · 🚧 Documentação retroativa entregue 2026-06-09 com 5 débitos abertos (ver §Histórico)

---

## Enunciado de negócio (pt-BR, sem termo técnico)

> **Sistema reconhece um leitor pelo seu email e senha, mantém essa identidade ativa entre visitas sem pedir login novamente em cada página, oferece um caminho seguro para o leitor recuperar acesso quando esquece a senha, distingue diferentes papéis editoriais (leitor, redator, administrador, dono) e impede que pessoas banidas voltem a entrar, mesmo com a senha correta.**

### Subseção §registro

> Sistema permite que um visitante anônimo crie uma conta nova informando nome, sobrenome, email único, apelido público único e senha. Após o cadastro, o sistema entrega imediatamente uma sessão autenticada (sem etapa de confirmação de email no MVP — débito conhecido em §Restrições).

### Subseção §login

> Sistema permite que o leitor entre com email + senha. Falhas repetidas (5 em 30 minutos para a mesma combinação visitante+email) bloqueiam novas tentativas por 30 minutos, mesmo com credenciais corretas, para conter ataques automatizados. Contas inativas ou banidas têm o login recusado com mensagem neutra.

### Subseção §rotação-de-sessão

> Sistema mantém a sessão do leitor ativa por até 30 dias sem que ele precise digitar a senha novamente, renovando silenciosamente as credenciais a cada uso. Quando o leitor encerra a sessão, todas as credenciais ativas naquela sessão são invalidadas no servidor — não basta apagar o cookie local.

### Subseção §recuperação-de-senha

> Sistema oferece ao leitor que esqueceu a senha um fluxo de recuperação: ele informa o email, recebe um link único com validade de 1 hora, define uma nova senha por aquele link. A confirmação da troca encerra **todas** as outras sessões ativas daquela conta em qualquer dispositivo (padrão NYT/GitHub/Substack — sessões antigas não sobrevivem a uma recuperação).

### Subseção §troca-de-senha

> Sistema permite que o leitor logado troque a própria senha informando a senha atual + a nova. A confirmação encerra todas as sessões ativas em outros dispositivos (mesmo princípio de §recuperação-de-senha).

### Subseção §papéis

> Sistema distingue 4 papéis: `leitor` (pode ler, curtir, comentar), `redator` (acima + pode publicar artigos e abrir pedidos de banimento), `administrador` (acima + pode banir diretamente e gerenciar a redação), `dono` (acima + imune a banimento, pode banir qualquer outro). A hierarquia é estrita — admin não banem outros admins; só o dono pode. Dono nunca é banido por ninguém.

### Subseção §banimento

> Sistema impede o login de uma conta banida. Tentativas de autenticação recebem mensagem neutra (sem revelar se a conta existe ou está suspensa). Sessões já ativas no momento do ban continuam até o token de acesso expirar naturalmente (até 30 minutos) — limitação conhecida em §Restrições.

---

## Justificativa (por que este requisito existe)

Sem identidade autenticada, Interpop não existe como produto editorial:

- **Comentários** (RF-002) exigem autor identificado para moderação e responsabilização (LGPD + termos).
- **Publicação editorial** (RF-001) exige distinção entre quem pode publicar e quem só lê.
- **Moderação** (RF-003) é exercício de autoridade — sem hierarquia clara, o banimento é arbitrário.
- **Newsletter** (RF-004) é canal opt-in vinculado a uma conta.
- **Auditoria** (RF-006) precisa atribuir cada ação sensível a um ator identificado.

Riscos do sistema sem auth (motivação direta para Sprint 1):

| Risco                                                                                       | Impacto                                               |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Comentários anônimos viralizam linchamento / spam                                           | Reputação editorial destruída em 1 ciclo viral        |
| Publicação aberta a qualquer um                                                             | Conteúdo falso assinado como Interpop                 |
| Sem hierarquia, qualquer staff banem qualquer staff                                         | Guerra interna / takeover hostil de moderação         |
| Sem rate-limit em login, força-bruta em senha fraca expõe contas staff                      | Vazamento de drafts editoriais, takeover do `/admin/` |
| Sem invalidação de sessão pós-reset, atacante com senha vazada permanece logado para sempre | LGPD: incidente reportável; perda de confiança        |

**Implicação de produto**: auth não é "feature" — é pré-condição. Por isso entrou na Sprint 1, antes de qualquer artigo.

---

## Realizado por (rastreabilidade ↓)

| Epic                                                                                 | Feature(s)                                                                                                  | Status                                            |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| [EP-01 Fundação da plataforma](../../backlog/epics/EP-01-fundacao-plataforma.md)     | [F-01 Autenticação JWT em cookie httpOnly](../../backlog/features/F-01-autenticacao-jwt-cookie-httponly.md) | ✅ Done (Sprint 1, pre-busca)                     |
| [EP-06 Administração do sistema](../../backlog/epics/EP-06-administracao-sistema.md) | F-XX Hierarquia de papéis + comandos staff (a documentar retroativamente)                                   | 🚧 Doc retroativa pendente; código ✅ em Sprint 1 |

> **Honestidade de divisão**: F-01 cobre **registro + login + rotação + recuperação + troca de senha** (fluxos do leitor). Hierarquia de papéis, banimento direto e o management command `seed_team_users` são partes do **EP-06** porque tocam ferramentas administrativas. F-01 implementa apenas a **regra de hierarquia** (função `can_be_banned_by` + permissions DRF) — quem **opera** o ban vive em EP-06.

---

## Requisitos Não-Funcionais aplicáveis

| RNF                                            | Limite imposto a RF-005                                                                                                                        |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| [RNF-security](../RNF/RNF-security.md)         | Senha em Argon2; cookie `httpOnly + Secure + SameSite=Lax`; brute-force lockout 5/30min; throttle 10/min em login/register/password-reset      |
| [RNF-lgpd](../RNF/RNF-lgpd.md)                 | Email armazenado em lowercase; mensagens neutras em login/recovery anti-enumeration; `is_banned` semanticamente operacional, não dado sensível |
| [RNF-availability](../RNF/RNF-availability.md) | Auth endpoints exigem ≥ 99.5% uptime; falha de email (recuperação) não derruba registro/login                                                  |
| [RNF-a11y](../RNF/RNF-a11y.md)                 | Formulários de login/registro/recuperação WCAG 2.2 AA: labels, foco visível, erro anunciado via `aria-live`, contraste ≥ 4.5:1                 |
| [RNF-perf](../RNF/RNF-perf.md)                 | Login p95 ≤ 400ms (Argon2 é deliberadamente custoso); refresh p95 ≤ 100ms (sem hash)                                                           |

---

## Restrições e fora-de-escopo

### Dentro deste RF (MVP entregue Sprint 1)

- Email + senha como única forma de autenticação
- Sessão de 30 dias com rotação silenciosa
- Recuperação por link em email (1h de validade)
- 4 papéis: dono, admin, redator, leitor
- Brute-force defense por IP+username

### Explicitamente fora deste RF (backlog futuro)

| Item                                         | Onde está                                             | Por quê fora                                                                                                                              |
| -------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **2FA / TOTP para staff (dev/admin/editor)** | Backlog — `S-04` em CONCERNS                          | **Crítico** mas exige UX dedicada + janela de migração. Mitigação imediata: fechar `/admin/` por firewall até 2FA chegar.                 |
| **SSO Google (OAuth)**                       | Backlog (sem ADR ainda)                               | Reduz fricção de cadastro mas exige decidir se identidade primária continua sendo email/senha. Bloqueado por essa decisão de produto.     |
| **Magic link (login sem senha)**             | **Excluído permanentemente**                          | Conflita com modelo "sessão longa + recuperação por email": criaria dois caminhos de email-as-auth, multiplicando superfície de phishing. |
| **Email verification (confirmar email)**     | Backlog                                               | Cadastro hoje emite tokens imediatos sem confirmar email. Risco: cadastro com email alheio. Não bloqueador do MVP.                        |
| **DELETE account (LGPD)**                    | Backlog                                               | Hoje só admin remove via Django admin. Endpoint próprio exige decisão: anonimização vs hard-delete (comentários/artigos órfãos).          |
| **Endpoint API de promote/demote de papel**  | Backlog                                               | Hoje só management command + Django admin. Aceitável enquanto staff é < 10 pessoas.                                                       |
| **TTL diferenciada por papel**               | `docs/planning/session-auth-strategy.md` (gitignored) | Roadmap: `reader=60-90d / editor=14d / admin=4-8h`. Hoje uniforme 30d para simplicidade do MVP.                                           |

---

## Decisões técnicas relacionadas (ADRs)

Detalhe completo em [`docs/planning/adrs/`](../../planning/adrs/). Decisões que afetam diretamente o enunciado de RF-005:

- **ADR-008 — DPO/LGPD baseline** — define que dados pessoais (email, nome) seguem princípios de minimização e que mensagens de erro em login/recovery não revelam existência de conta.
- **ADR-010 — Versionamento `/api/v1/`** — endpoints de auth montados em `/api/v1/auth/*`.
- **ADR-012 — Atomicidade em mutações multi-tabela** — `PasswordResetConfirmSerializer.save()` é `@transaction.atomic` (fix C3 do Improvement-system §11.1). Sem isso, crash entre `set_password` e `token.is_used=True` deixava conta inacessível.
- **ADR-035 — HMAC env-driven com hard-fail em prod** — padrão arquitetural a **replicar** para `JWT_SIGNING_KEY` (débito S-02). Hoje há fallback silencioso para `SECRET_KEY`.

---

## Histórico

| Data       | Evento                                                                                                                                                                           |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sprint 1   | Implementação completa em código (`apps/users/`): User UUID custom, JWT cookie httpOnly, password reset por token UUID, django-axes, hierarquia 4-roles, `seed_team_users`.      |
| 2026-05-XX | Fix C1 (Improvement-system §11.1): rotação silenciosa quebrada em `services.py` — atributo `refresh.access_token.user` inexistente; substituído por `refresh['user_id']`.        |
| 2026-05-XX | Fix C3 (Improvement-system §11.1): `PasswordResetConfirmSerializer.save()` agora atomic.                                                                                         |
| 2026-06-06 | Fix F2-B-03 da busca (commit `96cdad5`): hard-fail `SEARCH_CURSOR_HMAC_SECRET` em prod. Padrão arquitetural identificado como **replicável** para resolver débito S-02 deste RF. |
| 2026-06-09 | Documentação retroativa: stub substituído por versão completa. Identifica 5 débitos abertos (§Débitos conhecidos) para virar Sprint de housekeeping ou hotfix.                   |

### Débitos abertos (cross-ref CONCERNS.md)

| ID                  | Severidade         | Resumo                                                                                                                  | Mitigação                                                                                                                                                                                     |
| ------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S-02**            | 🟠 Alta            | `JWT_SIGNING_KEY` faz fallback silencioso para `SECRET_KEY`. Vazamento de uma compromete a outra.                       | Replicar padrão `SEARCH_CURSOR_HMAC_SECRET` de F2-B-03 (commit `96cdad5`): `raise ImproperlyConfigured` em `production.py` se ausente OU igual a `SECRET_KEY`. **Candidato a hotfix.**        |
| **S-04**            | 🔴 Crítica         | Sem 2FA para `dev/admin/editor`. Senha + axes é a única barreira.                                                       | Imediata: fechar `/admin/` por firewall/WireGuard. Estrutural: TOTP via `django-otp` (mainstream). Decisão pendente: WebAuthn agora ou TOTP primeiro?                                         |
| **S-06**            | 🟡 Média (latente) | `IsNotBanned` em `DEFAULT_PERMISSION_CLASSES` vaza quando view declara `permission_classes` (DRF substitui, não merge). | Toda view privada nova deve **repetir** `IsNotBanned`. Auditar checklist em code review. Candidato a teste de integração genérico: enumerar views privadas e assertar `IsNotBanned` presente. |
| **Sessões pós-ban** | 🟡 Média           | Banimento impede login novo mas sessões ativas continuam até access expirar (≤30min).                                   | Aceitável para reader; problemático para staff. Chamar `blacklist_all_user_tokens(banned_user)` no ato do ban resolve.                                                                        |
| **DELETE account**  | 🟡 Média (LGPD)    | Não há endpoint de remoção própria — só admin via Django admin.                                                         | Backlog longo: decidir anonimização vs hard-delete; tratar artigos/comentários órfãos.                                                                                                        |

---

## Cross-references

- [Spec técnica completa](../../specs/users-auth/DESIGN.md) — fonte de verdade do módulo (§0 a §10)
- [Personas e cenários](../personas-e-cenarios.md) — leitor anônimo, leitor autenticado, redator, admin, dono
- [EP-01 Fundação da plataforma](../../backlog/epics/EP-01-fundacao-plataforma.md) — Epic pai (registro + login + sessão + recuperação)
- [EP-06 Administração do sistema](../../backlog/epics/EP-06-administracao-sistema.md) — Epic pai (hierarquia + banimento + comandos staff)
- [F-01 Autenticação JWT em cookie httpOnly](../../backlog/features/F-01-autenticacao-jwt-cookie-httponly.md) — Feature realizadora principal
- [RNF-security](../RNF/RNF-security.md), [RNF-lgpd](../RNF/RNF-lgpd.md), [RNF-availability](../RNF/RNF-availability.md), [RNF-a11y](../RNF/RNF-a11y.md), [RNF-perf](../RNF/RNF-perf.md)
- [ADR-008](../../planning/adrs/ADR-008-dpo-lgpd-baseline.md), [ADR-010](../../planning/adrs/ADR-010-api-v1-versioning.md), [ADR-012](../../planning/adrs/ADR-012-integridade-transacional.md), [ADR-035 HMAC env-driven](../../specs/busca-editorial/adrs/) (padrão a replicar)
- [CLAUDE.md §4](../../../CLAUDE.md) — hierarquia `dev > admin > editor > user`
- [Improvement-system.md](../../planning/Improvement-system.md) — histórico C1 (rotação silenciosa) + C3 (atomicidade reset)
- [Referência operacional não-versionada](../../planning/session-auth-strategy.md) (gitignored) — comparativo NYT/G1/BBC + roadmap TTL diferenciada

---

_RF-005 documentado retroativamente em 2026-06-09 (Skills aplicadas: `engenharia-de-requisitos`, `security-requirement-extraction`, `tlc-spec-driven`). Fonte de verdade: código em `backend/apps/users/` + `docs/specs/users-auth/DESIGN.md`. Próxima revisão: ao implementar hotfix S-02 (hard-fail `JWT_SIGNING_KEY`) ou ao adotar 2FA (S-04)._
