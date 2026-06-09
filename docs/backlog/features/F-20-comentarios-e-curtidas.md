# F-20 — Comentários e curtidas

> **Tipo**: Feature
> **Epic pai**: [EP-03 Engajamento da comunidade](../epics/EP-03-engajamento-comunidade.md)
> **Sprint de execução**: Sprint 2-3 (pré-formalização — documentação retroativa em 2026-06-09)
> **Status**: ✅ Done em código (Sprint 2-3, pre-busca)
> **Prioridade**: 🟠 Alta (espinhaço de engajamento editorial)

---

## Descrição (visão de produto)

Leitor autenticado entra no artigo, lê, e pode **comentar** abaixo. Outros leitores podem **responder** ao comentário (uma única vez na árvore — o Interpop corta aninhamento em 1 nível para preservar legibilidade editorial). Qualquer leitor pode **curtir** comentários alheios para sinalizar concordância sem precisar escrever. Quem se arrepende **remove** o próprio comentário; o conteúdo desaparece da tela, mas a linha permanece no banco para auditoria. Admin pode remover comentário de qualquer leitor (moderação reativa); editor não tem esse poder.

Leitor **banido** perde acesso de escrita (POST de comentário, POST de like, DELETE) por defesa em profundidade — banimento não esconde comentários antigos, apenas trava ações futuras.

A leitura pública (GET) é aberta — anônimo enxerga tudo, mas não escreve nada. Comentários em artigo `draft` são invisíveis e bloqueados para escrita.

Esta Feature é a **fundação** do engajamento. Features futuras (F-21 notificações, F-22 anti-spam) constroem em cima dela.

---

## Requisitos atendidos (rastreabilidade ↑)

| ID                                                             | Requisito                                                                                   | Relação                      |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------- |
| [RF-002](../../requirements/RF/RF-002-comments.md)             | Sistema permite leitor autenticado comentar, responder, curtir e remover                    | Realiza diretamente          |
| [RNF-security](../../requirements/RNF/RNF-security.md)         | Auth obrigatória, defesa em profundidade `IsNotBanned`, throttle `comments_create` é débito | Realiza CA04, CA12 (parcial) |
| [RNF-a11y](../../requirements/RNF/RNF-a11y.md)                 | Form e botões acessíveis por teclado                                                        | Realiza CA13                 |
| [RNF-lgpd](../../requirements/RNF/RNF-lgpd.md)                 | Soft-delete preserva audit trail; cleanup é débito (OPS-2)                                  | Realiza CA06 (parcial)       |
| [RNF-availability](../../requirements/RNF/RNF-availability.md) | Falha de `apps.comments` não derruba leitura do artigo                                      | Realiza implicitamente       |

---

## Critérios de Aceitação (CAs)

| ID       | Critério                                                                                                                                  | Como verificar                                                                 | Status                                       |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------- |
| **CA01** | Leitor autenticado e não banido cria comentário top-level em artigo publicado                                                             | `test_create_comment_authenticated_returns_201` (`test_views.py`)              | ✅                                           |
| **CA02** | Leitor responde a outro comentário do mesmo artigo via `parent_id` no payload                                                             | `test_create_reply_with_valid_parent_returns_201`                              | ✅                                           |
| **CA03** | Apenas 1 nível de aninhamento — resposta a uma resposta retorna 400 ("Comentário pai inválido")                                           | `validate_parent_id` filtra `parent=None` (`serializers.py:48`)                | 🟡 GAP-1 (sem teste direto da invariante I8) |
| **CA04** | Leitor banido recebe 403 ao tentar criar, responder, curtir ou remover (defesa em profundidade `IsNotBanned`)                             | `test_create_comment_banned_user_returns_403` (`test_views.py:123`)            | ✅                                           |
| **CA05** | Leitor remove seu **próprio** comentário (`IsOwnerOrAdmin`); admin remove de qualquer leitor; editor não remove de terceiros              | `test_delete_other_users_comment_returns_403` (`test_views.py:224`)            | ✅                                           |
| **CA06** | Remoção é lógica (soft-delete): `is_deleted=True`, `deleted_at=now`, `deleted_by=user`; conteúdo some do display público; linha permanece | `test_delete_own_comment_soft_deletes` (`test_views.py:207`)                   | ✅                                           |
| **CA07** | Comentários soft-deletados não aparecem em listagem pública (`filter(is_deleted=False)` em `views.py:38`)                                 | `test_list_comments_hides_soft_deleted` (`test_views.py:67`)                   | ✅                                           |
| **CA08** | Replies a comentário soft-deletado ficam órfãos no DB (parent some da API; reply sobrevive sem aparecer como top-level)                   | _Comportamento atual sem decisão de UX_ — débito OPS-1                         | 🟡 ambíguo (ver Open Questions)              |
| **CA09** | Leitor curte comentário (POST `/api/v1/comments/<uuid>/like/`); idempotente via `unique_together('comment','user')`                       | `test_like_comment_creates_like_returns_200`                                   | ✅                                           |
| **CA10** | Leitor descurte ao chamar o mesmo endpoint novamente (toggle); resposta retorna `{liked: false, likes_count: N}`                          | `test_like_twice_unlikes_returns_200`                                          | ✅                                           |
| **CA11** | `likes_count` retornado == `count(CommentLike WHERE comment=X)` (invariante de integridade)                                               | `test_like_count_correct_with_multiple_users` (`test_views.py:287`)            | ✅                                           |
| **CA12** | Throttle específico `comments_create` protege contra flood em artigo viral                                                                | _Sem `ScopedRateThrottle` configurado_ — débito **S-07** (hotfix candidate)    | ❌ **GAP DE SEGURANÇA**                      |
| **CA13** | Form de comentário, botão de curtida e estado "removido" acessíveis por teclado e leitor de tela                                          | Manual via WAVE/axe (não há `a11y.test.tsx` para `apps.comments`)              | 🟡 manual, sem CI gate                       |
| **CA14** | Comentários em artigo `draft` são invisíveis (GET retorna 404) e bloqueados para escrita (POST retorna 404)                               | `test_list_comments_404_for_draft_article` (`test_views.py:81`)                | ✅                                           |
| **CA15** | Soft-delete preserva `id` + `created_at` + `author` (audit trail íntegro mesmo após remoção)                                              | `test_delete_own_comment_preserves_metadata` (derivado de `test_views.py:207`) | ✅                                           |

---

## User Stories

### US20.1 — Leitor autenticado comenta artigo

> **Como** leitor autenticado e não banido
> **Quero** comentar um artigo publicado
> **Para** registrar minha leitura, discordar, complementar ou corrigir publicamente.

- **Prioridade**: 🟠 Alta
- **Estimativa**: 5 Story Points
- **Sprint**: 2-3 (retroativo)
- **Status**: ✅ Done
- **CAs cobertos**: CA01, CA04, CA12, CA13, CA14
- **Persona**: [leitor autenticado](../../requirements/personas-e-cenarios.md)

#### Cenários BDD (Gherkin pt-BR)

```gherkin
Funcionalidade: Comentário em artigo publicado
  Como leitor autenticado e não banido
  Quero comentar abaixo do artigo
  Para participar da conversa pública editorial

Cenário: Leitor autenticado comenta com sucesso (caminho feliz)
  Dado que estou autenticado como leitor não banido
  E estou na página de um artigo publicado
  Quando escrevo "Discordo da leitura sobre a Beyoncé na seção 3" no campo de comentário
  E confirmo o envio
  Então vejo o comentário aparecer no topo da lista de comentários
  E o autor exibido é meu nome público
  E a data exibida é "agora"
  E o backend retornou 201 com o JSON do comentário criado

Cenário: Leitor anônimo é bloqueado ao tentar comentar
  Dado que NÃO estou autenticado
  E estou na página de um artigo publicado
  Quando tento enviar um comentário
  Então o backend retorna 401
  E vejo um convite para fazer login ou criar conta

Cenário: Leitor banido é bloqueado por defesa em profundidade
  Dado que estou autenticado mas meu usuário está banido
  Quando tento enviar um comentário
  Então o backend retorna 403 (IsNotBanned negou)
  E vejo a mensagem "Sua conta está bloqueada para esta ação"

Cenário: Comentário em artigo draft é invisível e bloqueado
  Dado que existe um artigo com status "draft"
  Quando tento ler ou comentar nesse artigo
  Então o backend retorna 404 (artigo não existe publicamente)
  E nenhum comentário daquele artigo é exposto na API

Cenário: Conteúdo acima de 2000 caracteres é rejeitado
  Dado que estou autenticado como leitor não banido
  Quando tento enviar comentário com 2001 caracteres
  Então o backend retorna 400 ("Conteúdo excede limite de 2000 caracteres")
  E meu comentário não foi salvo
```

---

### US20.2 — Leitor responde a comentário existente

> **Como** leitor autenticado e não banido
> **Quero** responder a um comentário existente
> **Para** continuar uma conversa específica dentro da discussão do artigo.

- **Prioridade**: 🟠 Alta
- **Estimativa**: 3 Story Points
- **Sprint**: 2-3 (retroativo)
- **Status**: ✅ Done
- **CAs cobertos**: CA02, CA03, CA08
- **Persona**: leitor autenticado

#### Cenários BDD

```gherkin
Funcionalidade: Resposta a comentário existente (1 nível)
  Como leitor autenticado
  Quero responder a um comentário específico
  Para continuar uma conversa pontual

Cenário: Resposta válida ao comentário top-level do mesmo artigo
  Dado que estou autenticado como leitor não banido
  E existe um comentário top-level no artigo "artigo-A"
  Quando envio POST com content="boa colocação" e parent_id=ID do comentário
  Então o backend retorna 201
  E o comentário criado tem parent_id preenchido
  E o comentário aparece como reply do parent, não como top-level

Cenário: Resposta a comentário de OUTRO artigo é rejeitada
  Dado que existe comentário-X no artigo "artigo-A"
  E estou comentando no artigo "artigo-B"
  Quando envio POST com parent_id=ID do comentário-X
  Então o backend retorna 400 ("Comentário pai inválido ou não encontrado")
  E nada é persistido

Cenário: Resposta a um reply (nível 2) é rejeitada — aninhamento máximo é 1
  Dado que existe comentário-A top-level
  E existe reply-B respondendo a comentário-A
  Quando tento enviar reply-C com parent_id=ID do reply-B
  Então o backend retorna 400 ("Comentário pai inválido ou não encontrado")
  E nenhuma árvore com profundidade 2 é criada

Cenário: Resposta a comentário soft-deletado é rejeitada
  Dado que existe comentário-X com is_deleted=true
  Quando tento enviar reply com parent_id=ID do comentário-X
  Então o backend retorna 400 ("Comentário pai inválido ou não encontrado")
  E meu reply não é persistido

Cenário: Reply existente cujo parent é soft-deletado fica órfão (comportamento atual)
  Dado que existe reply-B respondendo a comentário-A
  E o comentário-A foi soft-deletado depois
  Quando o leitor abre a thread do artigo
  Então comentário-A NÃO aparece (filter is_deleted=False)
  E reply-B NÃO aparece como top-level (parent!=None no filtro)
  E reply-B continua no DB
  # Débito OPS-1: UX final pendente — esconder tudo ou mostrar tombstone do parent?
```

---

### US20.3 — Leitor curte e descurte comentário

> **Como** leitor autenticado e não banido
> **Quero** curtir/descurtir um comentário com um clique
> **Para** sinalizar concordância sem precisar escrever.

- **Prioridade**: 🟠 Alta
- **Estimativa**: 3 Story Points
- **Sprint**: 2-3 (retroativo)
- **Status**: ✅ Done
- **CAs cobertos**: CA09, CA10, CA11
- **Persona**: leitor autenticado

#### Cenários BDD

```gherkin
Funcionalidade: Toggle de curtida em comentário
  Como leitor autenticado
  Quero curtir ou descurtir um comentário
  Para sinalizar concordância de forma simples

Cenário: Primeira curtida (caminho feliz)
  Dado que estou autenticado como leitor não banido
  E existe comentário-X visível
  E NÃO há CommentLike(comment=X, user=eu)
  Quando envio POST /api/v1/comments/X/like/
  Então o backend retorna 200 com {liked: true, likes_count: N+1}
  E foi criada uma CommentLike(comment=X, user=eu)

Cenário: Segunda curtida descurte (toggle idempotente)
  Dado que existe CommentLike(comment=X, user=eu)
  Quando envio POST /api/v1/comments/X/like/ novamente
  Então o backend retorna 200 com {liked: false, likes_count: N-1}
  E a CommentLike anterior foi removida

Cenário: Duplo-clique não cria duas curtidas (race condition)
  Dado que estou autenticado
  Quando disparo dois POSTs paralelos para /api/v1/comments/X/like/
  Então exatamente uma CommentLike(comment=X, user=eu) existe ao final
  E o backend não retorna 500 (unique_together protege via get_or_create)

Cenário: Leitor banido é bloqueado ao tentar curtir
  Dado que estou autenticado mas banido
  Quando envio POST /api/v1/comments/X/like/
  Então o backend retorna 403 (IsNotBanned negou)
  E nenhuma CommentLike é criada

Cenário: Like em comentário soft-deletado retorna 404
  Dado que comentário-X tem is_deleted=true
  Quando envio POST /api/v1/comments/X/like/
  Então o backend retorna 404
  E nenhuma CommentLike é criada
```

---

## Tasks (implementação)

### Tasks US-bound (T20.X.Y — todas ✅ Done Sprint 2-3, pre-busca)

| ID      | Descrição                                                                                                                                           | Prioridade | Status                          |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------- |
| T20.1.1 | Bootstrap Django app `apps.comments` (`AppConfig`, registro em `INSTALLED_APPS`)                                                                    | 🟠         | ✅ Done (Sprint 2-3, pre-busca) |
| T20.1.2 | Model `Comment` com UUID PK, FKs `article`/`author`/`parent` self-FK, `content` 2000 chars                                                          | 🟠         | ✅ Done (Sprint 2-3, pre-busca) |
| T20.1.3 | Campos de soft-delete em `Comment`: `is_deleted` (default False, `db_index=True`), `deleted_at`, `deleted_by` FK `SET_NULL`                         | 🟠         | ✅ Done (Sprint 2-3, pre-busca) |
| T20.1.4 | Meta indexes em `Comment`: `(article, parent, -created_at)` e `(author, -created_at)`                                                               | 🟡         | ✅ Done (Sprint 2-3, pre-busca) |
| T20.1.5 | `CommentSerializer` (read + write) com annotations `likes_count`, `is_liked`, `replies_count`, nested `replies` (1 nível)                           | 🟠         | ✅ Done (Sprint 2-3, pre-busca) |
| T20.1.6 | `ReplySerializer` (leaf — sem `replies`/`replies_count`) — corta árvore em profundidade 1                                                           | 🟠         | ✅ Done (Sprint 2-3, pre-busca) |
| T20.1.7 | `validate_parent_id` na `CommentSerializer` — exige mesmo artigo + `is_deleted=False` + `parent=None` (invariante I8)                               | 🔴         | ✅ Done (Sprint 2-3, pre-busca) |
| T20.1.8 | `CommentListCreateView` (GET `AllowAny`, POST `IsAuthenticated+IsNotBanned`) + lookup por `<uslug:>` filtrado `status='published'`                  | 🟠         | ✅ Done (Sprint 2-3, pre-busca) |
| T20.1.9 | `CommentDestroyView` com `IsAuthenticated+IsOwnerOrAdmin` + `perform_destroy` sobrescrito (soft-delete via `update_fields`)                         | 🔴         | ✅ Done (Sprint 2-3, pre-busca) |
| T20.2.1 | Model `CommentLike` com UUID PK, FKs `comment`/`user`, `unique_together('comment','user')` para idempotência                                        | 🟠         | ✅ Done (Sprint 2-3, pre-busca) |
| T20.2.2 | `CommentLikeToggleView` com `get_or_create` + `like.delete()` para toggle; resposta `{liked, likes_count}`                                          | 🟠         | ✅ Done (Sprint 2-3, pre-busca) |
| T20.2.3 | Annotation `is_liked` via `Exists(CommentLike.objects.filter(user=request.user, comment=OuterRef))`                                                 | 🟡         | ✅ Done (Sprint 2-3, pre-busca) |
| T20.3.1 | Permissão `IsNotBanned` aplicada em POST de comentário, DELETE e POST de like (defesa em profundidade S8)                                           | 🔴         | ✅ Done (Sprint 2-3, pre-busca) |
| T20.3.2 | Permissão `IsOwnerOrAdmin` (object-level) — owner OU admin removem; editor não remove de terceiros                                                  | 🔴         | ✅ Done (Sprint 2-3, pre-busca) |
| T20.4.1 | URLs em `apps.comments.urls`: GET/POST `/api/v1/articles/<slug>/comments/`, DELETE `/api/v1/comments/<uuid>/`, POST `/api/v1/comments/<uuid>/like/` | 🟠         | ✅ Done (Sprint 2-3, pre-busca) |
| T20.4.2 | Conversor de path `<uslug:>` registrado em `ArticlesConfig.ready()` — desacopla `comments` de `articles` no roteamento                              | 🟡         | ✅ Done (Sprint 2-3, pre-busca) |
| T20.5.1 | Admin Django `apps.comments.admin` — busca por email do autor + content, filtro `is_deleted`, `deleted_at` read-only                                | 🟡         | ✅ Done (Sprint 2-3, pre-busca) |
| T20.6.1 | Tests `tests/test_views.py` — 24 cenários de integração (DB real via `pytest-django`)                                                               | 🟠         | ✅ Done (Sprint 2-3, pre-busca) |
| T20.6.2 | Migration `0003_commentlike_and_more` — adiciona `parent` self-FK, índice composto, `CommentLike` com unique + (índice redundante D-04)             | 🟡         | ✅ Done (Sprint 2-3, pre-busca) |

### Tasks transversais (TX-NN — débitos de housekeeping pendentes)

| ID     | Descrição                                                                                                                                 | Prioridade | Status                                    |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------- |
| TX-C01 | **HOTFIX** `ScopedRateThrottle` específico `comments_create` (S-07) — 15 LoC, pattern já vivo em `apps.users:32`                          | 🔴         | ⏳ Sprint de moderação (candidate hotfix) |
| TX-C02 | Sanitização HTML server-side de `content` via `bleach` ou `nh3` (S-01) — fecha XSS persistente em regressão de FE                         | 🟠         | ⏳ Sprint de moderação                    |
| TX-C03 | Migration `RemoveIndex` para corrigir D-04 (índice redundante em `CommentLike`)                                                           | 🟡         | ⏳ Sprint de housekeeping                 |
| TX-C04 | Decisão de UX + implementação para replies órfãs em parent soft-deletado (OPS-1)                                                          | 🟡         | ⏳ Decisão de produto                     |
| TX-C05 | ADR + cron de retenção para comentários soft-deletados (OPS-2; LGPD)                                                                      | 🟡         | ⏳ Sprint de moderação                    |
| TX-C06 | Teste direto para invariante I8 (nesting ≤ 1) — fecha GAP-1                                                                               | 🟢         | ⏳ Sprint de housekeeping                 |
| TX-C07 | Decisão sobre `updated_at`: remover campo OU criar endpoint PATCH com janela de tempo (GAP-2)                                             | 🟢         | ⏳ Decisão pendente                       |
| TX-C08 | Suite a11y automatizada para `<CommentForm>`, `<CommentItem>`, `<LikeButton>` (axe-core no FE)                                            | 🟡         | ⏳ Sprint de housekeeping                 |
| TX-C09 | Formalizar 5 decisões implícitas em ADRs em `docs/specs/comments/adrs/` (soft-delete, 1 nível, sem signals, IsNotBanned, unique_together) | 🟡         | ⏳ Sprint de housekeeping                 |

---

## Open Questions (decisões pendentes — pré-Sprint de moderação)

1. **OPS-1 — Replies órfãs em parent soft-deletado**: hoje parent some da API (`filter(is_deleted=False, parent=None)`), e reply também some (não aparece como top-level porque `parent!=None`). Reply continua no DB. Decisão pendente: **(a)** esconder a thread inteira (estado atual de fato), **(b)** exibir tombstone do parent (`"comentário removido"`) com os replies aninhados abaixo, ou **(c)** promover replies a top-level quando parent é removido. Sem documentação de UX vigente — pergunta de produto.

2. **D-04 — Índice redundante em `CommentLike`**: `unique_together('comment','user')` + `Index(fields=['comment','user'])` na mesma combinação. Postgres já cria índice automático pela unique constraint. Migration `RemoveIndex` resolve sem alterar comportamento — agendar em Sprint de housekeeping (referência: `migrations/0003_commentlike_and_more.py:51-58`).

3. **S-07 — Sem `ScopedRateThrottle` para `comments_create`**: pattern já existe e roda em `apps/users/views.py:32`. Default `user=1000/h` permite flood massivo em artigo viral (1 leitor pode esgotar capacidade de moderação reativa). **Hotfix óbvio** — provavelmente 15 LoC. Risco aumenta com qualquer evento de viralização orgânica. **Prioridade real: 🔴 Imediato** — deveria sair na próxima janela aberta, não esperar Sprint formal.

4. **F-21 — Notificação por resposta**: leitor que recebeu reply deveria ser notificado? Canal (e-mail vs in-app), opt-out, agregação (1 e-mail/hora vs 1 por reply). Decisão de produto bloqueia design técnico.

5. **Threading multi-nível** (relaxar invariante I8): hoje invariante hard-coded em `validate_parent_id`. Avaliar **somente** se feedback de leitor pedir conversas mais aninhadas — trade-off de legibilidade vs profundidade. Default: manter 1 nível.

6. **GAP-2 — `updated_at` órfão**: campo no schema atualiza em qualquer `save()`, mas não há endpoint de edição. Ou se cria `PATCH /api/v1/comments/<uuid>/` com janela curta (ex.: 5min após criação), ou se remove o campo (clareza arquitetural). Sem decisão.

---

## Definition of Done — verificação (retroativa)

- [x] CA01, CA02, CA04, CA05, CA06, CA07, CA09, CA10, CA11, CA14, CA15 verificados por test automatizado (24 testes em `apps/comments/tests/test_views.py`)
- [ ] **CA12 NÃO atendido** — débito S-07 (throttle `comments_create` ausente)
- [x] CA03 atendido por código (`validate_parent_id`) mas sem teste direto da invariante (GAP-1)
- [ ] CA08 sem decisão de UX (OPS-1)
- [ ] CA13 verificado manualmente; sem CI gate a11y para `apps.comments`
- [x] US20.1, US20.2, US20.3 com cenários BDD descrevendo o comportamento implementado
- [x] Todas as Tasks US-bound (T20.X.Y) ✅ Done em código
- [ ] Tasks transversais (TX-C01..TX-C09) ⏳ pendentes (Sprint de moderação)
- [x] Mergeada em main pré-Sprint 4 (sem PR de referência registrado — pré-formalização do processo)
- [x] Documentação retroativa criada em 2026-06-09: [RF-002](../../requirements/RF/RF-002-comments.md), [EP-03](../epics/EP-03-engajamento-comunidade.md), [DESIGN.md](../../specs/comments/DESIGN.md), F-20 (este arquivo)

**Status final**: ✅ **Done em código (Sprint 2-3, pre-busca)**, com **1 CA aberto (CA12) de prioridade real 🔴 Imediato** e 6 débitos rastreados (S-01, S-07, D-04, OPS-1, OPS-2, GAP-1, GAP-2) prontos para Sprint dedicada de moderação.

---

## Specs técnicas relacionadas

- [DESIGN.md](../../specs/comments/DESIGN.md) — modelo de dados, contrato público, fluxos críticos (4 sequence diagrams), 8 invariantes, débitos com referências a `models.py:LL` e `views.py:LL`
- _ADRs de `comments` (pendentes formalização — débito TX-C09)_

---

## Cross-references resumidas

| Direção                    | Onde                                                                                                                                                                                                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ↑ Requisitos atendidos     | [RF-002](../../requirements/RF/RF-002-comments.md), [RNF-security](../../requirements/RNF/RNF-security.md), [RNF-a11y](../../requirements/RNF/RNF-a11y.md), [RNF-lgpd](../../requirements/RNF/RNF-lgpd.md), [RNF-availability](../../requirements/RNF/RNF-availability.md) |
| ↑ Epic pai                 | [EP-03 Engajamento da comunidade](../epics/EP-03-engajamento-comunidade.md)                                                                                                                                                                                                |
| → Sprint(s)                | Sprint 2-3 (retroativo, sem arquivo); Sprint de moderação (futuro) para TX-C01..TX-C09                                                                                                                                                                                     |
| → Specs técnicas           | [DESIGN.md](../../specs/comments/DESIGN.md)                                                                                                                                                                                                                                |
| → Features irmãs sob EP-03 | F-21 Notificações por resposta (backlog), F-22 Anti-spam reativo (backlog)                                                                                                                                                                                                 |
| ← Improvement-system       | [§11.6 S8 — IsNotBanned defense-in-depth](../../planning/Improvement-system.md)                                                                                                                                                                                            |

---

_F-20 ✅ Done em código desde Sprint 2-3 (pré-formalização). Documentação retroativa criada em 2026-06-09 como parte de `chore/docs-reorg`. Próxima ação operacional: priorizar TX-C01 (hotfix S-07 throttle) na próxima janela aberta — risco de flood em viralização orgânica não justifica esperar Sprint formal._
