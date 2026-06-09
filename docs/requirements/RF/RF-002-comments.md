# RF-002 — Comentários e curtidas

> **Tipo**: Requisito Funcional
> **Prioridade**: 🟠 Alta
> **Status**: ✅ Realizado em código (Sprint 2-3) · 🚧 documentação retroativa em 2026-06-09

---

## Enunciado de negócio (pt-BR, sem termo técnico)

> **Sistema permite que leitor autenticado comente artigo publicado, responda a outro comentário, curta comentário alheio e remova seu próprio comentário, com proteção contra usuários banidos e preservação de rastro para auditoria.**

A leitura pública de comentários é **aberta** (anônimo enxerga tudo). A escrita (comentar, responder, curtir, remover) é **restrita a leitor autenticado e não banido**. Admin pode remover comentário de qualquer leitor; editor não pode remover de terceiros — apenas seu próprio.

---

### Subseção §comentário (top-level)

> Leitor autenticado e não banido pode escrever comentário em artigo **publicado**. Comentário em artigo `draft` é invisível para leitor e bloqueado para escrita. Conteúdo é texto livre limitado a 2.000 caracteres. Não há edição após criação — comentário é imutável.

### Subseção §reply (resposta)

> Leitor pode responder a um comentário existente (1 nível de aninhamento). Resposta exige que o comentário-pai (a) pertença ao mesmo artigo, (b) não esteja removido, (c) seja top-level. Não é permitido responder a uma resposta — a árvore é cortada em profundidade 1, propositalmente, para legibilidade editorial.

### Subseção §like (curtida)

> Leitor pode curtir qualquer comentário visível (toggle idempotente — clicar duas vezes equivale a curtir-descurtir). Curtida é binária: leitor curte ou não. Contador agregado aparece em cada comentário, recomputado a cada leitura.

### Subseção §soft-delete (remoção do próprio)

> Leitor pode remover seu próprio comentário. Admin pode remover comentário de qualquer leitor (moderação reativa). A remoção é **lógica** (soft-delete): a linha permanece no banco, mas o conteúdo desaparece do display público; metadados (autor, data, quem removeu, quando) ficam preservados para auditoria e LGPD.

### Subseção §moderação-implícita-via-ban

> Sistema **não** abre processo de moderação automático ao receber comentário (não há filtro de spam, não há fila de revisão pré-publicação). Moderação é **reativa**: admin observa comportamento abusivo, abre `BanRequest` em `apps.moderation`, e o leitor banido perde acesso de escrita (POST, DELETE, LIKE) por defesa em profundidade. Comentários antigos do leitor banido **continuam visíveis** — banimento não é retroativo no display, apenas bloqueia novas ações.

---

## Justificativa (por que este requisito existe)

Interpop é leitura longa de análise crítica. Comentário é o canal direto para o leitor:

- Discordar de análise editorial
- Acrescentar contexto que o redator não cobriu
- Apontar erros factuais (correção pública)
- Manifestar engajamento simbólico (curtir um ponto que ressoou)

**Por que aninhamento de 1 nível só:** threading recursivo (Reddit-style) gera espiral de off-topic e degrada legibilidade editorial. Estamos otimizando para conversa pública sobre o artigo, não para fórum.

**Por que sem edição:** comentário em obra editorial é registro público. Permitir edição cria assimetria (leitor edita depois que outros responderam, distorcendo o histórico). Trade-off aceito: leitor que erra apaga e recomenta.

**Por que soft-delete preserva linha:** auditoria (`apps.audit`), LGPD (precisamos saber o que foi removido e por quem), e UX futuro (mostrar "comentário removido" mantendo a árvore de respostas íntegra).

---

## Realizado por (rastreabilidade ↓)

Este requisito é executado pelos seguintes Epics e Features:

| Epic                                                                                   | Feature(s)                                                                           | Status                          |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------- |
| [EP-03 Engajamento da comunidade](../../backlog/epics/EP-03-engajamento-comunidade.md) | [F-20 Comentários e curtidas](../../backlog/features/F-20-comentarios-e-curtidas.md) | ✅ Done (Sprint 2-3, pre-busca) |
| [EP-03 Engajamento da comunidade](../../backlog/epics/EP-03-engajamento-comunidade.md) | F-21 Notificações por resposta                                                       | ⏳ Backlog                      |
| [EP-03 Engajamento da comunidade](../../backlog/epics/EP-03-engajamento-comunidade.md) | F-22 Anti-spam reativo (filtro + honeypot)                                           | ⏳ Backlog                      |

---

## Requisitos Não-Funcionais que limitam este RF

| RNF                                            | Limite imposto                                                                                                                                  |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| [RNF-security](../RNF/RNF-security.md)         | Apenas autenticado escreve · banido bloqueado (defesa em profundidade) · owner ou admin remove · throttle `comments_create` é **débito** (S-07) |
| [RNF-a11y](../RNF/RNF-a11y.md)                 | Form de comentário e botão de curtida acessíveis por teclado · estado "removido" anunciado por leitor de tela                                   |
| [RNF-lgpd](../RNF/RNF-lgpd.md)                 | Soft-delete preserva audit trail · política de retenção de comentários removidos é **débito** (OPS-2)                                           |
| [RNF-availability](../RNF/RNF-availability.md) | Falha no `apps.comments` **não** derruba leitura do artigo (módulo opcional do leitor)                                                          |

---

## Restrições e fora-de-escopo

- **Comentário anônimo: NÃO.** Escrita exige sessão autenticada. Decisão deliberada — anonimato + reach editorial = spam crônico.
- **Threading multi-nível (Reddit-style): NÃO no MVP.** 1 nível só. Avaliar se feedback do leitor pedir.
- **Edição de comentário (PATCH): NÃO.** Campo `updated_at` existe no schema mas nunca atualiza (débito GAP-2 em DESIGN). Decisão pendente: ou remove o campo, ou cria endpoint com janela de tempo curta (ex.: 5min).
- **Filtro automatizado de spam (Akismet/regex/ML): NÃO no MVP.** Mitigação atual = `IsNotBanned` reativo. Backlog → F-22.
- **Notificação ao autor do artigo quando recebe comentário: NÃO no MVP.** Engajamento puxado, não empurrado. Backlog → F-21.
- **Notificação ao autor do comentário quando recebe resposta: NÃO no MVP.** Backlog → F-21.
- **Cleanup automatizado de comentários soft-deletados antigos: NÃO no MVP.** Crescimento indefinido da tabela. LGPD pede retenção definida — ADR + cron pendente (OPS-2).
- **Likes ranqueando comentários (sort by popularity): NÃO no MVP.** Ordenação é estrita por recência (`-created_at`). Avaliar se densidade de comentários crescer.

---

## Decisões técnicas relacionadas

Detalhe completo em [`docs/specs/comments/DESIGN.md`](../../specs/comments/DESIGN.md). Destaques que afetam diretamente o enunciado deste RF:

- **Defesa em profundidade `IsNotBanned`** — `apps.users.permissions.IsNotBanned` aplicada em POST e DELETE de comentário e de like (Improvement-system §11.6 S8)
- **Soft-delete via `is_deleted=True`** — `perform_destroy` sobrescreve o `DELETE` físico do DRF, preservando linha para auditoria
- **Idempotência de like via `unique_together('comment','user')`** — `CommentLike.get_or_create` é atomicamente seguro contra duplo-clique
- **1 nível de aninhamento via `validate_parent_id`** — `CommentSerializer.validate_parent_id` exige `parent=None` no candidato
- **Triagem de moderação via `apps.moderation` (BanRequest)** — comentários não disparam fluxo automático; admin abre ban manualmente

---

## Débitos conhecidos (cross-ref DESIGN §7)

| #     | Item                                                                                                          | Sev | Ação                                                           |
| ----- | ------------------------------------------------------------------------------------------------------------- | --- | -------------------------------------------------------------- |
| S-01  | Conteúdo do comentário chega cru ao DB (sem `bleach`/`nh3`) — XSS persistente se regressão de escape no FE    | 🟠  | Adicionar sanitização server-side em Sprint de moderação       |
| S-07  | Sem `ScopedRateThrottle` específico para `comments_create` — flood em artigo viral                            | 🟠  | **Hotfix candidato** (15 LoC, pattern já vivo em `apps.users`) |
| OPS-1 | Replies órfãs em parent soft-deletado — UX indefinida (esconde tudo? mostra tombstone do parent?)             | 🟡  | Decisão de produto pendente                                    |
| OPS-2 | Sem política de retenção para comentários soft-deletados (LGPD pede limite)                                   | 🟡  | ADR + cron pendente                                            |
| D-04  | `CommentLike` tem índice redundante (`unique_together` + `Index(['comment','user'])`) — insert overhead duplo | 🟡  | Migration `RemoveIndex` em Sprint de housekeeping              |
| GAP-1 | Sem teste para invariante I8 (nesting ≤ 1)                                                                    | 🟢  | Adicionar test direto em Sprint de housekeeping                |
| GAP-2 | `updated_at` existe mas nunca atualiza (sem PATCH)                                                            | 🟢  | Decisão pendente: remove campo OU cria endpoint                |

---

## Histórico

| Data       | Evento                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------ |
| Sprint 2-3 | Módulo implementado (pré-formalização de RF/Epic/Feature); apps.comments criado em código        |
| 2026-06-09 | Spec retroativo `docs/specs/comments/DESIGN.md` produzido (3 achados críticos S-01, S-07, OPS-1) |
| 2026-06-09 | RF-002 expandido de stub para versão completa (este arquivo) — chore/docs-reorg                  |

---

## Cross-references

- [Personas e cenários](../personas-e-cenarios.md) — leitor autenticado, admin, editor
- [Epic pai EP-03](../../backlog/epics/EP-03-engajamento-comunidade.md)
- [Feature realizadora F-20](../../backlog/features/F-20-comentarios-e-curtidas.md)
- [Spec técnica DESIGN.md](../../specs/comments/DESIGN.md) — modelo de dados, fluxos, invariantes, débitos
- [Improvement-system §11.6 S8](../../planning/Improvement-system.md) — defesa em profundidade `IsNotBanned`
- [Architecture overview §5 apps Django](../../architecture/overview.md)
