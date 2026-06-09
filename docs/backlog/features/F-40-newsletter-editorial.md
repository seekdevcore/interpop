# F-40 — Newsletter editorial

> **Tipo**: Feature
> **Epic pai**: [EP-04 Newsletter e comunicação](../epics/EP-04-newsletter-comunicacao.md)
> **Sprint de execução**: Sprint 2-3 (pre-busca) — implementação original · documentação retroativa Sprint 5 (chore/docs-reorg, PR #39)
> **Status**: ✅ Done — em produção desde Sprint 3 · 🔴 **2 hotfix candidatos invisíveis** (BUG-1/BUG-2)
> **Prioridade**: 🟠 Alta (canal owned crítico de retenção)

---

## Descrição (visão de produto)

Leitor (anônimo ou autenticado) digita seu email num formulário público (footer do site, modal de fim de artigo) e clica em "Inscrever". Sistema confirma na hora ("Inscrição realizada com sucesso!") e dispara em background um **email de boas-vindas** com link único de descadastro.

A partir desse momento, **toda vez que editor/admin publica um novo artigo**, o leitor recebe automaticamente um email com título, resumo, imagem de capa e link para o artigo completo. Quando quiser cancelar, basta clicar no link de descadastro presente em qualquer email — uma única ação resolve, sem precisar logar.

Esta Feature é a **fundação completa do canal newsletter** — F-41 (bounce + open rate), F-42 (segmentação) e F-43 (A/B subject) constroem em cima dela.

### Anti-sycophancy — o que esta Feature NÃO entrega

> Esta documentação é retroativa. **Sou direto sobre limites reais**:

- **Não há open rate tracking** — sem pixel, sem UTM padronizado. Métrica de engajamento zero hoje. Backlog F-41.
- **Não há bounce handling** — hard-bounce reentra em toda publicação e degrada reputação SMTP. Backlog F-41.
- **Não há segmentação** — leitor que só se importa com Música recebe peça de Cinema → unsub. Backlog F-42.
- **Não há `signal` no app `newsletter`** — o signal vive em `apps.articles.signals.py:42-64` (cross-app reverso). Foi decisão para corrigir bug histórico C2 (double-email). Detalhe arquitetural surpreendente, documentado em CA04 abaixo.
- **Unsubscribe é POST com token no body, não GET com token na URL** — violação consciente da convenção 1-click clássica. Trade-off documentado em CA06.
- **SendGrid declarado em ADR-004 mas NÃO instalado** — produção usa Gmail SMTP. Migração = 3 env vars, sem código.
- **2 bugs invisíveis** quebram funcionalidade silenciosamente (BUG-1 cover URL relativa em emails; BUG-2 swallow exception mata retry). Hotfix antes de Sprint 8.

---

## Requisitos atendidos (rastreabilidade ↑)

| ID                                                             | Requisito                                                              | Relação                    |
| -------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------- |
| [RF-004](../../requirements/RF/RF-004-newsletter.md)           | Cadastro + notificação por artigo + descadastro 1-clique               | Realiza integralmente      |
| [RNF-security](../../requirements/RNF/RNF-security.md)         | Throttle anon no subscribe; token UUID 122 bits não-enumerável         | Realiza CA01, CA05         |
| [RNF-lgpd](../../requirements/RNF/RNF-lgpd.md)                 | Opt-in explícito; link de unsub em todo email; direito ao esquecimento | Realiza CA07, CA09         |
| [RNF-availability](../../requirements/RNF/RNF-availability.md) | Celery worker isola SMTP do request HTTP; subscribe sempre 200         | Realiza CA02 (assíncrono)  |
| [RNF-a11y](../../requirements/RNF/RNF-a11y.md)                 | Templates inline-CSS Outlook-safe + multipart com texto puro           | Realiza templates de email |

---

## Critérios de Aceitação (CAs)

| ID       | Critério                                                                                                                                                                                                                                                                                                                  | Como verificar                                                                                                                             | Status                        |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| **CA01** | Leitor (anônimo ou autenticado) cadastra email para newsletter via `POST /api/v1/newsletter/subscribe/` com body `{email}` e recebe 200 + mensagem amigável                                                                                                                                                               | `tests/test_views.py:test_subscribe_creates_subscriber`                                                                                    | ✅                            |
| **CA02** | Sistema envia welcome email após subscribe via Celery task `send_welcome_email.delay(subscriber_id=...)` — view retorna sem esperar SMTP                                                                                                                                                                                  | `tests/test_views.py:test_subscribe_dispatches_welcome_email_task`                                                                         | ✅                            |
| **CA03** | Quando editor publica artigo (`Article.status` muda para `published`), sistema dispara `send_article_notification.delay(article_id=...)` que envia para **todos** os subscribers com `is_active=True`                                                                                                                     | `_dispatch_article_notification_sync` em `services.py:62-113`                                                                              | ✅                            |
| **CA04** | **Signal `post_save` de `Article` vive em `apps.articles.signals.py:42-64`, NÃO em `apps.newsletter.signals.py` (que NÃO existe).** Cross-app reverso (signal no produtor, não consumidor) é fix do bug histórico C2 que enviava 2 emails distintos por publicação                                                        | `apps/newsletter/apps.py:8-14` (sem `ready()` conectando signals)                                                                          | ✅ (decisão arquitetural)     |
| **CA05** | Email contém link único de unsubscribe com formato `${SITE_URL}/newsletter/cancelar/<uuid_token>` — UUID4 com 122 bits entrópicos, não-enumerável sem signing extra                                                                                                                                                       | `services.py:33` (template `${SITE_URL}/newsletter/cancelar/{token}`)                                                                      | ✅                            |
| **CA06** | Unsubscribe via `POST /api/v1/newsletter/unsubscribe/` com `{token}` no body — **NÃO GET com token na URL**. Trade-off: token não vaza em logs/Referer/histórico browser; custo: requer página FE intermediária; **viola RFC 8058 `List-Unsubscribe-Post`** (Gmail não mostra botão nativo)                               | `views.py:UnsubscribeView` + DESIGN §3.1 trade-off documentado                                                                             | ✅ (débito GAP-3)             |
| **CA07** | Unsubscribe marca `is_active=False` via `update_fields=['is_active']` — preserva `unsubscribe_token` para re-subscribe futuro funcionar com o mesmo link da newsletter velha                                                                                                                                              | `tests/test_views.py:test_subscribe_unsubscribe_resubscribe_full_cycle`                                                                    | ✅                            |
| **CA08** | `email` é único no DB via `EmailField(unique=True)` — subscribe duplicado **reativa** linha inativa em vez de criar nova (`get_or_create` no serializer)                                                                                                                                                                  | `tests/test_views.py:test_subscribe_duplicate_email_returns_200_and_does_not_duplicate` + `test_subscribe_reactivates_inactive_subscriber` | ✅                            |
| **CA09** | **LGPD opt-in explícito**: `subscribed_at` carimbado em `auto_now_add` como prova de consentimento. ⚠️ **Sem registro de IP, sem `consent_version`, sem texto exato apresentado** — débito L-01. Não há `unsubscribed_at` (débito L-02)                                                                                   | `models.py:6` (`subscribed_at = auto_now_add`)                                                                                             | 🟡 parcial (L-01/L-02)        |
| **CA10** | **SendGrid declarado em ADR-004 mas NÃO instalado** — produção usa Gmail SMTP (`base.py:226` default `smtp.gmail.com`). Migração para SendGrid é troca de 3 env vars (`EMAIL_HOST`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`) — sem mudança de código                                                                     | INTEGRATIONS.md §SendGrid + DESIGN §1 tabela "Django Email backend"                                                                        | 🟡 INT-1 (Sprint 8 candidato) |
| **CA11** | 🔴 **BUG-1 (hotfix candidato)**: `article.cover_image.url` é URL relativa em `article_notification.html:31`. Clientes de email NÃO resolvem contra `SITE_URL` — todos os subscribers recebem placeholder broken-image em TODA notificação. Test suite atual **não detecta** porque assert visual de URL absoluta inexiste | Arquivo `templates/newsletter/emails/article_notification.html:31` + observação 885 (May 29)                                               | 🔴 invisível                  |
| **CA12** | 🔴 **BUG-2 (hotfix candidato)**: `send_welcome` em `services.py:58-59` faz `except Exception: return False` — **mata o `autoretry_for=(Exception,)` da Celery task** (`tasks.py:53`). Falhas SMTP nunca dão retry e ninguém sabe que welcome não saiu                                                                     | `services.py:58` (try/except swallow) + comparação `tasks.py:50-71`                                                                        | 🔴 invisível                  |

---

## User Stories

### US40.1 — Leitor anônimo cadastra email para receber newsletter

> **Como** leitor anônimo do Interpop (sem conta no site)
> **Quero** digitar meu email no footer e receber um confirmação por email
> **Para** garantir que serei avisado de novas matérias sem precisar voltar manualmente.

- **Prioridade**: 🔴 Imediato (canal owned — base de retenção)
- **Estimativa**: 5 Story Points
- **Sprint**: 2 (pre-busca)
- **Status**: ✅ Done
- **CAs cobertos**: CA01, CA02, CA05, CA08, CA09
- **Persona**: leitor anônimo

#### Cenários BDD (Gherkin pt-BR)

```gherkin
Funcionalidade: Cadastro de leitor anônimo na newsletter
  Como leitor sem conta no site
  Quero me inscrever na newsletter informando apenas meu email
  Para receber novos artigos sem precisar voltar manualmente ao site

Cenário: Inscrição inédita com email válido (caminho feliz)
  Dado que estou no footer do site
  E que ainda não estou inscrito na newsletter
  Quando preencho "leitor@exemplo.com" no campo de email
  E clico em "Inscrever"
  Então vejo a mensagem "Inscrição realizada com sucesso!"
  E uma nova linha em "newsletter_subscribers" é criada com is_active=True
  E subscribed_at recebe o timestamp atual
  E um unsubscribe_token UUID é gerado automaticamente
  E uma task "send_welcome_email" é enfileirada via Celery

Cenário: Inscrição com email já existente e ativo
  Dado que "leitor@exemplo.com" já está inscrito com is_active=True
  Quando preencho o mesmo email novamente
  E clico em "Inscrever"
  Então vejo a mensagem "E-mail já inscrito e reativado."
  E nenhuma nova linha é criada (constraint unique respeitada)
  E o welcome email é re-enviado mesmo assim

Cenário: Reativação de inscrição cancelada anteriormente
  Dado que "leitor@exemplo.com" estava com is_active=False (já tinha cancelado)
  Quando preencho o mesmo email novamente
  E clico em "Inscrever"
  Então vejo a mensagem "E-mail já inscrito e reativado."
  E is_active passa para True
  E o unsubscribe_token original é preservado (mesmo UUID de antes)
  E subscribed_at NÃO é atualizado (carimbo do opt-in original)

Cenário: Email normalizado antes do lookup
  Dado que estou no footer do site
  Quando preencho "  LEITOR@Exemplo.com  " (com espaços e maiúsculas)
  E clico em "Inscrever"
  Então o email gravado no DB é "leitor@exemplo.com" (lowercase + trim)
  E uma busca por "leitor@exemplo.com" encontra esse registro
```

---

### US40.2 — Subscriber recebe notificação automática de novo artigo publicado

> **Como** leitor inscrito na newsletter (anônimo ou autenticado)
> **Quero** receber automaticamente um email cada vez que um novo artigo for publicado
> **Para** não perder nenhuma matéria sem precisar entrar no site todo dia.

- **Prioridade**: 🔴 Imediato (razão de existir do canal)
- **Estimativa**: 8 Story Points
- **Sprint**: 3 (pre-busca)
- **Status**: ✅ Done — mas atinge ⚠️ **BUG-1 ativo** (imagem quebrada em produção)
- **CAs cobertos**: CA03, CA04, CA10, **CA11 (BUG-1 invisível)**
- **Persona**: leitor anônimo inscrito + leitor autenticado inscrito

#### Cenários BDD (Gherkin pt-BR)

```gherkin
Funcionalidade: Notificação por artigo publicado
  Como subscriber ativo
  Quero receber email quando um artigo novo é publicado
  Para acompanhar o Interpop sem entrar no site

Cenário: Editor publica artigo novo (caminho feliz)
  Dado que existem 47 subscribers com is_active=True na lista
  E que um editor está editando um artigo com status="draft"
  Quando o editor muda status para "published" e salva
  Então o signal post_save em apps/articles/signals.py é disparado
  E became_published é avaliado como True (transição draft→published)
  E send_article_notification.delay(article_id=str(article.pk)) é chamado
  E o request HTTP do editor retorna sem esperar SMTP (ADR-009)
  E o worker Celery processa a task em background
  E cada um dos 47 subscribers recebe um email com título, excerpt e cover

Cenário: Editar artigo já publicado NÃO refaz fan-out (anti-double-email)
  Dado que existe um artigo já com status="published"
  E que existem 47 subscribers ativos
  Quando o editor muda apenas o título do artigo e salva
  Então o signal post_save é disparado
  E became_published é avaliado como False (prev_status já era "published")
  E send_article_notification.delay NÃO é chamado
  E nenhum email novo é enviado a nenhum subscriber

Cenário: Signal vive no app produtor, não no consumidor (decisão arquitetural)
  Dado que estou inspecionando apps/newsletter/apps.py
  Então NÃO encontro nenhum método ready() conectando signals
  E apps/newsletter/signals.py NÃO existe
  Quando inspeciono apps/articles/signals.py
  Então encontro a função _notify_subscribers_on_publish nas linhas 42-64
  E essa função importa apps.newsletter.tasks.send_article_notification

Cenário (BUG-1 ativo): Subscriber recebe email com imagem quebrada
  Dado que sou subscriber ativo
  E que produção usa MEDIA_URL relativa (ex: "/media/")
  Quando um editor publica artigo novo com cover_image
  E recebo a notificação no Gmail
  Então o template renderiza <img src="/media/covers/xxx.jpg"> (URL relativa)
  E meu cliente de email NÃO resolve a URL contra interpop.com.br
  E vejo placeholder broken-image no lugar da capa
  E o test suite atual NÃO falha (sem assert de URL absoluta)
  E ninguém é notificado do problema (silencioso em produção)
```

---

### US40.3 — Subscriber se descadastra via link único do email

> **Como** subscriber que não quer mais receber a newsletter
> **Quero** clicar em um link único no email e ver confirmação de cancelamento
> **Para** parar de receber sem precisar logar no site nem responder ao remetente.

- **Prioridade**: 🟠 Alta (LGPD compliance + boa prática de email)
- **Estimativa**: 5 Story Points
- **Sprint**: 2 (pre-busca)
- **Status**: ✅ Done
- **CAs cobertos**: CA05, CA06, CA07
- **Persona**: subscriber ativo querendo cancelar

#### Cenários BDD (Gherkin pt-BR)

```gherkin
Funcionalidade: Descadastro 1-clique via link do email
  Como subscriber que quer cancelar
  Quero clicar em um link único no email e confirmar o cancelamento
  Para parar de receber a newsletter sem precisar logar nem responder

Cenário: Cancelamento via link único (caminho feliz)
  Dado que sou subscriber ativo com unsubscribe_token "abc-123-uuid"
  Quando clico no link "https://interpop.com.br/newsletter/cancelar/abc-123-uuid" do email
  E a página FE faz POST /api/v1/newsletter/unsubscribe/ {token: "abc-123-uuid"}
  Então o backend valida o token via UnsubscribeSerializer.validate_token
  E encontra o subscriber com is_active=True
  E executa UPDATE is_active=False (update_fields=['is_active'])
  E retorna 200 com "Inscrição cancelada com sucesso."
  E o unsubscribe_token "abc-123-uuid" é PRESERVADO (não regenerado)

Cenário: Double-unsubscribe retorna 400 amigável (não 500)
  Dado que sou subscriber JÁ cancelado (is_active=False)
  Quando clico no mesmo link de cancelamento de novo
  E a página FE faz POST /api/v1/newsletter/unsubscribe/ {token: "abc-123-uuid"}
  Então o backend filtra is_active=True na query
  E não encontra o subscriber (já cancelado)
  E retorna 400 com mensagem "Token inválido ou já cancelado"
  E o erro NÃO é 500 (UX amigável mesmo em re-tentativa)

Cenário: Token preservado permite re-subscribe completo
  Dado que sou subscriber cancelado (is_active=False, token "abc-123-uuid")
  Quando faço novo subscribe com o mesmo email no footer
  Então is_active volta para True
  E meu unsubscribe_token continua "abc-123-uuid" (PRESERVADO)
  E o link da newsletter velha que recebi 6 meses atrás ainda funciona

Cenário (RFC 8058 ausente — GAP-3): Gmail não mostra botão nativo de cancelar
  Dado que estou abrindo o email da newsletter no Gmail
  Quando o Gmail busca por List-Unsubscribe-Post: List-Unsubscribe=One-Click
  Então o header NÃO está presente nos emails do Interpop
  E o Gmail NÃO mostra o botão "Cancelar inscrição" na barra superior
  E meu reputation score como remetente é prejudicado
  E o UX é pior comparado a newsletters que implementam RFC 8058
```

---

## Tasks (implementação)

### Tasks US-bound retroativas (todas ✅ Done — Sprint 2-3, pre-busca)

| ID      | Descrição                                                                                                                                                                                                                                | Prioridade | Status                                                 | Sprint |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------ | ------ |
| T40.1.1 | Bootstrap do Django app `apps.newsletter` (apps.py, urls.py, admin.py, estrutura de pastas)                                                                                                                                              | 🔴         | ✅ Done (Sprint 2-3, pre-busca)                        | 2      |
| T40.1.2 | Model `NewsletterSubscriber` (`email unique`, `subscribed_at auto_now_add`, `is_active default=True`, `unsubscribe_token UUIDField default=uuid.uuid4`) + Meta `db_table='newsletter_subscribers'` + index composto `(email, is_active)` | 🔴         | ✅ Done (Sprint 2-3, pre-busca)                        | 2      |
| T40.1.3 | Migration `0001_initial.py` — schema completo de `newsletter_subscribers`                                                                                                                                                                | 🔴         | ✅ Done (Sprint 2-3, pre-busca)                        | 2      |
| T40.1.4 | `SubscribeSerializer` com normalização `lower().strip()` em `validate_email` + `get_or_create` no save + reativação de inativo preservando token                                                                                         | 🔴         | ✅ Done (Sprint 2-3, pre-busca)                        | 2      |
| T40.1.5 | `SubscribeView` (APIView + AllowAny + AnonRateThrottle) chamando `send_welcome_email.delay(subscriber_id=str(pk))`                                                                                                                       | 🔴         | ✅ Done (Sprint 2-3, pre-busca)                        | 2      |
| T40.1.6 | Celery task `send_welcome_email` com `autoretry_for=(Exception,)` + `retry_backoff_max=300` + `max_retries=3`                                                                                                                            | 🔴         | ✅ Done (Sprint 2-3, pre-busca)                        | 2      |
| T40.1.7 | Service `send_welcome(subscriber)` em `services.py` (carrega template, monta `EmailMultiAlternatives` multipart, dispara)                                                                                                                | 🟠         | ✅ Done (Sprint 2-3, pre-busca) ⚠️ **contém BUG-2**    | 2      |
| T40.1.8 | Templates `templates/newsletter/emails/welcome.html` + `welcome.txt` + `base.html` (layout inline-CSS Outlook-safe)                                                                                                                      | 🟠         | ✅ Done (Sprint 2-3, pre-busca)                        | 2      |
| T40.1.9 | URLs `subscribe/` + `unsubscribe/` em `apps/newsletter/urls.py` + inclusão em `config/urls.py` sob `/api/v1/newsletter/`                                                                                                                 | 🟠         | ✅ Done (Sprint 2-3, pre-busca)                        | 2      |
| T40.2.1 | Celery task `send_article_notification(article_id)` com recarregamento por `pk` + `autoretry_for=(Exception,)` + `max_retries=2` (menos crítico que welcome)                                                                             | 🔴         | ✅ Done (Sprint 2-3, pre-busca)                        | 3      |
| T40.2.2 | Signal `post_save` em `apps/articles/signals.py:42-64` (cross-app reverso — produtor) + guard `became_published = created OR prev_status != PUBLISHED` para evitar refan-out                                                             | 🔴         | ✅ Done (Sprint 2-3, pre-busca) — fix bug C2 histórico | 3      |
| T40.2.3 | Service `_dispatch_article_notification_sync(article, subscribers=None)` em `services.py:62-113` (loop síncrono — chamar só de task)                                                                                                     | 🟠         | ✅ Done (Sprint 2-3, pre-busca)                        | 3      |
| T40.2.4 | Templates `article_notification.html` + `article_notification.txt` com título, excerpt, cover_image, link canônico, link unsub                                                                                                           | 🟠         | ✅ Done (Sprint 2-3, pre-busca) ⚠️ **contém BUG-1**    | 3      |
| T40.2.5 | Admin action `resend_notification` em `apps/articles/admin.py:30-50` (fallback editorial p/ reenvio manual em SMTP outage; usa `.delay()`)                                                                                               | 🟡         | ✅ Done (Sprint 2-3, pre-busca)                        | 3      |
| T40.3.1 | `UnsubscribeSerializer` com `validate_token` filtrando `is_active=True` + `update_fields=['is_active']` (preserva token)                                                                                                                 | 🔴         | ✅ Done (Sprint 2-3, pre-busca)                        | 2      |
| T40.3.2 | `UnsubscribeView` (APIView + AllowAny) chamando serializer (200 sucesso · 400 já cancelado/token inválido)                                                                                                                               | 🔴         | ✅ Done (Sprint 2-3, pre-busca)                        | 2      |
| T40.4.1 | Suite `tests/test_views.py` — 13 testes E2E batendo DB + Celery EAGER (subscribe inédito, duplicado, reativa, normaliza, welcome enqueue, unsub feliz, double-unsub, full cycle subscribe→unsub→resubscribe com token preservado)        | 🟠         | ✅ Done (Sprint 2-3, pre-busca)                        | 2-3    |
| T40.4.2 | Apps.py SEM `ready()` conectando signals (decisão consciente após bug C2) + comment explicativo `apps.py:8-14`                                                                                                                           | 🟠         | ✅ Done (Sprint 2-3, pre-busca)                        | 3      |

### Tasks transversais (TX) — retroativas (✅ Done Sprint 2-3, pre-busca)

| ID    | Descrição                                                                                                 | Prioridade | Status                          |
| ----- | --------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------- |
| TX-40 | Config Celery base + Redis broker em `config/settings/base.py` (ADR-009) — pré-requisito para tasks async | 🔴         | ✅ Done (Sprint 2-3, pre-busca) |
| TX-41 | Config `EMAIL_BACKEND` + `EMAIL_HOST` em `base.py:226` (default `smtp.gmail.com`) + flag `USE_REAL_EMAIL` | 🔴         | ✅ Done (Sprint 2-3, pre-busca) |

### Hotfix candidatos (descobertos em DESIGN retroativo 2026-06-09 — NÃO entram em Sprint 8)

| ID                   | Descrição                                                                                                                                                       | Prioridade  | Status                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------ |
| **HOTFIX-1 (BUG-1)** | Fix `cover_image.url` relativa em `article_notification.html:31` — passar `absolute_url` no contexto da task OU settear `MEDIA_URL` absoluta em `production.py` | 🔴 Imediato | ⏳ Pending (recomendado antes de Sprint 8) |
| **HOTFIX-2 (BUG-2)** | Remover `except Exception: return False` em `services.py:58-59` — deixar service propagar exceções pra `autoretry_for` da Celery task funcionar                 | 🔴 Imediato | ⏳ Pending (recomendado antes de Sprint 8) |
| HOTFIX-3             | Adicionar test de regressão para anti-double-fan-out (I5 do DESIGN — editar artigo publicado NÃO deve refan-out)                                                | 🟠 Alta     | ⏳ Pending (GAP-4 do DESIGN)               |

---

## Open Questions (para roadmap pós-F-40)

> Cada item abaixo é uma decisão pendente que afeta o produto. **Não delego de volta — recomendo a ordem abaixo**:

| #   | Pergunta                                                                          | Recomendação                                                                                                                                                                                                                                                | Bloqueio                                               |
| --- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1   | **BUG-1 — cover URL relativa quebra imagem em emails reais**                      | 🔴 Hotfix imediato. Investigar primeiro se `MEDIA_URL` em `production.py` é absoluta — possivelmente fix de 1 linha em settings (não em template).                                                                                                          | Nenhum                                                 |
| 2   | **BUG-2 — `except Exception` em `send_welcome` mata `autoretry_for` da task**     | 🔴 Hotfix imediato. Remover try/except do service; deixar exceção propagar pra task. UI já lida com 200 mesmo se SMTP falhar.                                                                                                                               | Nenhum                                                 |
| 3   | **Quando migrar Gmail SMTP → SendGrid real?**                                     | Sprint 8 (junto com F-41 bounce handling). Gmail teto 500/dia já é ceil rígido. SendGrid free tier 100/dia cobre até ~80 publicações/dia + desbloqueia webhooks de bounce/open                                                                              | Criar conta SendGrid + configurar DNS (SPF/DKIM/DMARC) |
| 4   | **GET unsubscribe RFC 8058 para Gmail mostrar botão nativo de cancelar (GAP-3)?** | Sprint 8 ou antes. Adicionar header `List-Unsubscribe-Post: List-Unsubscribe=One-Click` é 4 linhas em `services.py`. Endpoint POST `/api/v1/newsletter/unsubscribe-oneclick/?token=...` (sem CSRF, AllowAny) — Gmail manda direto sem precisar de página FE | Mínimo — concebível em 1 PR pequeno                    |
| 5   | **Adicionar `unsubscribed_at` + `consent_version` + `consent_ip` (L-01/L-02)?**   | Sprint 8 (migration custo < 10min; benefício compliance imediato + permite métricas churn). Pode entrar com hotfix 1/2.                                                                                                                                     | Nenhum                                                 |
| 6   | **Bounce handling via webhook SendGrid (GAP-1)?**                                 | Bloqueado por #3. Quando SendGrid plugado, webhook é 1 endpoint POST que faz `is_active=False` + grava `bounce_reason`                                                                                                                                      | Depende de #3                                          |
| 7   | **Open rate tracking via pixel (GAP-5)?**                                         | Sprint 8 **APÓS** modelo de opt-in granular LGPD (L-01 resolvido em #5). Sem opt-in separado, pixel viola LGPD                                                                                                                                              | Depende de #3 + #5                                     |
| 8   | **Substituir PK `BigAutoField` por `UUIDField` para coerência arquitetural?**     | ⚪ Baixa prioridade. Migration custosa, FKs cross-app inexistentes ajudam, mas churn não justifica hoje                                                                                                                                                     | Nenhum                                                 |
| 9   | **Cleanup policy de inativos (deletar `is_active=False` após N meses)?**          | Definir junto com modelo LGPD do projeto (retenção declarada). Sem ADR ainda — bloqueio é decisão de produto, não técnico                                                                                                                                   | Decisão editorial                                      |

---

## Definition of Done — verificação

- [x] CA01–CA10 verificados em código (em produção desde Sprint 3)
- [x] CA11–CA12 documentados como bugs invisíveis (não falham test suite atual — invisibilidade é parte do problema)
- [x] US40.1, US40.2, US40.3 com cenários BDD descritos (cenários BDD retroativos — código sem fixture explícita; 13 testes E2E em `tests/test_views.py` cobrem CAs implicitamente)
- [x] Todas as Tasks T40.X.X retroativas marcadas Done com nota "(Sprint 2-3, pre-busca)"
- [x] Code-review aprovado historicamente (sem PR específico — implementação inicial pré-processo de review formal)
- [x] Cobertura backend ≥ 85% no módulo (`apps/newsletter/`) via 13 testes E2E
- [x] Documentação cruzada atualizada — RF-004 + EP-04 + DESIGN.md citam esta Feature
- [x] Em produção via deploy contínuo (Sprint 3 → presente, sem regressão histórica conhecida além de BUG-1/BUG-2)
- [ ] **HOTFIX-1 / HOTFIX-2 pendentes** — recomendados antes de Sprint 8

**Status final**: ✅ **Done em produção** — mas com 2 bugs invisíveis recomendados pra hotfix imediato + 9 open questions pra roadmap pós-F-40.

---

## Specs técnicas relacionadas

- [DESIGN.md módulo newsletter](../../specs/newsletter/DESIGN.md) — 9 seções: stack, data model, contract, fluxos críticos (Mermaid), invariantes, runbook ops, débitos, cross-refs, open questions
- [INTEGRATIONS.md §SendGrid](../../specs/codebase/INTEGRATIONS.md) — config real Gmail vs. declarada SendGrid (INT-1)
- [CONCERNS.md](../../specs/codebase/CONCERNS.md) — INT-1 (SendGrid não usado), L-01 (sem proof granular), L-02 (sem `unsubscribed_at`), GAP-1/3/4/5

---

## Cross-references resumidas

| Direção                    | Onde                                                                                                                                                                                                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ↑ Requisitos atendidos     | [RF-004](../../requirements/RF/RF-004-newsletter.md), [RNF-security](../../requirements/RNF/RNF-security.md), [RNF-lgpd](../../requirements/RNF/RNF-lgpd.md), [RNF-availability](../../requirements/RNF/RNF-availability.md), [RNF-a11y](../../requirements/RNF/RNF-a11y.md) |
| ↑ Epic pai                 | [EP-04 Newsletter e comunicação](../epics/EP-04-newsletter-comunicacao.md)                                                                                                                                                                                                   |
| → Sprint(s)                | Sprint 2-3 (implementação original, pre-busca) · documentação retroativa em chore/docs-reorg (PR #39, 2026-06-09)                                                                                                                                                            |
| → Specs técnicas           | [DESIGN.md newsletter](../../specs/newsletter/DESIGN.md) + ADRs ADR-001, ADR-004, ADR-009, ADR-010                                                                                                                                                                           |
| → Features filhas          | n/a (F-40 é Feature, não Epic)                                                                                                                                                                                                                                               |
| ← Features irmãs sob EP-04 | F-41 Bounce handling + open rate (⏳ Sprint 8) · F-42 Segmentação por editoria (⏳ Sprint 8) · F-43 A/B subject lines (⏳ Sprint 8+)                                                                                                                                         |

---

_F-40 ✅ Done em produção desde Sprint 3. Documentação retroativa concluída em 2026-06-09 (chore/docs-reorg). **Próxima ação recomendada**: aplicar HOTFIX-1 + HOTFIX-2 antes de abrir Sprint 8 com F-41 — esses 2 bugs invisíveis quebram funcionalidade silenciosamente e degradam reputação de remetente cada dia que passa em produção._
