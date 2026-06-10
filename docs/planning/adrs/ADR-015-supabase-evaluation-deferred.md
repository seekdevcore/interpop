# ADR-015: Avaliação de Supabase adiada para Sprint 6 (gatilho explícito)

## Status

**Proposed — Deferred** (registro de decisão de não-fazer agora; revisitar em Sprint 6+ se gatilho atingido).

## Context

Em 2026-06-09, durante encerramento da Sprint 4 (US30.1 busca editorial), foi levantada a possibilidade de adotar **Supabase + Cloudflare + Hostinger** como stack. Análise honesta:

- **Cloudflare** já é parte da stack ([ADR-003](ADR-003-cloudflare-pos-dominio.md))
- **Hostinger KVM 1** já é parte da stack ([ADR-005](ADR-005-hostinger-kvm1.md))
- **Supabase** seria adição nova — nenhuma menção em 4.155 LOC de planning, 14 ADRs project-wide, 35 ADRs da busca, HOSTING-DEPLOY-PLAN, ou Improvement-system

Existem **3 cenários distintos** para Supabase, com custos de retrabalho muito diferentes:

| Cenário | Impacto operacional | Impacto na spec existente |
|---|---|---|
| **(A) Suplemento** — Storage (capas), futuro pgvector, futuro Edge Functions | Postgres fica no Hostinger; Django intacto | Nenhum no que existe; adicionamos ADRs novos |
| **(B) DB managed** — substitui Postgres self-hosted por Supabase Postgres | Reescrever migrations 0001-0005 da busca; CONFIGURATION pt_unaccent + role custom + statement_timeout + trigger ENABLE ALWAYS exigem **Supabase Pro tier** ($25/mês) ou workaround complexo | Quebra ADRs 018/019/021b da busca |
| **(C) Replatform** — substitui Django por PostgREST + Auth + RLS + Edge Functions | Joga fora ~60 commits da feature US30.1; refazer auth (Django roles → Supabase RLS), admin (Django admin → ???), Celery (→ pg_cron + Edge) | Invalida ADRs 001-014 + boa parte das 35 ADRs da busca |

## Decision

**Adiar avaliação para Sprint 6, cenário (A) apenas.** Não considerar cenários (B) ou (C) até que haja razão concreta de produto (não apenas tech-curiosity).

### Gatilhos para entrar em Sprint 6 com este spike

Pelo menos **um** dos seguintes:

1. **Disco do KVM 1 ≥ 70% usado** — capas de artigos + media saturando o storage local
2. **Demanda concreta por semantic search** — leitor pede "artigos parecidos" ou time editorial pede recommendation engine; **pgvector** é convidativo
3. **Demanda concreta por real-time** — comments live, notificações push, "leitores ativos agora"
4. **Sprint 5 fechado** + janela disponível para spike técnico de descoberta

### Escopo do Sprint 6 quando entrar

Timeboxed em 3 dias:

1. **POC Supabase Storage** — subir 1 capa, servir via CDN, comparar latência vs nginx local
2. **Análise de custo pgvector** — esforço de integração vs ganho percebido
3. **Análise de custo Edge Functions** — quais endpoints valeriam migração

### Não-objetivos

- Migrar Postgres atual (cenário B)
- Migrar Django auth (cenário B/C)
- Refazer admin (cenário C)

## Consequences

### Positivas

- Preserva 60 commits da US30.1 e PR #37 mergeado em main como `2bdf73b`
- Não invalida 35 ADRs da busca (incluindo ADR-018 trigger SQL + ADR-019 CONFIGURATION pt_unaccent + ADR-021b mitigações GIN custom)
- Mantém previsibilidade de custo (KVM 1 ~R$ 40/mês vs Supabase Pro $25/mês + bandwidth)
- Decisão é **registrada com gatilho explícito** (não esquecida)

### Negativas

- Se um dos gatilhos disparar abruptamente (ex.: disco saturado em prod), entrada no Sprint 6 será reativa, não planejada
- Storage local em nginx tem limite prático (~30k MAU = ~5GB de capas) — operacionalmente precisa ser monitorado em runbook (`disk-full.md`)

### Trade-offs aceitos

- Sem managed backups Supabase — continuamos com `pg_dump` cron para B2 (ADR-032 da busca)
- Sem managed auth — continuamos com Django + JWT em cookie + django-axes
- Sem managed real-time — sem comments live no MVP (aceitável; produto editorial não é chat)

## Cross-ref

- Sprint planejado: [`docs/backlog/sprints/sprint-6-supabase-evaluation.md`](../../backlog/sprints/sprint-6-supabase-evaluation.md)
- ADR-003 Cloudflare (premissa preservada): [`ADR-003`](ADR-003-cloudflare-pos-dominio.md)
- ADR-005 Hostinger KVM 1 (premissa preservada): [`ADR-005`](ADR-005-hostinger-kvm1.md)
- ADR-018 da busca (incompatível com cenário B): [`docs/specs/busca-editorial/adrs/ADR-018-trigger-sql-fonte-verdade-consistencia.md`](../../specs/busca-editorial/adrs/ADR-018-trigger-sql-fonte-verdade-consistencia.md)
- ADR-019 da busca (incompatível com cenário B): [`docs/specs/busca-editorial/adrs/ADR-019-fts-pt-unaccent-configuration.md`](../../specs/busca-editorial/adrs/ADR-019-fts-pt-unaccent-configuration.md)

## Histórico

| Data | Evento |
|---|---|
| 2026-06-09 | Decisão de adiar para Sprint 6 com gatilhos. Registrada após análise de impacto dos 3 cenários. Anti-sycophancy aplicada: recusa de adotar Supabase agora sem razão de produto. |
| TBD | Revisitar quando gatilho disparar |
