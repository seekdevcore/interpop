# Sprint 6 — Avaliação de Supabase (spike)

> **Período**: TBD (planejado pós-Sprint 5)
> **Tema**: Spike técnico para decidir se Supabase entra como suplemento à stack atual
> **Status**: ⏳ Pending (gatilho: Sprint 5 fechado OU disco saturando OR demanda concreta de pgvector/realtime)
> **Tipo**: Sprint de descoberta (não entrega feature de produto)

---

## Contexto

Durante Sprint 4 (busca editorial), o tópico **"vamos usar Supabase + Cloudflare + Hostinger"** foi levantado. Anti-sycophancy ativa: Cloudflare e Hostinger já são lei do projeto (ADRs 003 + 005), então a única decisão real é **Supabase**.

Análise feita em 2026-06-09 identificou 3 cenários com custos muito diferentes:

| Cenário                                                            | Impacto                                           | Recomendação                  |
| ------------------------------------------------------------------ | ------------------------------------------------- | ----------------------------- |
| (A) Supabase como **suplemento** (Storage/pgvector/Edge Functions) | Zero impacto no que existe                        | Avaliar Sprint 6              |
| (B) Supabase como **DB managed** (substitui Postgres self-hosted)  | Quebra ADRs 018/019/021b da busca; exige Pro tier | Não justificável hoje         |
| (C) Supabase como **replatform** (substitui Django)                | Joga fora 60 commits + ADRs 001-014               | Inviável sem razão de produto |

Decisão de 2026-06-09: **adiar para Sprint 6**, cenário A apenas, com gatilhos explícitos.

📄 **ADR formal**: [ADR-015-supabase-evaluation-deferred](../../planning/adrs/ADR-015-supabase-evaluation-deferred.md)

---

## Objetivos do Spike (timeboxed em 3 dias)

1. **Spike Storage** — POC: subir uma capa de artigo para Supabase Storage, servir via CDN, comparar com média servida pelo nginx local. Decidir se vale migrar capas futuras (não retroativo).
2. **Spike pgvector** — Avaliar custo + viabilidade de embedding para semantic search (extensão do EP-10). Não implementar; apenas medir esforço.
3. **Spike Edge Functions** — Avaliar se algum endpoint atual seria mais bem servido em Edge (CORS-free, latência regional). Candidatos: OG meta tags crawler, sitemap, RSS.

**Não-objetivos**: migrar Postgres existente, migrar Django auth, refazer admin. Cenários B e C estão fora do escopo deste Sprint.

---

## Gatilhos para entrar neste Sprint

Pelo menos **um** dos seguintes deve estar verdadeiro:

- [ ] Sprint 5 fechado (EP-10 completo)
- [ ] Disco do KVM 1 ≥ 70% usado (capas de artigos + media saturando)
- [ ] Demanda concreta de produto por semantic search (ex.: "leitor pede 'artigos parecidos com este'")
- [ ] Demanda concreta por real-time (comments live, notificações push)

---

## Entregáveis do Spike

| Entregável                                       | Formato                                                        |
| ------------------------------------------------ | -------------------------------------------------------------- |
| ADR-046 (Storage adoption decision)              | `docs/planning/adrs/ADR-046-supabase-storage-{adopt,defer}.md` |
| Comparação de latência local vs Supabase Storage | `docs/performance/supabase-storage-benchmark.json` + README    |
| Análise de custo mensal (3 cenários de uso)      | Tabela no ADR-046                                              |
| Recomendação final + roadmap se adoptar          | Atualizar este arquivo Sprint-6                                |

---

## Cross-references

- Sprint anterior: [Sprint 5](sprint-5-filtros-deep-linking.md)
- ADR formal: [ADR-015 deferred](../../planning/adrs/ADR-015-supabase-evaluation-deferred.md)
- Stack atual: [Architecture overview §2](../../architecture/overview.md)
- ADR-005 Hostinger (premissa): [`docs/planning/adrs/ADR-005-hostinger-kvm1.md`](../../planning/adrs/ADR-005-hostinger-kvm1.md)
