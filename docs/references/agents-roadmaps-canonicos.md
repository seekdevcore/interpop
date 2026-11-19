# Roadmaps canônicos de referência (stack Interpop)

> Movido do `AGENTS.md` em 2026-11-04 (era a §5). Texto original, sem reescrita.
> A regra de uso dos roadmaps continua valendo em toda sessão pelo `~/.claude/CLAUDE.md` global (versão project-agnostic); este arquivo guarda o mapeamento para o stack Interpop.
> Nota: o "protocolo da §2" e o "passo 3.5" citados no fim referem-se ao protocolo global de skills, removido em 2026-11-04.

---

## 5. Roadmaps canônicos de referência (sanity-check antes de decisões técnicas)

> **Camada de referência complementar às skills.** Os 19 roadmaps de [roadmap.sh](https://roadmap.sh/) são mapas curados da literatura técnica que cobrem **o que existe, em que ordem aprender, e quais trade-offs cada escolha implica**. Skills dizem _como fazer_; roadmaps dizem _onde aquilo se encaixa no domínio inteiro_. Em decisões arquiteturais (Sprint, ADR, refactor) consultar o roadmap correspondente antes de propor.
>
> **Esta seção está duplicada (com versão project-agnostic) em `~/.claude/CLAUDE.md` para valer em qualquer projeto. Aqui contextualizamos para o stack Interpop.**

### Regra de uso (alinha com protocolo de skills)

1. Decisão de stack/framework/camada → consultar mentalmente o roadmap do domínio. Desvio do mainstream exige **justificativa explícita** para o usuário.
2. Antes de propor item de Sprint/backlog/ADR → checar se o item já é coberto pelo roadmap correspondente. Se sim, citar como lastro (`"alinha com roadmap.sh/backend → Caching"`).
3. Ao explicar área nova para o usuário → oferecer link do roadmap como leitura paralela, NUNCA substituir explicação imediata.

### Os 19 roadmaps — relevância para Interpop

#### Frontend (stack atual: React 19 + Vite + TS + React Router 7)

| Roadmap                                           | Relevância Interpop                                                                 | Skills primárias                                                        |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [react](https://roadmap.sh/react)                 | **Direto** — guia todos os refactors de hooks, perf, routing                        | `react-best-practices`, `react-patterns`, `react-component-performance` |
| [frontend](https://roadmap.sh/frontend)           | Direto — guia decisões de CSS, build, a11y, CWV                                     | `frontend-design`, `web-performance-optimization`                       |
| [typescript](https://roadmap.sh/typescript)       | Direto — narrow types, zod, openapi-typescript (F8, F9 do §11)                      | `typescript-expert`, `typescript-advanced-types`                        |
| [ux-design](https://roadmap.sh/ux-design)         | **Crítico para produto editorial** — leitura longa, jornada do leitor, mobile-first | `ux-flow`, `ux-audit`, `ecossistemas-ui-ux`                             |
| [design-system](https://roadmap.sh/design-system) | Direto — `src/styles/global.css` já é tokens; promover a `src/components/ui/` (F10) | `tailwind-design-system`, `radix-ui-design-system`                      |

#### Backend (stack atual: Django 5 + DRF + Postgres + uv)

| Roadmap                               | Relevância Interpop                                                          | Skills primárias                                             |
| ------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------ |
| [backend](https://roadmap.sh/backend) | **Direto** — APIs REST/versionamento, cache, scaling — guia ADR-010, A7, A18 | `backend-architect`, `api-design-principles`, `api-patterns` |
| [nodejs](https://roadmap.sh/nodejs)   | Indireto — só para tooling (Vite, husky, lint-staged)                        | `nodejs-best-practices`                                      |
| [python](https://roadmap.sh/python)   | Direto — guia uso de uv, async, packaging                                    | `python-pro`, `django-pro`, `django-perf-review`             |

#### Full-stack

| Roadmap                                     | Relevância Interpop                                                                                     | Skills primárias                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [full-stack](https://roadmap.sh/full-stack) | **Crítico** — contrato frontend↔backend (ADR-010 `/api/v1/`, A7 drf-spectacular, F9 openapi-typescript) | `senior-fullstack`, `frontend-api-integration-patterns` |

#### Arquitetura

| Roadmap                                                                         | Relevância Interpop                                                                                                           | Skills primárias                                                       |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [software-architect](https://roadmap.sh/software-architect)                     | **Direto** — ADRs já formalizadas no Improvement-system.md (14 ADRs ativos)                                                   | `architecture-patterns`, `software-architecture`                       |
| [software-design-architecture](https://roadmap.sh/software-design-architecture) | Direto — DDD para apps Django, candidato para CQRS quando AdminMetricsView crescer (B14)                                      | `ddd-strategic-design`, `ddd-tactical-patterns`, `cqrs-implementation` |
| [system-design](https://roadmap.sh/system-design)                               | Futuro próximo — capacity planning do HOSTING-DEPLOY usa pilares (load balancing, sharding via read replica B14, cache layer) | `cloud-architect`, `microservices-patterns`, `database-design`         |

#### DevOps & Infra (Hostinger KVM 1 + systemd + nginx + Postgres + Redis local)

| Roadmap                                     | Relevância Interpop                                                                                         | Skills primárias                                                                |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [devops](https://roadmap.sh/devops)         | **Crítico** — CI/CD GitHub Actions (S15-S17), IaC futura                                                    | `cloud-devops`, `cicd-automation-workflow-automate`, `github-actions-templates` |
| [docker](https://roadmap.sh/docker)         | **Futuro** — Interpop hoje roda nativo no VPS; Docker entra quando migrar para multi-host ou simplificar DR | `docker-expert`                                                                 |
| [kubernetes](https://roadmap.sh/kubernetes) | **Não relevante hoje** — KVM 1 não justifica K8s. Re-avaliar a partir de 100k MAU                           | `kubernetes-architect`                                                          |
| [linux](https://roadmap.sh/linux)           | **Direto** — todo hardening do HOSTING-DEPLOY (SSH, ufw, fail2ban, systemd) é Linux fundamentals            | `linux-troubleshooting`, `bash-pro`, `bash-defensive-patterns`                  |

#### Rede

| Roadmap                                                 | Relevância Interpop                                                 | Skills primárias                  |
| ------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------- |
| [network-engineer](https://roadmap.sh/network-engineer) | Médio — Cloudflare config (ADR-003), DNS, TLS 1.3, security headers | `network-engineer`, `network-101` |

#### Segurança (DevSecOps embedded — ADR-006)

| Roadmap                                             | Relevância Interpop                                | Skills primárias                                                                                                                                        |
| --------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [cyber-security](https://roadmap.sh/cyber-security) | **Crítico** — todo §5.5 + §11.6 derivam desse mapa | `security-auditor`, `cc-skill-security-review`, `pentest-checklist`, `ethical-hacking-methodology`, `threat-modeling-expert`, `top-web-vulnerabilities` |

#### IA & Dados

| Roadmap                                                   | Relevância Interpop                                                                                                                                      | Skills primárias                                      |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| [ai-data-scientist](https://roadmap.sh/ai-data-scientist) | **Médio prazo** — sem feature de IA hoje; potencial: classificação automática de tag, sugestão de relacionados (embeddings), sumarização para newsletter | `ai-engineer`, `rag-engineer`, `embedding-strategies` |

### Integração com o protocolo de skills

O protocolo da §2 ganha **passo 3.5**:

> **3.5** Se a tarefa toca domínio coberto por algum dos 19 roadmaps, mencionar mentalmente como sanity-check + oferecer link ao usuário quando ele indicar ser área nova pra ele.

Skills continuam sendo o _como_; roadmaps ancoram o _território_.
