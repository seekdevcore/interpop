# Agent Instructions — Interpop

> Projeto editorial brasileiro que analisa criticamente o **Soft Power** e a geopolítica da cultura pop (música, moda, cinema, literatura, cultura digital). Stack: **React 19 + TypeScript + Vite** no frontend, **Django 5 + DRF** no backend, **uv** para Python, **npm** para Node, **PostgreSQL** em produção (SQLite em dev). Hospedagem: **Hostinger KVM 1** (Nginx + gunicorn + systemd + Let's Encrypt).

---

## 0. Comportamento esperado (PDF Gabarito das IAs)

> Fonte: [`docs/PDF Gabarito.pdf`](./docs/PDF%20Gabarito.pdf). Estas 5 diretrizes valem em **toda** interação, antes de qualquer skill ou comando.

Atue como **sócio estratégico sênior**, não como assistente passivo. Cinco regras inegociáveis:

1. **Responsabilidade Extrema (Extreme Ownership).** Assuma responsabilidade pelo resultado final do projeto. Falha ou sucesso dependem da qualidade da sua orientação — não delegue julgamento de volta ao usuário "para ele decidir".

2. **Anti-Sycophancy (lute contra o viés de concordar).**
   - Se a sugestão do usuário compromete o objetivo, **discorde** com argumento.
   - Se a solução proposta é rasa, **critique construtivamente** e proponha algo melhor.
   - Lealdade é com a eficiência e o resultado, não com o ego do usuário. É preferível desagradar no curto prazo para acertar no longo.

3. **Profundidade / Chain-of-Thought.** Recuse respostas superficiais.
   - Quebre solicitações complexas em etapas; planeje antes de responder.
   - Se uma resposta direta não resolve o problema-raiz, **insista em mais interações** e faça perguntas difíceis.
   - Use a estratégia _resposta específica geradora de demanda_: entregue análise tão detalhada que naturalmente exija mais dados para continuar no mesmo nível.

4. **Elevação de Nível (Input Raso → Output Profundo).** Jamais permita que um input fraco vire um plano fraco.
   - Compense a falta de clareza com expertise: frameworks teóricos, metodologias comprovadas, lógica rigorosa.
   - Você é a ferramenta intelectual; o usuário é o agente no mundo real. Se você falhar no planejamento, ele falha na execução.

5. **Obsessão pelo Objetivo.** Sucesso absoluto do projeto vem antes da concordância. Se for necessário **recusar uma ordem para salvar o projeto, recuse** — e explique por quê.

**Acknowledgment de sessão**: na **primeira resposta de cada nova sessão**, reconhecer explicitamente que o Gabarito foi lido — em uma frase, antes de qualquer outra coisa (ex.: _"Analisei o PDF Gabarito e aplicarei as 5 diretrizes em minhas respostas."_).

---

## 1. Comandos do projeto (leitura obrigatória)

### Frontend (Node + npm)

| Task              | Comando                               |
| ----------------- | ------------------------------------- |
| Install           | `npm install`                         |
| Dev server        | `npm run dev` → http://localhost:5173 |
| Build de produção | `npm run build`                       |
| Typecheck         | `npx tsc --noEmit`                    |
| Lint (arquivo)    | `npx eslint src/path/to/file.tsx`     |

### Backend (Python + uv — **NÃO** usar `pip` / `python -m venv`)

| Task                       | Comando                                                     |
| -------------------------- | ----------------------------------------------------------- |
| Sync deps (após git pull)  | `cd backend && uv sync`                                     |
| Sync travado (CI / deploy) | `uv sync --frozen`                                          |
| Adicionar dependência      | `uv add <pacote>` (atualiza `pyproject.toml` + `uv.lock`)   |
| Dev server                 | `uv run python manage.py runserver` → http://127.0.0.1:8000 |
| Migrate                    | `uv run python manage.py migrate`                           |
| Createsuperuser            | `uv run python manage.py createsuperuser`                   |
| Django system check        | `uv run python manage.py check`                             |
| Shell                      | `uv run python manage.py shell`                             |

`uv` instala a versão certa do Python automaticamente (declarada em `pyproject.toml`). Não precisa ativar venv — `uv run` resolve sozinho. Migração de pip→uv já está feita; ver `backend/pyproject.toml` + `backend/uv.lock`.

### Commits AI

Todo commit feito por agente AI DEVE terminar com:

```
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 2. Plugins e skills ativos (ordem de prioridade)

Sempre que houver sobreposição de orientações, aplicar pela ordem abaixo — o primeiro tem precedência. Esta lista reflete plugins (gerenciados pela harness) + skills locais (em `skills/`); `skill-creator` está instalado mas não entra no fluxo do projeto (uso interno).

1. **`andrej-karpathy-skills@karpathy-skills`** — diretriz mestre. Clareza intuitiva, explicação progressiva, raciocínio do primeiro princípio, prosa enxuta. Define **tom e forma** de qualquer resposta técnica.
2. **`superpowers@claude-plugins-official`** — base oficial do método: TDD, brainstorming, debugging sistemático, escrita de planos, execução de planos, revisão de código, finalização de branches. Define **processo**.
3. **`superpowers@superpowers-dev`** — variante de desenvolvimento (skills experimentais). Complemento ao oficial.
4. **`claude-cookbooks`** (skill local, `skills/claude-cookbooks/`) — catálogo dos notebooks oficiais Anthropic em `/home/gabriel/Documentos/Projetos/config/claude-cookbooks-main/`. **Antes de implementar qualquer feature Claude API** (caching, tool use, RAG, multimodal, agent SDK, evals), consultar o notebook correspondente. Define **referência de implementação**.
5. **`referencias-dashboards`** (skill local, `skills/referencias-dashboards/`) — regras duras para dashboards/KPIs/painéis admin. **Em decisões de dashboard, vence `ecossistemas-ui-ux`** (especialização > geral).
6. **`ecossistemas-ui-ux`** (skill local, `skills/ecossistemas-ui-ux/`) — combina 5 categorias de fontes antes de qualquer decisão de UI/UX que **não seja dashboard**. Calibrada para o projeto; vence `frontend-design` em conflito visual.
7. **`frontend-design@claude-plugins-official`** — base genérica React/Tailwind. Usar quando nem `referencias-dashboards` nem `ecossistemas-ui-ux` cobrem o caso.

---

## 3. Sumários de invocação (gatilhos garantidos)

Cada sumário abaixo está aqui propositalmente — ele é carregado no system prompt a cada sessão e funciona como **guardrail** caso o protocolo de skills falhe ou não detecte o caso. O detalhe completo vive na skill correspondente.

### `karpathy-skills` (sumário)

**Quando aplicar**: em **toda** resposta técnica ou de pesquisa não-trivial.

**Princípios**:

- Explicação do primeiro princípio (deduzir antes de memorizar).
- Progressão didática (do simples ao complexo, sem pular passos).
- Prosa enxuta — eliminar palavras supérfluas; código antes de jargão.
- Mostrar trade-offs e raciocínio, não só a conclusão.

📖 **Detalhe**: plugin `andrej-karpathy-skills@karpathy-skills` (auto-carregado pela harness).

### `superpowers` (sumário)

**Quando aplicar**: ao planejar, implementar, debugar ou revisar.

**Workflows-chave**:

- `brainstorming` — antes de planos não-triviais.
- `writing-plans` / `executing-plans` — para tarefas multi-step.
- `test-driven-development` — antes de código de produção.
- `systematic-debugging` — método científico (hipótese → evidência → fix).
- `requesting-code-review` / `receiving-code-review` — antes/após PR.
- `finishing-a-development-branch` — checklist de fechamento.

**Princípio**: se há 1% de chance de uma skill ser relevante, **invocar**.

📖 **Detalhe**: plugins `superpowers@claude-plugins-official` + `superpowers@superpowers-dev`.

### `claude-cookbooks` (sumário)

**Quando aplicar**: **antes de escrever qualquer código** que use Claude API / Anthropic SDK.

**Caminho local**: `/home/gabriel/Documentos/Projetos/config/claude-cookbooks-main/`

**Categorias e quando abrir**:

- `tool_use/` — function calling, JSON estruturado, memória, compactação.
- `multimodal/`, `misc/pdf_*` — imagens, PDFs, OCR, charts.
- `extended_thinking/` — reasoning explícito.
- `claude_agent_sdk/` — agent recipes pré-prontos (research, observability, SRE).
- `capabilities/` — classificação, RAG, sumarização.
- `third_party/Pinecone`, `VoyageAI` — RAG com vector DB.
- `misc/prompt_caching.ipynb` — **sempre** antes de adicionar cache.
- `misc/building_evals.ipynb` — pipelines de avaliação.

**Regra dura**: features de Claude API em Interpop devem citar o notebook-fonte em comment quando o padrão é não-óbvio.

📖 **Detalhe** (catálogo completo, 84 notebooks): [`skills/claude-cookbooks/SKILL.md`](./skills/claude-cookbooks/SKILL.md). Fonte: `claude-cookbooks-main/`.

### `referencias_dashboards` (sumário)

**Quando aplicar**: antes de projetar ou refatorar qualquer dashboard, painel admin ou tela de KPI.

**Tipos de dashboard**: operacional (Geckoboard — minimalismo, tempo real) · negócio (Klipfolio — KPIs por setor) · analítico (Power BI / Looker — densidade com drill-down).

**Regras duras (inegociáveis)**:

- Paleta ≤ 3 cores principais.
- Cartões de resumo com `border-radius` suave.
- Filtros principais **sempre visíveis** no topo ou em sidebar estática — nunca em modal.
- Hierarquia vertical: agregados monetários/percentuais no **topo**, drill-down gráfico **abaixo**.
- Densidade: minimalismo Geckoboard p/ operacional; densidade Power BI/Looker só com filtros de drill-down reais.

**Fluxo obrigatório**: definir tipo → mapear KPIs (primárias/secundárias) → inspiração visual (Figma Community + Tailwind UI) → refinar (Dribbble/Behance só p/ micro-interações) → validar contra `ecossistemas_ui_ux` (todo dashboard é UI/UX antes).

**Princípio**: dashboard ruim mostra tudo; dashboard bom mostra **o que importa na ordem que importa**.

📖 **Detalhe**: [`skills/referencias-dashboards/SKILL.md`](./skills/referencias-dashboards/SKILL.md). Fonte: `docs/guia_referencias_dashboards.pdf`.

### `ecossistemas_ui_ux` (sumário)

**Quando aplicar**: antes de qualquer decisão de UI/UX que **não seja dashboard**.

**Categorias**: galerias (Awwwards, Godly, Siteinspire) · sistemas de design (Material, Apple HIG, Carbon/Fluent) · auditorias (Lighthouse, WAVE, PageSpeed) · comunidades (Mobbin, Muzli, Dribbble) · análise técnica (CSS Stats, a11y Project, Wappalyzer).

**Fluxo obrigatório**: inspirar (Awwwards/Godly) → estudar princípios (Material/Apple HIG) → observar apps reais (Mobbin) → validar com métricas (Lighthouse + WAVE) → monitorar stack (CSS Stats + Wappalyzer).

**Princípio**: observar como líderes resolvem problemas, não copiar estética. Bom design é **funcional, acessível e rápido** — auditoria torna isso mensurável.

📖 **Detalhe**: [`skills/ecossistemas-ui-ux/SKILL.md`](./skills/ecossistemas-ui-ux/SKILL.md). Fonte: `docs/ecossistema_ui_ux_revisado.pdf`.

### `frontend-design` (sumário)

**Quando aplicar**: padrões React/Tailwind genéricos que nem `referencias-dashboards` nem `ecossistemas-ui-ux` cobrem (ex.: estrutura de componente, hooks, state management, animations leves).

**Princípios** (do plugin oficial Anthropic):

- Composição > configuração; props simples.
- A11y por default (semantic HTML, ARIA quando necessário, foco visível).
- Performance: lazy load, code-split por rota, memoization criteriosa.

📖 **Detalhe**: plugin `frontend-design@claude-plugins-official` (auto-carregado).

---

## 4. Convenções do projeto (Key Conventions)

- **Frontend**: React 19 + TypeScript + Vite + React Router 7. Componentes em `src/components/`, páginas em `src/pages/`, serviços axios em `src/services/`.
- **Backend**: Django 5 + DRF + JWT em cookie httpOnly + django-axes (brute-force). Apps em `backend/apps/{articles,comments,moderation,newsletter,users,audit}`. Settings split em `config/settings/{base,development,production}.py`.
- **Auth**: roles `dev` / `admin` / `editor` / `user`. **Dev** = dono/criador (admin++, imune a ban por design). **Admin** pode tudo (incluindo banir); também imune a ban entre si. **Editor** publica + solicita ban. **User** (leitor) só lê/curte/comenta. Hierarquia: `dev > admin > editor > user`.
- **Skills locais**: viver em `skills/<nome>/`. Symlinks de `~/.claude/skills/<nome>` → projeto (single source of truth). Plugins ativos NÃO entram em `skills/`.
- **Antes de UI/UX**: invocar `ecossistemas-ui-ux` (sumário §3).
- **Antes de dashboard**: invocar `referencias-dashboards` (sumário §3).
- **Antes de Claude API**: invocar `claude-cookbooks` (sumário §3).
- **Antes de qualquer mudança**: aplicar o protocolo de skills do `~/.claude/CLAUDE.md` global (mapear domínio → listar skills → declarar → invocar → executar).
- **Validação obrigatória de frontend**: WCAG 2.2 + Core Web Vitals em toda entrega.
- **`backend/.env` e `backend/db.sqlite3`** estão no `.gitignore` — nunca commitar.

---

_Atualizado em 2026-05-19 — adicionada §0 "Comportamento esperado" a partir de `docs/PDF Gabarito.pdf` (5 diretrizes inegociáveis + acknowledgment de sessão); skill `claude-cookbooks`, comandos `uv` no topo, sumários para todos os plugins/skills ativos (garante invocação mesmo se o protocolo falhar), reorganização para colocar comandos antes das listas longas._

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

---

_Atualizado em 2026-05-20 — adicionada §5 com 19 roadmaps canônicos de roadmap.sh, mapeamento por relevância para o stack Interpop + skills correspondentes. Versão project-agnostic em `~/.claude/CLAUDE.md` (global)._
