# RF-003 — Moderação e banimento

> **Tipo**: Requisito Funcional
> **Prioridade**: 🟠 Alta
> **Status**: ✅ Realizado em código (Sprint 2-3, pre-busca) · 📝 Documentação retroativa concluída 2026-06-09

---

## Enunciado de negócio (pt-BR, sem termo técnico)

> **Sistema permite que admin aplique banimento direto em leitor por violação dos termos de comunidade, e que editor solicite banimento via fluxo formal (admin decide aprovar ou rejeitar), com invariantes "admin é imune a banimento entre si" e "criador do produto (dev) é imune por design", e com trilha de auditoria imutável de todo o processo.**

### Subseção §ban-direto

> Sistema permite que admin (ou dev) bana leitor diretamente, sem solicitação prévia, informando alvo e motivo. O efeito é imediato: o usuário banido perde a capacidade de escrever (comentar, abrir solicitação de banimento, curtir) na próxima requisição autenticada. Acesso somente de leitura continua até o token de sessão expirar (limitação operacional documentada — ver §restrições OPS-2).

### Subseção §ban-request-fluxo

> Sistema permite que editor abra solicitação de banimento (`BanRequest`) contra leitor, informando alvo, motivo e — opcionalmente — a mensagem ofensiva que disparou a solicitação. Solicitação fica em estado **pendente** até admin (ou dev) decidir por **aprovar** (cria banimento real) ou **rejeitar** (encerra sem efeito). Editor é notificado da decisão na próxima visita ao painel. Admins recebem email assim que solicitação é criada.

### Subseção §invariantes-hierarquia

> Hierarquia inegociável do produto: `dev > admin > editor > user`. Quatro invariantes:
>
> 1. **Dev nunca é banido**, por construção (não há ator superior).
> 2. **Admin só é banido por dev** — admin não bana admin.
> 3. **Editor abre solicitação contra `user` apenas** — não pode pedir banimento de admin nem de dev.
> 4. **Auto-target é proibido** — usuário não pode pedir banimento de si próprio.
>
> Invariantes 1 e 2 são sustentadas em **três camadas** independentes (queryset filtrado por ator, validação no serializer, barreira final na camada de serviço) para que bug em uma camada não derrube a regra.

### Subseção §audit-trail

> Sistema grava trilha de auditoria imutável (apenas inserção, sem update nem delete) de todas as ações de moderação: quem aplicou o banimento, contra quem, em que momento, com qual IP de origem e qual user-agent. Inclui também abertura de solicitação e decisão (aprovar/rejeitar). Trilha sobrevive ao próprio banimento — se o ban é revogado, o histórico de quem o aplicou permanece.

---

## Justificativa (por que este requisito existe)

Interpop é editorial brasileiro com seção de comentários abertos a leitores autenticados. Sem moderação ativa:

- Conteúdo abusivo/spam/discurso de ódio fica visível, contamina conversa pública e expõe a marca.
- Editores (que conhecem o tom editorial) ficam sem canal formal para escalar casos — abrem ticket no WhatsApp, decisão se perde, não há trilha.
- Admin não tem ferramenta de banimento direto para casos óbvios (ex.: leitor que comentou nome próprio em 14 artigos seguidos com slur).

**Por que o fluxo dual (ban direto + BanRequest)?** Admin tem visão executiva — em violação clara baniu e seguiu. Editor tem visão editorial — vê padrão sutil de ataque, formaliza, admin decide com 2º par de olhos. Separar os dois caminhos respeita a hierarquia sem travar moderação rápida.

**Por que invariante "admin imune entre si"?** Decisão de produto: time pequeno de admins co-iguais (3-5 pessoas) precisa funcionar como conselho — ninguém arbitra contra outro do mesmo nível. Conflito entre admins escala para o dev, sempre.

**Implicação de produto**: confiabilidade da seção de comentários é fundação de retenção. KPI alvo pós-launch: < 0.5% comentários removidos manualmente por dia (proxy de qualidade da comunidade).

---

## Realizado por (rastreabilidade ↓)

| Epic                                                                               | Feature(s)                                                                               | Status                                         |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------- |
| [EP-05 Moderação da comunidade](../../backlog/epics/EP-05-moderacao-comunidade.md) | [F-50 Ban + BanRequest workflow](../../backlog/features/F-50-ban-banrequest-workflow.md) | ✅ Done (Sprint 2-3, pre-busca)                |
| [EP-05 Moderação da comunidade](../../backlog/epics/EP-05-moderacao-comunidade.md) | F-51 Notificação por email do banido (aprovado/rejeitado)                                | ⏳ Backlog Sprint 8                            |
| [EP-05 Moderação da comunidade](../../backlog/epics/EP-05-moderacao-comunidade.md) | F-52 Fluxo de contestação do banido (appeal)                                             | ⏳ Backlog (sem sprint)                        |
| [EP-05 Moderação da comunidade](../../backlog/epics/EP-05-moderacao-comunidade.md) | F-53 Auto-expiração de banimento temporário                                              | ⏳ Backlog (depende de ADR sobre `expires_at`) |

---

## Requisitos Não-Funcionais que limitam este RF

| RNF                                            | Limite imposto                                                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [RNF-security](../RNF/RNF-security.md)         | Defesa em 3 camadas (queryset → validate → service); permissões DRF `IsAdminUser`/`IsEditorOrAdmin`/`IsNotBanned`              |
| [RNF-availability](../RNF/RNF-availability.md) | Falha do worker celery (email) não bloqueia abertura de `BanRequest` — degradação graciosa com log                             |
| [RNF-lgpd](../RNF/RNF-lgpd.md)                 | Trilha de auditoria mantém IP/UA do ator (controlador); razão do ban é dado pessoal sensível sobre o titular — retenção 5 anos |
| [RNF-a11y](../RNF/RNF-a11y.md)                 | Painel admin de moderação acessível por teclado + WCAG 2.2 AA (parcial — admin Django nativo, melhorias em backlog UI)         |

---

## Restrições e fora-de-escopo

- **Banimento temporário com `expires_at`**: campo existe no schema, mas **nenhum job automatizado** revoga o ban quando vence. Bans temporários permanecem ativos indefinidamente até admin revogar manualmente. Documentado como débito **OPS-1** no [DESIGN.md §7](../../specs/moderation/DESIGN.md). Resolução depende de F-53 (futura).
- **Fluxo de contestação (appeal) do banido**: **não existe**. Banido descobre que foi banido tentando comentar (mensagem genérica de bloqueio). Canal atual de contestação é email manual para o time. Backlog: F-52.
- **Auto-revogação por horário** (ex.: "ban de 7 dias"): **não existe** — depende de F-53.
- **Invalidação imediata de sessão JWT ao banir**: **não existe**. Token de acesso (cookie httpOnly) permanece válido até expirar (~30min). Durante essa janela, banido perde escrita (bloqueada por `IsNotBanned`) mas mantém leitura autenticada. Documentado como débito **OPS-3** no DESIGN. Resolução requer ADR sobre estratégia de invalidação (blocklist Redis vs. TTL curto).
- **Notificação ao banido** (email "sua conta foi suspensa por X"): **não existe**. Backlog: F-51.
- **Banimento parcial** (ex.: "banido só de comentar em editorial Y"): fora de escopo — banimento é all-or-nothing.

---

## Decisões técnicas relacionadas (ADRs)

Detalhe completo em [DESIGN.md §8](../../specs/moderation/DESIGN.md). Destaques que afetam diretamente o enunciado:

- **ADR-006** (DevSecOps embedded) — fundamenta defesa em profundidade (3 camadas)
- **ADR-010** (`/api/v1/` versionado) — prefixo das URLs `/api/v1/moderation/bans/` e `/api/v1/moderation/ban-requests/`
- **ADR-012** (`@transaction.atomic` em services que tocam ≥2 rows) — `ban_user()` atualiza `Ban` + `User.is_banned` na mesma transação
- **Sem ADR formal para hierarquia `dev > admin > editor > user`** — regra codificada em `CLAUDE.md §4` + comentários no código (`apps/users/models.py:59-107`). Promover a ADR está em [DESIGN.md §9 Q4](../../specs/moderation/DESIGN.md).

---

## Histórico

| Data                  | Evento                                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| Sprint 2 (mai/2026)   | Módulo `apps.moderation` nascido com schema final (`Ban` OneToOne + `BanRequest`); migration `0001_initial` |
| Sprint 3 (mai/2026)   | Defesa em 3 camadas formalizada após observação 827 de 29-mai (Improvement-system §11.6 S8/C13)             |
| 2026-06-09 (Sprint 5) | DESIGN.md retroativo escrito; RF-003 preenchido a partir do stub; EP-05 + F-50 espelhados                   |

---

## Cross-references

- [DESIGN.md — `moderation`](../../specs/moderation/DESIGN.md) (fonte de verdade técnica)
- [Personas e cenários](../personas-e-cenarios.md) — admin, dev, editor, user (leitor)
- [Backlog do Epic EP-05](../../backlog/epics/EP-05-moderacao-comunidade.md)
- [Feature F-50](../../backlog/features/F-50-ban-banrequest-workflow.md)
- [Improvement-system.md §11.6 S8 + C13](../../planning/Improvement-system.md) — origem da defesa em 3 camadas
- [CONCERNS.md](../../specs/codebase/CONCERNS.md) — débitos análogos (S-07 rate-limit em comments)
- [CLAUDE.md §4 Convenções](../../../CLAUDE.md) — hierarquia `dev > admin > editor > user` codificada
