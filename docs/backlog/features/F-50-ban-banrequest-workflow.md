# F-50 — Ban + BanRequest workflow

> **Tipo**: Feature
> **Epic pai**: [EP-05 Moderação da comunidade](../epics/EP-05-moderacao-comunidade.md)
> **Sprint de execução**: Sprint 2-3 (mai/2026, pre-busca)
> **Status**: ✅ Done (retroativo — Sprint 2-3) · 📝 Documentação retroativa Sprint 5 (2026-06-09)
> **Prioridade**: 🔴 Imediato (fundação da seção de comentários abertos)

---

## Descrição (visão de produto)

Admin entra no painel de moderação, identifica leitor que violou termos de comunidade (spam, discurso de ódio, ataque pessoal a redator) e bana direto com uma justificativa formal — efeito imediato na próxima requisição do banido. Em paralelo, editor que viu padrão sutil de ataque (que pede 2º par de olhos) abre **solicitação de banimento** com motivo e cópia da mensagem ofensiva — a solicitação fica em fila e admin decide aprovar (cria ban real) ou rejeitar (encerra sem efeito). Hierarquia inegociável `dev > admin > editor > user` é sustentada em 3 camadas independentes: queryset filtrado por ator, validação no serializer, barreira final na camada de serviço.

Esta Feature é a **fundação** do EP-05 (Moderação da Comunidade) — Features futuras (F-51 notificação email, F-52 fluxo de contestação, F-53 auto-expiração) constroem em cima dela.

---

## Requisitos atendidos (rastreabilidade ↑)

| ID                                                             | Requisito                                                            | Relação                     |
| -------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------- |
| [RF-003](../../requirements/RF/RF-003-moderation.md)           | Ban direto + BanRequest com invariantes de hierarquia                | Realiza diretamente         |
| [RNF-security](../../requirements/RNF/RNF-security.md)         | Defesa em 3 camadas; permissões DRF; trilha de auditoria             | Realiza CA04-CA07/CA09      |
| [RNF-availability](../../requirements/RNF/RNF-availability.md) | Falha do worker celery (email) não bloqueia abertura de `BanRequest` | Realiza degradação graciosa |
| [RNF-lgpd](../../requirements/RNF/RNF-lgpd.md)                 | Razão do ban (dado pessoal sensível) com retenção 5 anos             | Trilha em audit log         |

---

## Critérios de Aceitação (CAs)

| ID       | Critério                                                                                                                                                                                                                                        | Como verificar                                                     | Status   |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------- |
| **CA01** | Admin aplica Ban direto via `POST /api/v1/moderation/bans/` com `target_user_id` + `reason` — sistema cria row em `bans`, atualiza `User.is_banned=True` e grava `AuditLog`                                                                     | `test_services.py::test_ban_user_creates_ban_and_flips_flag`       | ✅       |
| **CA02** | Editor abre BanRequest via `POST /api/v1/moderation/ban-requests/` com `target` + `reason` — sistema cria row com `status=pending`, dispara task celery que notifica admins por email                                                           | `test_services.py` + `test_tasks.py::test_notify_admins`           | ✅       |
| **CA03** | Admin decide BanRequest via `POST /api/v1/moderation/ban-requests/<id>/decide/` com `action='approve'` cria Ban e `action='reject'` fecha o BanRequest com `status=rejected`                                                                    | `test_services.py::test_approve_ban_request` + `test_reject`       | ✅       |
| **CA04** | **Invariante I1**: dev NUNCA pode ser banido — bloqueio em **3 camadas** (queryset exclui dev; `validate_user_id` rejeita; `services.ban_user` lança `PermissionDenied`)                                                                        | `test_ban_hierarchy.py::test_dev_immune_three_layers`              | ✅       |
| **CA05** | **Invariante I2**: admin pode banir editor/user, mas NÃO outro admin — bloqueio em 3 camadas idêntico                                                                                                                                           | `test_ban_hierarchy.py::test_admin_cannot_ban_admin`               | ✅       |
| **CA06** | **Invariante I3**: editor pode abrir BanRequest contra user — NÃO contra admin nem dev — queryset `role__in=['user','editor']` filtra; `validate_target_id` reforça                                                                             | `test_serializers.py::test_editor_target_filtered`                 | ✅       |
| **CA07** | **Invariante I4**: auto-target em BanRequest (`requested_by == target_user`) retorna **400 Bad Request** com `{"target_id": "Não é permitido abrir solicitação contra si mesmo"}`                                                               | `test_serializers.py::test_self_target_400` (gap GAP-1 — Sprint 6) | 🟡 gap   |
| **CA08** | BanRequest pending dura **indefinidamente** até admin decidir — sem TTL automático. Débito documentado como GAP-2 do DESIGN — auto-rejeição por cron é F-53 futuro                                                                              | DESIGN.md §7 GAP-2                                                 | ⚠️ doc'd |
| **CA09** | AuditLog é **INSERT-only** (sem update, sem delete): `actor` + `action ∈ {'ban', 'ban_request_open', 'ban_request_decide'}` + `target` + `ip` + `user_agent` + `created_at`                                                                     | `test_audit_middleware.py` em `apps.audit`                         | ✅       |
| **CA10** | **(DESIGN OPS-1)** `Ban.user` é `OneToOneField` — re-banir o mesmo user via `update_or_create` **sobrescreve** `banned_by`, `reason` e `trigger_message` originais (perde histórico do ciclo anterior). Trade-off doc'd em `services.py:22-31`. | DESIGN.md §2.2 + comentário no código                              | ⚠️ doc'd |
| **CA11** | **(DESIGN OPS-2)** Sistema NÃO invalida JWT do banido ao aplicar ban — banido mantém sessões ativas com permissão de **leitura** até o token de acesso expirar (~30min). Escrita (POST/DELETE) é bloqueada imediatamente por `IsNotBanned`.     | DESIGN.md §7 OPS-3                                                 | ⚠️ doc'd |
| **CA12** | **(DESIGN OPS-3)** Sistema NÃO envia email ao banido (nem ao aprovar BanRequest nem ao aplicar ban direto). Banido descobre tentando comentar. Resolução: F-51 (Sprint 8).                                                                      | DESIGN.md §7 OPS-2                                                 | ⚠️ doc'd |

> **Hotfix candidato (mais sério dos três)**: CA11 (OPS-3 — sem JWT invalidation imediato). Em janela de até 30min, ban "aplicado" não tem efeito real para leitura autenticada. Atacante bana hoje continua navegando até o token vencer. Tratativa requer ADR sobre estratégia (blocklist Redis vs. TTL curto). Mais sério que CA10 (perda de histórico — incomoda audit, não compromete segurança) e CA12 (UX — incomoda banido, não compromete sistema).

---

## User Stories

### US50.1 — Admin aplica ban direto contra leitor com violação clara

> **Como** admin do Interpop
> **Quero** banir diretamente um leitor que cometeu violação clara dos termos
> **Para** proteger a seção de comentários sem latência de fluxo formal.

- **Prioridade**: 🔴 Imediato
- **Estimativa**: 5 Story Points
- **Sprint**: 2
- **Status**: ✅ Done (Sprint 2-3, pre-busca)
- **CAs cobertos**: CA01, CA04, CA05, CA09, CA10, CA11
- **Persona**: [admin](../../requirements/personas-e-cenarios.md)

#### Cenários BDD (Gherkin pt-BR)

```gherkin
Funcionalidade: Banimento direto aplicado por admin
  Como admin do Interpop
  Quero banir leitor com violação clara
  Para proteger a comunidade sem latência

Cenário: Ban direto aplicado com sucesso contra leitor (caminho feliz)
  Dado que sou admin autenticado
  E que existe leitor "alvo@x.com" com role="user" e is_banned=False
  Quando faço POST em "/api/v1/moderation/bans/" com user_id do alvo e reason="spam reincidente"
  Então recebo HTTP 201 com o objeto Ban serializado
  E a row em "bans" existe com is_active=True e banned_by=meu_id
  E o campo is_banned do User alvo agora é True
  E a trilha de auditoria registra action="ban" + actor + target + ip + user_agent
  E o response retorna em ≤ 300ms p95

Cenário: Admin tenta banir outro admin → 403
  Dado que sou admin autenticado (não dev)
  E que existe outro admin "outro-admin@x.com" com role="admin"
  Quando faço POST em "/api/v1/moderation/bans/" com user_id do outro admin
  Então recebo HTTP 400 (queryset filtrado — camada 1 da defesa)
  E o body contém {"user_id": "Selecione uma opção válida"}
  E nenhuma row foi criada em "bans"
  E o is_banned do outro admin permanece False

Cenário: Tentativa de banir dev → 403 (invariante I1)
  Dado que sou admin autenticado
  E que existe dev "gabriel@interpop.com" com role="dev"
  Quando faço POST em "/api/v1/moderation/bans/" com user_id do dev
  Então recebo HTTP 400 (queryset não inclui dev — camada 1)
  E mesmo se a camada 1 falhasse, validate_user_id rejeitaria (camada 2)
  E mesmo se a camada 2 falhasse, services.ban_user lançaria PermissionDenied (camada 3)
  E o is_banned do dev permanece False sob qualquer cenário de bug

Cenário: Re-banir mesmo user (OPS-1 — perde histórico)
  Dado que existe Ban inativo de "alvo@x.com" criado por admin_A com reason="ofensa 1"
  E que sou admin_B autenticado
  Quando faço POST em "/api/v1/moderation/bans/" com user_id de "alvo@x.com" e reason="ofensa 2"
  Então o sistema usa update_or_create no Ban OneToOne
  E a row em "bans" agora tem banned_by=admin_B e reason="ofensa 2"
  E o histórico de admin_A com reason="ofensa 1" é PERDIDO (trade-off OPS-1 doc'd)
  E a trilha de auditoria preserva ambos os ciclos (audit_log é insert-only)
```

---

### US50.2 — Editor solicita banimento com justificativa formal

> **Como** editor do Interpop
> **Quero** abrir solicitação formal de banimento contra leitor
> **Para** registrar o caso com motivo e mensagem ofensiva, e que admin decida com 2º par de olhos.

- **Prioridade**: 🔴 Imediato
- **Estimativa**: 5 Story Points
- **Sprint**: 2
- **Status**: ✅ Done (Sprint 2-3, pre-busca)
- **CAs cobertos**: CA02, CA06, CA07, CA09
- **Persona**: [editor](../../requirements/personas-e-cenarios.md)

#### Cenários BDD (Gherkin pt-BR)

```gherkin
Funcionalidade: Solicitação de banimento aberta por editor
  Como editor do Interpop
  Quero registrar solicitação formal com justificativa
  Para que admin decida com contexto e trilha de auditoria

Cenário: Editor abre BanRequest contra leitor (caminho feliz)
  Dado que sou editor autenticado
  E que existe leitor "alvo@x.com" com role="user"
  Quando faço POST em "/api/v1/moderation/ban-requests/" com target_id, reason e trigger_message
  Então recebo HTTP 201 com o BanRequest serializado
  E a row em "ban_requests" existe com status="pending" e requested_by=meu_id
  E o sinal post_save dispara a task celery notify_admins_on_new_ban_request
  E ao menos 1 admin recebe email "[Interpop] Nova solicitação de banimento" em ≤ 5min

Cenário: Editor tenta banir dev → 400 (invariante I3)
  Dado que sou editor autenticado
  E que existe dev "gabriel@interpop.com" com role="dev"
  Quando faço POST em "/api/v1/moderation/ban-requests/" com target_id do dev
  Então recebo HTTP 400 (queryset role__in=["user","editor"] não inclui dev)
  E o body contém {"target_id": "Selecione uma opção válida"}
  E nenhuma row foi criada em "ban_requests"

Cenário: Editor tenta banir admin → 400 (invariante I3)
  Dado que sou editor autenticado
  E que existe admin "admin@interpop.com" com role="admin"
  Quando faço POST em "/api/v1/moderation/ban-requests/" com target_id do admin
  Então recebo HTTP 400 (queryset filtra admin fora)
  E o body contém {"target_id": "Selecione uma opção válida"}

Cenário: Editor tenta auto-target (requested_by == target) → 400 (CA07, GAP-1)
  Dado que sou editor autenticado
  Quando faço POST em "/api/v1/moderation/ban-requests/" com target_id=meu_próprio_id
  Então recebo HTTP 400
  E o body contém {"target_id": "Não é permitido abrir solicitação contra si mesmo"}
  E nenhuma row foi criada em "ban_requests"

Cenário: Worker celery down — falha no envio de email não bloqueia abertura
  Dado que sou editor autenticado
  E que o broker Redis está indisponível (celery enqueue falha)
  Quando faço POST em "/api/v1/moderation/ban-requests/" com payload válido
  Então a row em "ban_requests" é criada com sucesso (HTTP 201)
  E o signal captura a exceção do enqueue e loga warning
  E o admin pode visualizar a solicitação via "/admin/moderation/banrequest/" mesmo sem email
```

---

### US50.3 — Admin revisa fila e decide solicitação de banimento

> **Como** admin do Interpop
> **Quero** revisar fila de BanRequests pendentes e decidir aprovar ou rejeitar
> **Para** aplicar banimento com contexto editorial ou encerrar caso infundado.

- **Prioridade**: 🔴 Imediato
- **Estimativa**: 8 Story Points
- **Sprint**: 3
- **Status**: ✅ Done (Sprint 2-3, pre-busca)
- **CAs cobertos**: CA03, CA04, CA05, CA08, CA09
- **Persona**: [admin](../../requirements/personas-e-cenarios.md)

#### Cenários BDD (Gherkin pt-BR)

```gherkin
Funcionalidade: Decisão de solicitação de banimento por admin
  Como admin do Interpop
  Quero aprovar ou rejeitar BanRequest com trilha de auditoria
  Para que decisões editoriais fiquem registradas e a hierarquia seja respeitada

Cenário: Admin aprova BanRequest → Ban criado + AuditLog gravado (CA03)
  Dado que sou admin autenticado
  E que existe BanRequest com status="pending" contra "alvo@x.com"
  Quando faço POST em "/api/v1/moderation/ban-requests/<id>/decide/" com action="approve" e decision_note
  Então recebo HTTP 200 com o BanRequest atualizado
  E o BanRequest agora tem status="approved", decided_by=meu_id, decided_at preenchido
  E uma row em "bans" foi criada via services.approve_ban_request → ban_user
  E o User alvo agora tem is_banned=True
  E a trilha de auditoria registra action="ban_request_decide" + decision="approve"
  E a transação é atômica (BanRequest + Ban + User.is_banned coerentes ou tudo rollback)

Cenário: Admin rejeita BanRequest → nenhum Ban criado
  Dado que sou admin autenticado
  E que existe BanRequest com status="pending"
  Quando faço POST em "/api/v1/moderation/ban-requests/<id>/decide/" com action="reject" e decision_note
  Então recebo HTTP 200
  E o BanRequest agora tem status="rejected", decided_by=meu_id, decided_at preenchido
  E NENHUMA row foi criada em "bans"
  E o User alvo permanece com is_banned=False
  E a trilha de auditoria registra action="ban_request_decide" + decision="reject"

Cenário: Decisão é idempotente — re-aprovar não duplica Ban (invariante I6)
  Dado que existe BanRequest já approved (status="approved", Ban ativo existe)
  E que sou admin autenticado
  Quando chamo services.approve_ban_request novamente
  Então o sistema faz early-return retornando o Ban ativo existente
  E NENHUMA nova row em "bans" é criada
  E o status do BanRequest permanece "approved" sem alteração

Cenário: BanRequest em estado terminal não regrede (invariante I7)
  Dado que existe BanRequest com status="rejected"
  E que sou admin autenticado
  Quando faço POST em "/decide/" com action="approve"
  Então recebo HTTP 400 ou 409 (BanRequestDecideView exige status=="pending")
  E o status permanece "rejected"

Cenário: Editor vê só seus próprios BanRequests; admin vê todos (invariante I8)
  Dado que existem BanRequests criados por editor_A e por editor_B
  Quando editor_A faz GET em "/api/v1/moderation/ban-requests/"
  Então recebe somente as solicitações que ele próprio criou
  Quando admin faz o mesmo GET
  Então recebe TODAS as solicitações (editor_A, editor_B, históricos)
```

---

## Tasks (implementação)

### Tasks US-bound (T50.X.X — todas ✅ Done Sprint 2-3, pre-busca)

| ID      | Descrição                                                                                                                                                                 | Prioridade | Sprint | Status                          |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ------------------------------- |
| T50.1.1 | Bootstrap do Django app `apps.moderation` (estrutura `models.py`, `serializers.py`, `services.py`, `views.py`, `urls.py`, `signals.py`, `tasks.py`, `admin.py`, `tests/`) | 🔴         | 2      | ✅ Done (Sprint 2-3, pre-busca) |
| T50.1.2 | Modelo `Ban` com `OneToOneField(user)`, `banned_by`, `reason`, `trigger_message`, `is_active`, `unbanned_by`, `unbanned_at`, `expires_at` (nullable, sem job)             | 🔴         | 2      | ✅ Done (Sprint 2-3, pre-busca) |
| T50.1.3 | Modelo `BanRequest` com `target`, `requested_by`, `reason`, `trigger_message`, `status` (PENDING/APPROVED/REJECTED), `decided_by`, `decided_at`, `decision_note`          | 🔴         | 2      | ✅ Done (Sprint 2-3, pre-busca) |
| T50.1.4 | Migration `0001_initial` — schema base de `Ban` + `BanRequest` com índices (`status, -created_at`) e (`is_active, -created_at`)                                           | 🔴         | 2      | ✅ Done (Sprint 2-3, pre-busca) |
| T50.1.5 | Service layer — `ban_user()`, `unban_user()`, `approve_ban_request()`, `reject_ban_request()` (todos `@transaction.atomic` exceto reject)                                 | 🔴         | 2      | ✅ Done (Sprint 2-3, pre-busca) |
| T50.1.6 | Serializers — `BanSerializer` e `BanRequestSerializer` com queryset **ator-aware** (`user_id`/`target_id` filtrado por role do request.user)                              | 🔴         | 2      | ✅ Done (Sprint 2-3, pre-busca) |
| T50.2.1 | Views — `BanListCreateView`, `BanDestroyView`, `BanRequestListCreateView`, `BanRequestDecideView` (decide é `POST /decide/`, não PATCH)                                   | 🔴         | 2      | ✅ Done (Sprint 2-3, pre-busca) |
| T50.2.2 | URLs em `apps.moderation.urls` montadas em `/api/v1/moderation/bans/` e `/api/v1/moderation/ban-requests/` (ADR-010)                                                      | 🟠         | 2      | ✅ Done (Sprint 2-3, pre-busca) |
| T50.2.3 | Permissões reusáveis em `apps.users.permissions` (`IsAdminUser`, `IsEditorOrAdmin`, `IsNotBanned`) aplicadas em todas as views                                            | 🔴         | 2      | ✅ Done (Sprint 2-3, pre-busca) |
| T50.3.1 | Signal `post_save` em `BanRequest` (created=True AND status=PENDING) → enfileira `notify_admins_on_new_ban_request.delay(id)` com try/except                              | 🟠         | 3      | ✅ Done (Sprint 2-3, pre-busca) |
| T50.3.2 | Task celery `notify_admins_on_new_ban_request(ban_request_id)` com autoretry exponencial (max_retries=3, backoff até 5min); inclui role=DEV na lista de destinatários     | 🟠         | 3      | ✅ Done (Sprint 2-3, pre-busca) |
| T50.3.3 | AuditLog via middleware HTTP em `apps.audit` (sem import direto) — captura `ban`, `ban_request_open`, `ban_request_decide` por método + status code                       | 🟠         | 3      | ✅ Done (Sprint 2-3, pre-busca) |
| T50.4.1 | Admin Django — `Ban` writable (caminho de fuga emergência); `BanRequest` **fully read-only** (`has_add/change/delete_permission → False`) para forçar decisão via API     | 🟠         | 3      | ✅ Done (Sprint 2-3, pre-busca) |
| T50.5.1 | Testes — `test_ban_hierarchy.py` (invariantes I1/I2/I10 nas 3 camadas)                                                                                                    | 🔴         | 3      | ✅ Done (Sprint 2-3, pre-busca) |
| T50.5.2 | Testes — `test_serializers.py` (queryset ator-aware + validação)                                                                                                          | 🔴         | 3      | ✅ Done (Sprint 2-3, pre-busca) |
| T50.5.3 | Testes — `test_services.py` (idempotência I6 + atomicidade I5 + estado terminal I7)                                                                                       | 🔴         | 3      | ✅ Done (Sprint 2-3, pre-busca) |
| T50.5.4 | Testes — `test_tasks.py` (envio de email com retry + recarga por ID)                                                                                                      | 🟠         | 3      | ✅ Done (Sprint 2-3, pre-busca) |

### Tasks transversais (TX-NN)

| ID    | Descrição                                                                                  | Prioridade | Status                   |
| ----- | ------------------------------------------------------------------------------------------ | ---------- | ------------------------ |
| TX-50 | Documentar permissões reusáveis em `apps.users.permissions` (single source of truth — C14) | 🟠         | ✅ Done (CONVENTIONS.md) |
| TX-51 | DESIGN.md retroativo do módulo `moderation`                                                | 🟠         | ✅ Done 2026-06-09       |
| TX-52 | RF-003 retroativo (substitui stub)                                                         | 🟠         | ✅ Done 2026-06-09       |
| TX-53 | EP-05 retroativo (substitui stub)                                                          | 🟠         | ✅ Done 2026-06-09       |

---

## Definition of Done — verificação

- [x] CA01-CA06, CA09 verificados por testes automatizados (`apps/moderation/tests/`)
- [x] CA07 verificado parcialmente — bloqueio implícito via `is_immune_to_ban` quando target é admin/dev; check explícito `target != requested_by` (GAP-1) **pendente** para Sprint 6 (2 LOC + 1 teste)
- [x] CA08, CA10, CA11, CA12 documentados como trade-offs em DESIGN §7 (OPS-1, OPS-2, OPS-3) + Open Questions §9
- [x] US50.1, US50.2, US50.3 com cenários BDD escritos (este arquivo)
- [x] Todas as Tasks 🔴 Imediate Done (Sprint 2-3, pre-busca)
- [x] Code-review aprovado (Sprint 2-3)
- [x] Cobertura backend ≥ 85% local em `apps.moderation/tests/`
- [x] Documentação cruzada atualizada — RF-003 cita F-50, EP-05 lista, DESIGN.md cross-ref completo
- [x] Mergeada em `main` via PRs Sprint 2-3 (pre-busca)

**Status final**: ✅ **Done** com CA07 marcado como gap menor (GAP-1) e CA08/CA10/CA11/CA12 documentados como trade-offs aceitos com Open Questions futuras.

---

## Open Questions (cross-ref DESIGN §9)

1. **F-51 — Notificação por email do banido** (OPS-2): banido descobre tentando comentar. LGPD pede transparência sobre processamento. Backlog Sprint 8.
2. **F-52 — Fluxo de contestação do banido (appeal)** (GAP-5): endpoint `POST /api/v1/moderation/bans/<id>/appeal/` com `appeal_message` e status `APPEALED`. Aceitável até volume justificar.
3. **F-53 — Auto-expiração de banimento temporário** (OPS-1): cron + service que respeita `Ban.expires_at`. Depende de ADR sobre política (TTL default? per-ban TTL?). Sem decisão.
4. **Migration futura — `Ban.user` de OneToOne para FK + UniqueConstraint(condition=Q(is_active=True))** (GAP-4 → CA10): preserva histórico individual de cada ciclo `ban → unban → re-ban`. Migrar quando houver dor real de auditoria.
5. **JWT invalidation imediato em ban** (OPS-3 → CA11 — **hotfix candidato**): `services.ban_user` deve revogar sessões ativas? Opções: (a) blocklist JWT em Redis (custo: Redis no caminho de cada request autenticado), (b) reduzir TTL do JWT para 5min com refresh agressivo, (c) aceitar leitura banida até token expirar (status quo). Decisão arquitetural — virar ADR antes de implementar.
6. **Auto-rejeição de BanRequest pendente há > 7 dias** (GAP-2): cron diário que vira `status="rejected"` com `decision_note="expirada"`. Define SLA primeiro.
7. **Rate-limit em `BanRequest` create** (GAP-3): editor mal-intencionado pode floodar admins de email. Aplicar `ScopedRateThrottle('moderation_request')`.

---

## Specs técnicas relacionadas

- [DESIGN.md retroativo de `moderation`](../../specs/moderation/DESIGN.md) — fonte de verdade (defesa 3 camadas, 10 invariantes, 9 débitos)
- [Improvement-system.md §11.6 S8 + C13](../../planning/Improvement-system.md) — origem da defesa em 3 camadas
- [CONCERNS.md](../../specs/codebase/CONCERNS.md) — débitos análogos
- [CONVENTIONS.md](../../specs/codebase/CONVENTIONS.md) — permissions reusáveis em `apps.users.permissions`

---

## Cross-references resumidas

| Direção                    | Onde                                                                                                                                                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ↑ Requisitos atendidos     | [RF-003](../../requirements/RF/RF-003-moderation.md), [RNF-security](../../requirements/RNF/RNF-security.md), [RNF-availability](../../requirements/RNF/RNF-availability.md), [RNF-lgpd](../../requirements/RNF/RNF-lgpd.md) |
| ↑ Epic pai                 | [EP-05](../epics/EP-05-moderacao-comunidade.md)                                                                                                                                                                              |
| → Sprint(s)                | Sprint 2-3 (entrega pre-busca), Sprint 5 (documentação retroativa 2026-06-09), Sprint 8 (F-51 previsto)                                                                                                                      |
| → Specs técnicas           | [DESIGN.md](../../specs/moderation/DESIGN.md)                                                                                                                                                                                |
| → Features filhas          | n/a (F-50 é Feature, não Epic)                                                                                                                                                                                               |
| ← Features irmãs sob EP-05 | F-51 (notificação email — Sprint 8), F-52 (appeal — sem sprint), F-53 (auto-expire — sem sprint)                                                                                                                             |

---

_F-50 ✅ Done — entregue em Sprint 2-3 (pre-busca). Documentação retroativa concluída 2026-06-09 (Sprint 5). Próxima ação no Epic: F-51 (notificação email) no Sprint 8._
