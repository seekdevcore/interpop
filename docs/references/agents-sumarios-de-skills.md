# Sumários de invocação das skills (referência)

> Movido do `AGENTS.md` em 2026-11-04 (era a §3). Texto original, sem reescrita.
>
> **Contexto da mudança**: esta seção era carregada em toda sessão como reforço do protocolo global de skills (regra do 1%, declaração "Skills aplicadas", canário), removido do `~/.claude/CLAUDE.md` em 2026-11-04. A regra atual é carregar uma skill só quando ela muda o resultado (normalmente 0–2 por tarefa). O "Princípio" do 1% no sumário de `superpowers` abaixo fica registrado como histórico e não vale mais.
>
> **Nota**: `superpowers@superpowers-dev`, citado no sumário de `superpowers`, foi desativado em 2026-11-04 (ver `AGENTS.md` §2, item 3). A ordem de precedência entre as skills continua na §2 do `AGENTS.md`. Caminhos relativos no texto abaixo (`./...`) partem da raiz do repositório.

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

**Caminho local**: `/home/gabriel/Documentos/Projetos/claude-cookbooks-main/`

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

📖 **Detalhe**: [`skills/referencias-dashboards/SKILL.md`](./skills/referencias-dashboards/SKILL.md). Fonte: `docs/references/guia_referencias_dashboards.pdf`.

### `ecossistemas_ui_ux` (sumário)

**Quando aplicar**: antes de qualquer decisão de UI/UX que **não seja dashboard**.

**Categorias**: galerias (Awwwards, Godly, Siteinspire) · sistemas de design (Material, Apple HIG, Carbon/Fluent) · auditorias (Lighthouse, WAVE, PageSpeed) · comunidades (Mobbin, Muzli, Dribbble) · análise técnica (CSS Stats, a11y Project, Wappalyzer).

**Fluxo obrigatório**: inspirar (Awwwards/Godly) → estudar princípios (Material/Apple HIG) → observar apps reais (Mobbin) → validar com métricas (Lighthouse + WAVE) → monitorar stack (CSS Stats + Wappalyzer).

**Princípio**: observar como líderes resolvem problemas, não copiar estética. Bom design é **funcional, acessível e rápido** — auditoria torna isso mensurável.

📖 **Detalhe**: [`skills/ecossistemas-ui-ux/SKILL.md`](./skills/ecossistemas-ui-ux/SKILL.md). Fonte: `docs/references/ecossistema_ui_ux_revisado.pdf`.

### `frontend-design` (sumário)

**Quando aplicar**: padrões React/Tailwind genéricos que nem `referencias-dashboards` nem `ecossistemas-ui-ux` cobrem (ex.: estrutura de componente, hooks, state management, animations leves).

**Princípios** (do plugin oficial Anthropic):

- Composição > configuração; props simples.
- A11y por default (semantic HTML, ARIA quando necessário, foco visível).
- Performance: lazy load, code-split por rota, memoization criteriosa.

📖 **Detalhe**: plugin `frontend-design@claude-plugins-official` (auto-carregado).

---

## Linha retirada da §4 (Convenções) em 2026-11-04

Apontava para o protocolo global de skills removido em 2026-11-04 (mapear domínio → listar skills → declarar → invocar → executar). Guardada aqui como histórico:

- **Antes de qualquer mudança**: aplicar o protocolo de skills do `~/.claude/CLAUDE.md` global (mapear domínio → listar skills → declarar → invocar → executar).
