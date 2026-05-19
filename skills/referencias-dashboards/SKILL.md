---
name: referencias-dashboards
description: Use when designing, refactoring, or auditing any dashboard, KPI panel, or admin metrics screen — distinguishes operational (Geckoboard), business (Klipfolio), and analytical (Power BI / Looker) dashboards, sources visual references per category (Figma Community, Tailwind UI, Dribbble), and enforces hard rules: ≤3-color palette, soft border-radius cards, filters always visible at top or in a static sidebar, vertical hierarchy with aggregates first.
---

# Referências de Dashboards — Profissionais

## When to invoke this skill

Invoke this skill **before** any of the following:

- Designing or refactoring a dashboard, admin panel, or KPI screen
- Choosing layout, hierarchy, palette, or component density for a metrics view
- Selecting chart types (bar, line, area, gauge, ranking) for a KPI
- Comparing the dashboard against industry references (operational, business, BI)
- Auditing an existing dashboard for clarity, density, or filter discoverability

This skill complements `ecossistemas-ui-ux`: every dashboard is UI/UX before it is a dashboard. For visual decisions that are *not* dashboard-specific, defer to `ecossistemas-ui-ux`. For dashboard-specific decisions, **this skill has precedence**.

## The three categories (decide the dashboard *type* first)

Before sourcing references, classify the dashboard into exactly one of three buckets — each maps to a different design philosophy.

### 1. UI/UX and componentization

Use when the priority is **visual structure, responsiveness, palette, and reusable components** in a modern framework (React/Tailwind/Vue).

| Source | Use |
|--------|-----|
| Figma Community | Search "CRM Dashboard", "SaaS Analytics". Measure exact spacing, export SVG icons, extract typography and color palettes ready for code. |
| Tailwind UI + community Tailwind components | Clean HTML, modern grids, collapsible sidebars, complex tables with pagination. Accelerates full-stack work while keeping responsiveness. |
| Dribbble / Behance | Cutting-edge visual trends (micro-interactions, glassmorphism, floating cards). Use to break the monotony of admin layouts. |

### 2. Business metrics and sector KPIs

Use when the priority is **deciding what data to show**, summarizing complex operations into primary vs secondary cards, and choosing the right chart for each scenario.

| Source | Use |
|--------|-----|
| Klipfolio Dashboard Examples Gallery | Sector-segmented panels (Sales, Executive, Marketing, Finance). Teaches data crossing (conversion rates, MoM growth, CAC). **Architecture rule:** monetary/percentage aggregates at the top, graphic detail below. |
| Geckoboard Examples | Real-time operational screens. Minimalist philosophy — focus on what demands immediate action. Reference for *avoiding* information overload. |

### 3. Business intelligence and dense data analysis

Use when there is **massive data volume**, advanced filters, dynamic segmentation, and corporate-level reporting density.

| Source | Use |
|--------|-----|
| Power BI Data Stories Gallery | Senior-analyst reports: supply chains, regional demographics, fiscal consolidations. Use for complex multi-source data flows. |
| Looker Studio Template Gallery | Direct integration with web/ad APIs: conversion funnels, click behavior, campaign performance. Use for marketing/web BI. |

## Hard rules (non-negotiable technical standards)

These constraints come from the dashboards guide and align with the Interpop project's `Padrão referencias_dashboards` standard in `AGENTS.md`:

1. **Palette**: maximum 3 main colors (visual-noise budget). Status colors (success/warning/error) count separately but stay restrained.
2. **Summary cards**: grouped with a soft `border-radius` (lightly rounded corners — not pill, not sharp).
3. **Main filters**: ALWAYS visible at the top of the page OR in a static sidebar. **Never hidden in modals.**
4. **Vertical hierarchy**: monetary/percentage aggregates at the **top**; graphic drill-down **below**. (Klipfolio rule, reinforced in `AGENTS.md`.)
5. **Density discipline**:
   - Operational panel (real-time monitoring) → Geckoboard minimalism — show only what demands action.
   - Business panel (decision support) → Klipfolio density — primary cards + secondary breakdowns.
   - Analytical panel (BI / drill-down) → Power BI / Looker density acceptable **only if filters enable real drill-down**.

## Application flow (mandatory order)

1. **Define the dashboard type** — Operational (Geckoboard), Business (Klipfolio), or Analytical (Power BI / Looker)?
2. **Map the KPIs** — list primary metrics (top) and secondary metrics (below) *before* drawing any pixel.
3. **Source visual inspiration** — Figma Community + Tailwind UI for layout and componentization of the chosen type.
4. **Refine the aesthetics** — Dribbble / Behance only for micro-interactions and finishing details.
5. **Validate against `ecossistemas-ui-ux`** — Lighthouse + WAVE + Mobbin. Every dashboard is UI/UX before it is a dashboard.

Never skip step 5. A dashboard that ranks well on Klipfolio but fails Lighthouse / WCAG is a regression.

## Guiding principle

> A bad dashboard shows everything. A good dashboard shows **what matters in the order that matters**.
>
> Vertical hierarchy, restricted palette, and always-visible filters are non-negotiable.

## How to apply inside a task

When invoked (by the orchestration protocol or explicitly):

1. State which of the three types the dashboard is (operational / business / analytical).
2. Map the KPIs into primary (top cards) vs secondary (below) before any visual choice.
3. Cite at least **one** source from category 1 (UI/UX) **and** one from category 2 (KPIs) — never inspire from a single category.
4. Check the four hard rules (palette ≤3, soft radius, filters visible, aggregates on top) before committing the design.
5. After draft, validate accessibility and performance via `ecossistemas-ui-ux` (Lighthouse + WAVE).
6. If a constraint is violated for aesthetic reasons, revert — the rules win.

## References

- Full source: `docs/guia_referencias_dashboards.pdf` (Interpop repository).
- Project-specific application fluxo: `AGENTS.md` → section *Padrão `referencias_dashboards`*.
- Sibling skill (broader UI/UX context): `ecossistemas-ui-ux`.
