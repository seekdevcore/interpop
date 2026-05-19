# Agent Instructions — Interpop

## Plugins ativos (ordem de prioridade)

Sempre que houver sobreposição de orientações, aplicar pela ordem abaixo — o primeiro tem precedência. Esta lista reflete plugins e skills locais instalados e ativados na harness; `skill-creator` está instalado mas não entra no fluxo do projeto Interpop (uso interno apenas, não citar).

1. **`andrej-karpathy-skills@karpathy-skills`** — diretriz mestre. Clareza intuitiva, explicação progressiva, raciocínio do primeiro princípio, prosa enxuta. Define o **tom e a forma** de qualquer resposta técnica ou de pesquisa.
2. **`superpowers@claude-plugins-official`** — base oficial do método: TDD, brainstorming, debugging sistemático, escrita de planos, execução de planos, revisão de código, finalização de branches. Define o **processo**.
3. **`superpowers@superpowers-dev`** — variante de desenvolvimento do superpowers (skills mais recentes/experimentais). Usar como **complemento** ao oficial quando aplicável.
4. **`referencias-dashboards`** (skill local, `skills/referencias-dashboards/`) — derivada do PDF `docs/guia_referencias_dashboards.pdf`. Classifica qualquer painel em operacional (Geckoboard), de negócio (Klipfolio) ou analítico (Power BI / Looker) e impõe regras duras: paleta ≤3 cores, cantos arredondados suaves, filtros sempre visíveis, agregados monetários/percentuais no topo. **Em decisões de dashboard, vence o `ecossistemas-ui-ux`** (especialização > geral).
5. **`ecossistemas-ui-ux`** (skill local, `skills/ecossistemas-ui-ux/`) — derivada do PDF `docs/ecossistema_ui_ux_revisado.pdf` do próprio projeto. Combina 5 categorias de fontes (galerias, sistemas de design, auditorias, comunidades, análise técnica) antes de qualquer decisão de UI/UX no Interpop que **não seja dashboard**. Por ser calibrada para o projeto, vence o `frontend-design` em conflito de orientação visual.
6. **`frontend-design@claude-plugins-official`** — especialização genérica de frontend (padrões visuais, componentização React). Base mais ampla; serve como referência quando nem `referencias-dashboards` nem `ecossistemas-ui-ux` cobrem o caso (ex.: padrões puramente de implementação React/Tailwind).

## Package Manager
Use **npm**: `npm install`, `npm run dev`, `npm run build`, `npm run lint`

## File-Scoped Commands
| Task | Command |
|------|---------|
| Typecheck | `npx tsc --noEmit` |
| Lint | `npx eslint src/path/to/file.tsx` |
| Build | `npm run build` |
| Dev server | `npm run dev` |

## Commit Attribution
AI commits MUST include:
```
Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

## Padrão `ecossistemas_ui_ux` (sumário)

Antes de qualquer decisão de UI/UX que **não seja dashboard**, combinar fontes das 5 categorias — nenhuma cobre tudo.

**Categorias**: galerias (Awwwards, Godly, Siteinspire) · sistemas de design (Material, Apple HIG, Carbon/Fluent) · auditorias (Lighthouse, WAVE, PageSpeed) · comunidades (Mobbin, Muzli, Dribbble) · análise técnica (CSS Stats, a11y Project, Wappalyzer).

**Fluxo obrigatório**: inspirar (Awwwards/Godly) → estudar princípios (Material/Apple HIG) → observar apps reais (Mobbin) → validar com métricas (Lighthouse + WAVE) → monitorar stack (CSS Stats + Wappalyzer).

**Princípio**: observar como líderes resolvem problemas, não copiar estética. Bom design é **funcional, acessível e rápido** — auditoria torna isso mensurável.

📖 **Detalhe completo (tabelas de fontes, exemplos, justificativas):** [`skills/ecossistemas-ui-ux/SKILL.md`](./skills/ecossistemas-ui-ux/SKILL.md). Fonte original: `docs/ecossistema_ui_ux_revisado.pdf`.

## Padrão `referencias_dashboards` (sumário)

Antes de projetar ou refatorar qualquer dashboard, classificar o tipo e cruzar fontes das 3 categorias.

**Tipos de dashboard**: operacional (Geckoboard — minimalismo, tempo real) · negócio (Klipfolio — KPIs por setor) · analítico (Power BI / Looker — densidade com drill-down).

**Regras duras (inegociáveis)**:
- Paleta ≤ 3 cores principais.
- Cartões de resumo com `border-radius` suave.
- Filtros principais **sempre visíveis** no topo ou em sidebar estática — nunca em modal.
- Hierarquia vertical: agregados monetários/percentuais no **topo**, drill-down gráfico **abaixo**.
- Densidade: minimalismo Geckoboard p/ operacional; densidade Power BI/Looker só com filtros de drill-down reais.

**Fluxo obrigatório**: definir tipo → mapear KPIs (primárias/secundárias) → inspiração visual (Figma Community + Tailwind UI) → refinar (Dribbble/Behance só p/ micro-interações) → validar contra `ecossistemas_ui_ux` (todo dashboard é UI/UX antes).

**Princípio**: dashboard ruim mostra tudo; dashboard bom mostra **o que importa na ordem que importa**.

📖 **Detalhe completo (tabelas de fontes, exemplos por categoria, casos práticos):** [`skills/referencias-dashboards/SKILL.md`](./skills/referencias-dashboards/SKILL.md). Fonte original: `docs/guia_referencias_dashboards.pdf`.

## Key Conventions
- Stack: React 19 + TypeScript + Vite + React Router 7
- Backend separado em `backend/`
- Antes de qualquer mudança de UI/UX: invocar a skill `ecossistemas-ui-ux` (sumário acima)
- Antes de projetar ou refatorar dashboard: invocar a skill `referencias-dashboards` (sumário acima)
- Validar acessibilidade (WCAG 2.2) e Core Web Vitals em toda entrega de frontend
