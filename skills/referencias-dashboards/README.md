# referencias-dashboards

A Claude Code skill that classifies any dashboard task into one of three types (operational, business, analytical) and sources visual and architectural references per type, enforcing four hard rules: ≤3-color palette, soft border-radius cards, always-visible filters, and vertical hierarchy with aggregates on top.

## When it triggers

Any task involving a dashboard, admin metrics screen, KPI panel, BI report, real-time monitoring view, or comparison of an existing dashboard against industry references.

## What it provides

- Three-type classification (operational / business / analytical) — drives which references to consult.
- Curated references per type — Figma Community, Tailwind UI, Klipfolio, Geckoboard, Power BI, Looker Studio.
- Four non-negotiable technical rules from the source guide.
- Mandatory five-step application flow: define type → map KPIs → inspire → refine → validate.
- Hard validation step against `ecossistemas-ui-ux` (Lighthouse + WAVE).

## Origin

Derived from `docs/guia_referencias_dashboards.pdf` of the Interpop editorial project. The Klipfolio rule (aggregates on top, drill-down below) and Geckoboard rule (minimalism for real-time) are quoted directly from that guide and are project standards.

## Installation

Source lives at `~/.claude/skills/referencias-dashboards/`. No symlink needed — already inside the global skills root that Claude Code scans on startup.

## Usage

Inside Claude Code, the skill is auto-discovered when a dashboard task is detected. To force invocation, reference the skill name explicitly in the prompt (e.g., "apply `referencias-dashboards`") or invoke via the Skill tool.

## Relationship to `ecossistemas-ui-ux`

`referencias-dashboards` is the **specialization** for dashboards; `ecossistemas-ui-ux` is the broader UI/UX standard. In a dashboard task, this skill takes precedence on layout, hierarchy, palette discipline, and filter visibility. Validation of accessibility and performance still goes through `ecossistemas-ui-ux`.

## Related plugins

- `frontend-design@claude-plugins-official` — generic React/Tailwind component patterns; consult when this skill does not cover the specific implementation detail.
- `superpowers@claude-plugins-official` — process discipline (review, debug, TDD).
