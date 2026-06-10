# EP-03 — Engajamento da comunidade

> **Tipo**: Epic
> **Status**: 🚧 Parcial — F-20 ✅ Done (Sprint 2-3); F-21/F-22 ⏳ Backlog
> **Prioridade global**: 🟠 Alta
> **Owner**: Gabriel Marques
> **Criado em**: pré-Sprint 1 (implementação retroativa formalizada em 2026-06-09)

---

## Visão de produto

Interpop não é um portal de notícias rápidas — é análise editorial de leitura longa. O engajamento que importa não é volume bruto de cliques, é **conversa pública qualificada** sobre o artigo: leitor discorda, complementa, corrige, manifesta ressonância. Este Epic constrói o espinhaço dessa conversa.

O conjunto inicial entrega o mínimo viável (F-20: comentar, responder, curtir, remover o próprio). Os incrementos futuros (F-21 notificações, F-22 anti-spam) reforçam retenção e qualidade do canal **sem** abrir a porta para threading recursivo nem comentário anônimo — decisões deliberadas em RF-002 para preservar o caráter editorial.

KPI alvo:

- ≥ 25% dos leitores autenticados comentam ao menos uma vez em 30 dias
- ≥ 40% dos artigos publicados recebem ao menos 1 comentário em 7 dias após publicação
- Taxa de remoção por admin ≤ 5% do total de comentários criados (sinaliza saúde da moderação reativa)

---

## Requisitos realizados (rastreabilidade ↑)

Este Epic executa os seguintes requisitos:

| ID                                                             | Requisito                                                                | Tipo            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------- |
| [RF-002](../../requirements/RF/RF-002-comments.md)             | Sistema permite leitor autenticado comentar, responder, curtir e remover | Funcional       |
| [RNF-security](../../requirements/RNF/RNF-security.md)         | Auth obrigatória, defesa em profundidade `IsNotBanned`, OWASP            | Segurança       |
| [RNF-a11y](../../requirements/RNF/RNF-a11y.md)                 | Form e botões de comentário/curtida acessíveis                           | Acessibilidade  |
| [RNF-lgpd](../../requirements/RNF/RNF-lgpd.md)                 | Soft-delete preserva audit trail · retenção formal pendente              | LGPD            |
| [RNF-availability](../../requirements/RNF/RNF-availability.md) | Falha de `apps.comments` não derruba leitura do artigo                   | Disponibilidade |

---

## Features sob este Epic (rastreabilidade ↓)

| ID   | Nome                                  | Sprint  | Status                          | Arquivo                                            |
| ---- | ------------------------------------- | ------- | ------------------------------- | -------------------------------------------------- |
| F-20 | Comentários e curtidas                | 2-3     | ✅ Done (pre-busca)             | [F-20](../features/F-20-comentarios-e-curtidas.md) |
| F-21 | Notificações por resposta             | Backlog | ⏳ Pending — decisão de produto | _(arquivo futuro)_                                 |
| F-22 | Anti-spam reativo (filtro + honeypot) | Backlog | ⏳ Pending — depende de volume  | _(arquivo futuro)_                                 |

> **F-21** (notificações por resposta): aciona quando leitor é respondido. Engenharia: signal no `Comment.save` → `apps.newsletter` ou futuro `apps.notifications`. Decisão de produto pendente: canal (e-mail vs in-app vs ambos), opt-out.
>
> **F-22** (anti-spam): hoje o controle é 100% reativo (admin bana após observar). Backlog quando volume sustentar dor: regex de URL → honeypot → rate-limit específico `comments_create` (S-07 do DESIGN) → eventualmente Akismet/ML.

---

## Métricas de sucesso do Epic

| Métrica                           | Alvo                                  | Como medir                                                     | Status               |
| --------------------------------- | ------------------------------------- | -------------------------------------------------------------- | -------------------- |
| Participação                      | ≥ 25% MAU autenticado comenta em 30d  | Analytics próximo Sprint                                       | ⏳ baseline pendente |
| Cobertura de artigos              | ≥ 40% artigos com 1+ comentário/7d    | Query agregada `Comment.objects.filter(...)`                   | ⏳ baseline pendente |
| Saúde da moderação                | ≤ 5% taxa de remoção por admin        | `Comment.objects.filter(is_deleted, deleted_by__role='admin')` | ⏳ baseline pendente |
| Resposta a defesa em profundidade | 0 comentários criados por banido      | Test `test_create_comment_banned_user_returns_403`             | ✅                   |
| Idempotência de like              | 0 likes duplicados por (user,comment) | `unique_together` enforced no DB                               | ✅                   |

---

## ADRs relacionadas (decisões locked-in)

Não há `adrs/comments/` formal — decisões vivem no [DESIGN.md](../../specs/comments/DESIGN.md) §3-5 e foram implementadas pré-formalização do processo de ADR. Destaques recuperados retroativamente:

- **Soft-delete preserva linha** (DESIGN §4.3) — `perform_destroy` faz `UPDATE is_deleted=true` em vez de `DELETE` físico, preservando audit trail
- **1 nível de aninhamento** (DESIGN §3.2, I8) — `validate_parent_id` exige `parent=None` no candidato
- **Sem `signals.py` no módulo** (DESIGN §3.3) — toda escrita síncrona no request thread; sem fan-out de notificações
- **`IsNotBanned` em escrita** (Improvement-system §11.6 S8) — defesa em profundidade contra usuário banido
- **`unique_together` para idempotência de like** (DESIGN §2.2) — corrida de duplo-clique é atomicamente segura

> **Débito de ADR formal**: as 5 decisões acima precisam virar ADR-NNN em `docs/specs/comments/adrs/` quando o Sprint de housekeeping de moderação rodar.

---

## Sprints envolvidas

| Sprint     | Escopo                                                                     | Status                | Arquivo                     |
| ---------- | -------------------------------------------------------------------------- | --------------------- | --------------------------- |
| Sprint 2-3 | F-20 implementada (pré-formalização)                                       | ✅ entregue em código | _(retroativo, sem arquivo)_ |
| Backlog    | F-21 + F-22 + sprint de moderação (S-01, S-07, OPS-1, OPS-2, GAP-1, GAP-2) | ⏳ planejado          | _(sprint futuro)_           |

---

## Histórico de mudanças

| Data       | Evento                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------- |
| Sprint 2-3 | Módulo `apps.comments` implementado em código (sem RF/Epic/Feature formalizados)                  |
| 2026-06-09 | Spec retroativo `docs/specs/comments/DESIGN.md` produzido (3 achados críticos: S-01, S-07, OPS-1) |
| 2026-06-09 | EP-03 expandido de stub para versão completa; F-20 documentada retroativamente                    |

---

_Última atualização: 2026-06-09 — documentação retroativa pós-fechamento de Sprint 4 (busca). Próxima ação: priorizar Sprint de moderação para limpar S-01 (sanitização HTML) e S-07 (throttle `comments_create`) — ambos hotfix candidates._
