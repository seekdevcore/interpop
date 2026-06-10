# EP-05 — Moderação da comunidade

> **Tipo**: Epic
> **Status**: ✅ Realizado em código (Sprint 2-3, pre-busca) · 📝 Documentação retroativa concluída 2026-06-09
> **Prioridade global**: 🟠 Alta
> **Owner**: Gabriel Marques
> **Criado em**: Sprint 2 (mai/2026) · **Encerramento operacional**: Sprint 3 (mai/2026)

---

## Visão de produto

Interpop tem seção de comentários abertos a leitores autenticados. Sem ferramenta de moderação ativa, comportamentos abusivos (spam, discurso de ódio, ataque pessoal a redator) ficam visíveis, contaminam a conversa pública e expõem a marca. O Epic de Moderação da Comunidade entrega o **fluxo dual** que respeita a hierarquia do produto:

- **Admin bana direto** — em violação clara, sem precisar pedir permissão.
- **Editor solicita banimento** — formaliza o caso com justificativa, admin decide com 2º par de olhos.

Sustenta também as **invariantes inegociáveis** da hierarquia `dev > admin > editor > user`: dev é imune por design; admin é imune entre si (só dev baneia admin); editor age só sobre leitor; ninguém bana a si mesmo. Defesa em 3 camadas (queryset, validate, service) garante que bug isolado não derruba a invariante.

KPI alvo pós-launch:

- < 0.5% comentários removidos manualmente por dia (proxy de qualidade da comunidade)
- 100% das decisões de banimento com trilha de auditoria (ator, alvo, IP, UA, timestamp)
- 0 incidentes de admin banindo admin (invariante I2 nunca viola)
- 100% dos `BanRequest` criados notificam ao menos 1 admin via email em ≤ 5min

---

## Requisitos realizados (rastreabilidade ↑)

Este Epic executa os seguintes requisitos:

| ID                                                             | Requisito                                                             | Tipo            |
| -------------------------------------------------------------- | --------------------------------------------------------------------- | --------------- |
| [RF-003](../../requirements/RF/RF-003-moderation.md)           | Sistema permite ban direto + BanRequest com invariantes de hierarquia | Funcional       |
| [RNF-security](../../requirements/RNF/RNF-security.md)         | Defesa em 3 camadas; permissões DRF; trilha de auditoria              | Segurança       |
| [RNF-availability](../../requirements/RNF/RNF-availability.md) | Falha do worker celery (email) não bloqueia abertura de BanRequest    | Disponibilidade |
| [RNF-lgpd](../../requirements/RNF/RNF-lgpd.md)                 | Razão do ban (dado pessoal sensível) com retenção 5 anos              | LGPD            |
| [RNF-a11y](../../requirements/RNF/RNF-a11y.md)                 | Painel admin acessível por teclado (parcial — admin Django nativo)    | Acessibilidade  |

---

## Features sob este Epic (rastreabilidade ↓)

| ID   | Nome                                                 | Sprint    | Status                                                   | Arquivo                                             |
| ---- | ---------------------------------------------------- | --------- | -------------------------------------------------------- | --------------------------------------------------- |
| F-50 | Ban + BanRequest workflow                            | 2-3       | ✅ Done (pre-busca)                                      | [F-50](../features/F-50-ban-banrequest-workflow.md) |
| F-51 | Notificação por email do banido (aprovado/rejeitado) | 8 (prev.) | ⏳ Backlog                                               | (a criar quando entrar em sprint)                   |
| F-52 | Fluxo de contestação do banido (appeal)              | —         | ⏳ Backlog (sem sprint — depende de volume)              | (a criar)                                           |
| F-53 | Auto-expiração de banimento temporário               | —         | ⏳ Backlog (depende de ADR sobre `expires_at` no schema) | (a criar)                                           |

---

## Métricas de sucesso do Epic

| Métrica                              | Alvo                                                     | Como medir                                    | Status                       |
| ------------------------------------ | -------------------------------------------------------- | --------------------------------------------- | ---------------------------- |
| Cobertura de auditoria               | 100% decisões com ator + alvo + IP + UA + timestamp      | Query em `audit_log` cruzada com `bans` table | ✅                           |
| Invariante I2 (admin não bana admin) | 0 violações                                              | Test `test_ban_hierarchy.py`                  | ✅                           |
| Latência de notificação email        | ≥ 1 admin notificado em ≤ 5min após `BanRequest` criado  | Métrica celery `task_runtime`                 | 🟡 sem instrumentação formal |
| Decisões dentro de 7 dias            | ≥ 90% dos `BanRequest` decididos em até 7 dias           | Query `decided_at - created_at`               | 🟡 sem dashboard             |
| Cobertura de testes da hierarquia    | 100% das 4 invariantes (I1/I2/I3/I4) com teste explícito | `pytest apps/moderation/tests/`               | ✅                           |

---

## ADRs relacionadas (decisões locked-in)

Detalhe completo em [`docs/specs/moderation/DESIGN.md §8`](../../specs/moderation/DESIGN.md). Destaques:

- **ADR-006** (DevSecOps embedded) — fundamenta defesa em profundidade
- **ADR-010** (`/api/v1/` versionado) — prefixo das URLs
- **ADR-012** (`@transaction.atomic` em services que tocam ≥2 rows) — `ban_user()` atualiza `Ban` + `User.is_banned` na mesma transação
- **Sem ADR formal** para hierarquia `dev > admin > editor > user` — promover está em [DESIGN.md §9 Q4](../../specs/moderation/DESIGN.md)

---

## Sprints envolvidas

| Sprint   | Escopo                                                      | Status                 |
| -------- | ----------------------------------------------------------- | ---------------------- |
| Sprint 2 | F-50 base — schema + service + views + permissões           | ✅ entregue mai/2026   |
| Sprint 3 | F-50 hardening — defesa 3 camadas + testes I1/I2/I10        | ✅ entregue mai/2026   |
| Sprint 5 | Documentação retroativa (RF-003 + EP-05 + F-50 + DESIGN.md) | ✅ entregue 2026-06-09 |
| Sprint 8 | F-51 (notificação email do banido) — _previsto_             | ⏳ planejado           |

---

## Histórico de mudanças

| Data                | Evento                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| Sprint 2 (mai/2026) | Epic criado; F-50 implementada com schema final (`Ban` OneToOne + `BanRequest`); migration `0001_initial` |
| Sprint 3 (mai/2026) | Defesa em 3 camadas formalizada após observação 827 (29-mai) — Improvement-system §11.6 S8/C13            |
| 2026-06-09          | DESIGN.md retroativo escrito; EP-05 + F-50 + RF-003 preenchidos a partir de stubs                         |

---

## Cross-references

- [RF-003 — Moderação e banimento](../../requirements/RF/RF-003-moderation.md)
- [F-50 — Ban + BanRequest workflow](../features/F-50-ban-banrequest-workflow.md)
- [DESIGN.md retroativo de `moderation`](../../specs/moderation/DESIGN.md)
- [Improvement-system.md §11.6 S8 + C13](../../planning/Improvement-system.md) — origem da defesa em 3 camadas
- [CONCERNS.md](../../specs/codebase/CONCERNS.md) — débitos OPS-1/OPS-2/OPS-3 + GAP-1..GAP-6
- [CLAUDE.md §4 Convenções](../../../CLAUDE.md) — hierarquia `dev > admin > editor > user` codificada

---

_EP-05 ✅ Realizado em código Sprint 2-3 (pre-busca). Documentação retroativa concluída 2026-06-09. Próxima ação: F-51 (notificação email) no Sprint 8._
