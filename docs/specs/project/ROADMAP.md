# ROADMAP — Interpop

> Features e milestones em horizonte rolling. Atualizado a cada Sprint que fecha ou que muda prioridade. Sucessor enxuto do `Improvement-system.md` §6.

---

## Status atual (2026-06-09)

- **Sprint 4 ✅** entregue: US30.1 busca editorial full-text (PR #37 → `2bdf73b` em main)
- **Sprint 5 ⏳** próximo: filtros + deep-linking + 11 tasks restantes do REVIEW-PHASE-3
- **Sprint 6 ⏳** condicional: Supabase spike + CLS pré-existente
- **PR #39 aberto**: reorg docs/ (`chore/docs-reorg-requirements-backlog`)

---

## Sprint 5 — Filtros + Deep-linking + endurecimento operacional

> [Detalhe completo](../../backlog/sprints/sprint-5-filtros-deep-linking.md)

| Tipo    | ID                                                        | Item                                                                                                              | Prioridade |
| ------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------- |
| Feature | [F-31](../../backlog/features/F-31-filtros-busca.md)      | Filtros (autor, editoria, datas)                                                                                  | 🟠         |
| Feature | [F-32](../../backlog/features/F-32-deep-linking-busca.md) | Deep-linking + share URL                                                                                          | 🟡         |
| Task    | TX-16                                                     | Lighthouse CI gate (sai do "manual")                                                                              | 🟠         |
| Task    | TX-22                                                     | Investigar CLS pré-existente (0.15+)                                                                              | 🟠         |
| Task    | T30.4.X1                                                  | Pseudonimização forte search_log ([ADR-035](../busca-editorial/adrs/ADR-035-pseudonimizacao-forte-search-log.md)) | 🟠         |
| Task    | T30.1.X20-X22                                             | Visual regression + E2E + property-based                                                                          | 🟡         |
| Task    | TX-13/14/15                                               | Runbook DR + scaling triggers + Postgres role                                                                     | 🟡         |

DoD do Sprint: EP-10 inteiro pode mover para `done/`.

---

## Sprint 6 — Spike Supabase + CLS pré-existente

> [Detalhe completo](../../backlog/sprints/sprint-6-supabase-evaluation.md)

**Gatilhos para entrar** (precisa ≥1):

- Sprint 5 fechado
- Disco KVM 1 ≥ 70% usado
- Demanda concreta por semantic search (pgvector)
- Demanda concreta por real-time

**Escopo**:

- POC Supabase Storage para capas
- Análise custo pgvector + Edge Functions
- Decidir ADR-046 (Storage adopt / defer)
- Fix CLS pré-existente em paralelo (TX-22)

**Não-escopo**: cenários B (DB managed) ou C (replatform). Ver [ADR-015](../../planning/adrs/ADR-015-supabase-evaluation-deferred.md).

---

## Sprint 7 — Deploy automatizado

| Item                           | Por que                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/deploy.yml` | Hoje deploy é manual. Workflow está planejado em [HOSTING-DEPLOY-PLAN §A.3](../../planning/HOSTING-DEPLOY-PLAN.md). |
| Staging environment            | Subir clone do prod em KVM 1 separado ou subdomain                                                                  |
| Smoke automatizado pós-deploy  | curl /healthz/ + auth flow + busca                                                                                  |
| Rollback automatizado          | systemd previous version                                                                                            |

---

## Sprint 8 — Newsletter cleanup

| Item                             | Por que                                                      |
| -------------------------------- | ------------------------------------------------------------ |
| Webhook SendGrid bounce handling | Marca `NewsletterSubscriber.is_active=False` automaticamente |
| Métrica de open rate             | Pixel transparente para tracking de open (com opt-in LGPD)   |
| Segmentação por categoria        | Leitor escolhe quais editorias receber                       |
| A/B subject lines                | Função de admin testar variantes                             |

---

## Sprint 9 — Refactor Admin/

| Item                                               | Por que                                                                       |
| -------------------------------------------------- | ----------------------------------------------------------------------------- |
| Quebrar `src/pages/Admin/index.tsx` (1341 LOC TSX) | God-component; cada tab em rota própria                                       |
| Quebrar `src/pages/Admin/Admin.css` (1769 LOC)     | CSS modules por sub-componente                                                |
| Refactor `apps/audit/` (4 responsabilidades)       | Separar middleware + sentry + structlog + AdminMetricsView + security_headers |
| Promote/demote role UI (hoje só via shell)         | Endpoint + UI                                                                 |

---

## Backlog longo (sem Sprint atribuída)

### Produto

- **DELETE account flow** (LGPD Art. 18 direito de eliminação)
- **Export user data JSON** (LGPD Art. 18 portabilidade)
- **2FA para staff** (security gap S-04 — ver [CONCERNS](../codebase/CONCERNS.md))
- **Sort dropdown** em /buscar (Sprint 5 ou 6)
- **Mobile filter sheet** `<dialog>` HTML (parte do F-31)
- **Comments threading** (atual: 1 nível de reply; avaliar se demanda)
- **Newsletter premium** (modelo de receita longo prazo)
- **Sitemap.xml + RSS dinâmicos** (SEO)
- **OG meta server-side rendering** (existe `og_middleware` — ampliar?)

### Técnico

- **Migrar `docs/planning/` para `docs/specs/` ou unignore** — decisão arquitetural
- **Materializar runbooks operacionais** (existem stubs; preencher de verdade)
- **APM (Datadog/New Relic)** — quando dor justificar
- **PgBouncer** — quando connection pool apertar (>30k MAU sustentado)
- **CDN para imagens** (Cloudflare Images ou B2+Cloudflare) — quando disco apertar
- **Lighthouse CI nightly em prod (RUM)** — quando dor sintética não bastar
- **Mutation testing nightly** (mutmut + Stryker — [ADR-043](../busca-editorial/adrs/ADR-043-mutation-testing-stryker-searchservice-usesearch.md))
- **K6 Zipfiano nightly** ([ADR-044](../busca-editorial/adrs/ADR-044-k6-load-test-seed-zipfiano-reproducible.md))
- **Property-based amplo** (Hypothesis em todo lugar útil — [ADR-040](../busca-editorial/adrs/ADR-040-property-based-testing-hypothesis-invariantes-dominio.md))

### Documental

- **Preencher EP-01..EP-06 e RF-001..RF-006** (stubs criados em PR #39; preencher progressivo por Sprint)
- **Materializar specs retroativos** para 6 módulos Django (articles, comments, moderation, newsletter, users-auth, audit) — em andamento neste PR
- **Postmortems**: hoje só template + 1 retroativo (C1 JWT rotation). Preencher conforme incidentes
- **Decision log de produto** — separar de ADRs técnicos? Em STATE.md por enquanto

### Editorial

- Modelo de redação convidada (curators externos)
- Newsletter premium (longo prazo)
- Eventos / ofertas / parcerias

---

## Marcos macro (não-sprint)

| Marco                  | ETA                          | O que conta como pronto                                                               |
| ---------------------- | ---------------------------- | ------------------------------------------------------------------------------------- |
| **Beta privado**       | Quando Sprint 7 fechar       | Deploy automatizado + smoke staging + 5 redatores convidados publicando               |
| **Beta público**       | +1 mês após beta privado     | 12 artigos publicados, ≥100 cadastros, observability rodando 7d limpa                 |
| **Launch público**     | +2-3 meses após beta público | KPIs minimamente saudáveis, newsletter ≥500 subscribers, sem incidente crítico em 30d |
| **1k autenticados**    | +3-6 meses após launch       | Comments ativos, retenção +15%                                                        |
| **30k MAU sustentado** | +12 meses após launch        | Trigger para reavaliar Hostinger KVM 2 ou Hetzner (ADR-005)                           |
| **Newsletter premium** | ≥+12 meses após launch       | Requer base de 2k subscribers free com engagement                                     |

---

## Cross-references

- [PROJECT.md](PROJECT.md) — visão
- [STATE.md](STATE.md) — memória viva
- [Backlog](../../backlog/README.md) — Epics/Features/Sprints
- [Improvement-system histórico](../../planning/Improvement-system.md) — backlog mestre original (1755 LOC, gitignored)

---

_Criado em 2026-06-09. Substituirá progressivamente o `Improvement-system.md` §6. Atualizar ao fim de cada Sprint que fecha._
