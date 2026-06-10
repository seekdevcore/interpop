# PROJECT — Interpop

> Visão e objetivos do produto. Atualizar quando KPI, persona-alvo ou modelo de monetização mudar.

---

## O que é

**Interpop** é uma plataforma editorial brasileira de **análise crítica do Soft Power** e da geopolítica da cultura pop — música, moda, cinema, literatura, cultura digital. Não é "blog" nem "agregador de notícias": é **leitura longa autoral** sobre como cultura é poder.

---

## Por que existe

Cultura pop é tratada na mídia mainstream como entretenimento (e portanto leve, descartável). Quando ela é geopolítica — quando K-pop muda balança comercial sul-coreana, quando Beyoncé desestabiliza supremacia branca em billboards, quando Substack mata jornalismo institucional — ninguém escreve com profundidade em pt-BR.

Interpop ocupa esse vão: análise editorial profunda, em pt-BR, sobre Soft Power como conceito vivo (não acadêmico-fossilizado).

---

## Persona-alvo

**Leitor primário (P-02 em [`personas-e-cenarios.md`](../../requirements/personas-e-cenarios.md))**: leitor autenticado, mais de 22 anos, com curso superior em andamento ou completo, interessado em cultura E em pensamento crítico — não procura review de álbum, procura **leitura sobre o que aquele álbum significa geopoliticamente**.

**Persona secundária (P-01)**: leitor anônimo que chega via search engine ou rede social. Lê 1-3 artigos, talvez cadastre. ~70% do tráfego MAU.

**Personas operacionais**: redator (P-03), admin (P-04), dev/owner (P-05).

---

## Modelo de negócio

**Editorial proprietário com newsletter como funil principal**. Não é freemium, não é paywall, não é venda de curso. KPI vem de **retenção** e **distribuição**, não conversão de funil.

Receita projetada (longo prazo): patrocínio editorial nicho (marcas culturais sérias, eventos) + newsletter premium opcional (≥1 ano após launch). Não vai depender de Google Ads.

---

## KPIs

| KPI                    | Alvo de 6 meses pós-launch | Como medir                     |
| ---------------------- | -------------------------- | ------------------------------ |
| MAU autenticado        | 5.000                      | Analytics                      |
| MAU anônimo            | 30.000                     | Analytics                      |
| Sessão >2 páginas      | ≥30% (+15 vs pré-busca)    | Analytics                      |
| Newsletter subscribers | 2.000                      | Tabela `newsletter_subscriber` |
| Newsletter open rate   | ≥40%                       | SendGrid analytics             |
| Artigos publicados/mês | ≥12 (3 por semana)         | Tabela `articles`              |
| Comentários/artigo     | ≥3                         | Tabela `comments`              |
| Bounce rate home       | ≤55%                       | Analytics                      |
| Tempo médio em artigo  | ≥3 min                     | Analytics                      |
| Lighthouse Mobile p75  | LCP ≤ 2.5s, CLS ≤ 0.1      | RUM + Lighthouse CI            |

---

## Restrições inegociáveis (regras do produto)

1. **Idioma pt-BR** primário. Snapshots em outros idiomas só com decisão de produto explícita.
2. **Leitura longa**. Artigo médio = 8-15 min de leitura (1.500-3.000 palavras). Não publicamos teaser/clickbait.
3. **Análise autoral**. Redator pensa, não compila. Não usamos IA para gerar conteúdo (uso transparente para revisão é aceito).
4. **LGPD by design** ([RNF-lgpd](../../requirements/RNF/RNF-lgpd.md)). DPO designado ([ADR-008](../../planning/adrs/ADR-008-dpo-designado.md)).
5. **WCAG 2.2 AA inegociável** ([RNF-a11y](../../requirements/RNF/RNF-a11y.md)). Não publicamos componente com violação axe.
6. **Não tracking invasivo**. Sem Google Analytics, sem Facebook Pixel. Métricas mínimas via Sentry RUM + heatmap opt-in eventual.

---

## Bases do produto

| Base                                             | Por que escolhemos                                                                | Trade-off aceito                                           |
| ------------------------------------------------ | --------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Django + DRF backend                             | Maturidade do admin, ORM produtivo, ecossistema                                   | Não é o stack "mais moderno" — não é Node-based            |
| React 19 + Vite frontend (CSR)                   | App leve, build rápido, type safety, ecossistema                                  | LCP em conexão lenta exige skeletons + lazy routes         |
| Postgres self-hosted                             | Controle de FTS pt-BR (`pt_unaccent`), trigger SQL como SSOT, role/timeout custom | Você é o DBA                                               |
| Hostinger KVM 1                                  | R$ ~40/mês, controle total via SSH                                                | SPOF do host; backup em B2 mitiga                          |
| Cloudflare na frente                             | DDoS + WAF + cache de estáticos + Turnstile gratuito                              | Dependência de terceiro; mas é confiável e free tier basta |
| SimpleJWT em cookie httpOnly                     | XSS-resistant, SameSite=Lax                                                       | UX mais complexa que session ID puro                       |
| Celery + Redis                                   | Newsletter fan-out, password reset, futuras tasks                                 | +1 processo systemd no VPS                                 |
| pt-BR first com `engenharia-de-requisitos` skill | Naming consistente, BDD em Gherkin pt-BR, IDs canônicos                           | Time precisa internalizar convenção                        |
| SDD com auto-sizing                              | Spec quando precisa, quick quando não                                             | Disciplina de "isto é Quick ou Medium?" antes de começar   |

---

## Bases que NÃO escolhemos (e por quê)

| Não escolhido           | Motivo                                                                                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js                 | SSR/SSG são overhead para nosso volume; CSR + lazy + skeleton resolve. Revisitar quando passar de 100k MAU.                                                                       |
| Supabase (hoje)         | Quebraria ADRs 018/019/021b da busca; KVM 1 + Postgres self-hosted está dimensionado. Avaliação Sprint 6+ [ADR-015](../../planning/adrs/ADR-015-supabase-evaluation-deferred.md). |
| Vercel/Netlify          | Lock-in + custo cresce com tráfego; KVM 1 é R$ 40/mês para tudo.                                                                                                                  |
| AWS/GCP                 | Complexidade desproporcional. Hetzner é Plano B documentado (ADR-005).                                                                                                            |
| Reddit-style threading  | Comments simples (1 nível de reply) basta para discussão editorial.                                                                                                               |
| Google Analytics        | Privacy concerns + LGPD overhead + sem necessidade real.                                                                                                                          |
| reCAPTCHA               | Cookie do Google dispara banner LGPD. Turnstile resolve (ADR-007).                                                                                                                |
| Mastodon-like federação | Complexidade injustificada para produto editorial centralizado.                                                                                                                   |
| Algolia/Elasticsearch   | Postgres FTS basta para nosso volume (35 ADRs decidem isso).                                                                                                                      |

---

## Estado atual (snapshot 2026-06-09)

- **Sprint 4 fechado** com US30.1 (busca editorial full-text) entregue em main como `2bdf73b`
- **403 testes** passando (325 backend + 78 frontend)
- **15/15 CI checks** verdes
- **WAVE 10/10** em todas as rotas
- **Baseline Lighthouse mobile**: perf 81, LCP 3.1s ⚠️, CLS 0.176 ❌ (gaps pré-existentes, não causados pela busca)
- **Bundle Buscar lazy**: 14.5 KB gz (dentro do gate ≤+20 KB)
- **Deploy ainda manual** — workflow `deploy.yml` planejado em HOSTING-DEPLOY-PLAN.md
- **35 ADRs** materializadas para busca + 14 ADRs do projeto (gitignored em `planning/`)

---

## Próximos marcos

| Marco                                  | ETA  | O que precisa fechar                                                                                 |
| -------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------- |
| Sprint 5 — Filtros + Deep-linking      | TBD  | F-31 + F-32 + 11 tasks restantes do REVIEW-PHASE-3 + Lighthouse CI gate + pseudonimização search_log |
| Sprint 6 — Supabase spike + CLS fix    | TBD  | ADR-015 + análise de Storage para capas + CLS pré-existente                                          |
| Sprint 7 — Deploy automatizado         | TBD  | `deploy.yml` workflow + smoke staging                                                                |
| Sprint 8 — Newsletter cleanup + bounce | TBD  | webhook SendGrid + `is_active=False` em bounce                                                       |
| Sprint 9 — Refactor Admin/             | TBD  | Quebrar 1341 LOC TSX + 1769 LOC CSS em sub-rotas                                                     |
| Sprint 10+                             | open | depende de feedback de produto pós-launch                                                            |

Detalhe em [`ROADMAP.md`](ROADMAP.md).

---

## Cross-references

- [ROADMAP.md](ROADMAP.md) — features + milestones
- [STATE.md](STATE.md) — memória viva (decisões, blockers, lessons)
- [Requisitos](../../requirements/README.md) — RF + RNF
- [Backlog](../../backlog/README.md) — Epics + Features + Sprints
- [Codebase brownfield](../codebase/) — stack/architecture/conventions/testing/integrations/concerns
- [Architecture overview legacy](../../architecture/overview.md)
- [Improvement-system histórico (1755 LOC, gitignored)](../../planning/Improvement-system.md)

---

_Criado em 2026-06-09 — primeiro PROJECT.md formal do Interpop. Sucessor enxuto da §1 do Improvement-system histórico._
