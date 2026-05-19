---
name: ecossistemas-ui-ux
description: Use when making any UI/UX design or audit decision (component, palette, typography, accessibility, performance, design system choice) — combines five reference ecosystem categories (galleries, design systems, audits, communities, technical analysis) before committing to a visual or interaction choice, ensuring designs are functional, accessible, and fast rather than purely aesthetic.
---

# Ecossistema de Referência — UI/UX

## When to invoke this skill

Invoke this skill **before** any of the following:

- Designing or redesigning a screen, component, or flow
- Choosing a color palette, typography scale, or spacing system
- Auditing an existing interface (accessibility, performance, usability)
- Comparing the current interface to industry leaders
- Picking a design system or component library
- Validating responsiveness, WCAG conformance, or Core Web Vitals

The principle: no single source covers everything. Combine sources — it is the only way to deliver *functional + accessible + fast*, not just visually pretty.

## The five categories (apply in order)

### 1. Galleries — visual inspiration

For trends, curated visual references, editorial style.

| Source | URL | Use |
|--------|-----|-----|
| Awwwards    | awwwards.com    | Expert-juried sites; filters by category + daily awards |
| Godly       | godly.website   | Niche curation; minimalist + strong typography |
| Siteinspire | siteinspire.com | Classic; filters by style, project type, color palette |

### 2. Design systems — big-tech patterns

For component standards, accessibility variants, design tokens.

| System | Use |
|--------|-----|
| Material Design (Google)             | Components, accessibility, spacing, responsiveness. Android base. |
| Apple Human Interface Guidelines     | iOS/macOS standard. Gesture/voice/keyboard interaction + native a11y. |
| Carbon (IBM) / Fluent (Microsoft)    | Design tokens, accessibility-variant components, open source. |

### 3. Audits — technical validation

For measurable performance, accessibility, and SEO scores.

| Tool | Use |
|------|-----|
| Google Lighthouse    | Chrome DevTools. Performance, a11y, SEO, best practices (0–100). |
| WebAIM / WAVE        | WCAG conformance. Contrast errors, structure, semantics. |
| PageSpeed Insights   | Online Lighthouse + field Core Web Vitals from real users. |

### 4. Communities — real-world inspiration

For UX patterns observed in real apps, not idealized mockups.

| Community         | Use |
|-------------------|-----|
| Mobbin            | mobbin.design — mobile/web UI of real apps (Airbnb, Notion, Figma) in real context. |
| Muzli             | Chrome extension — daily feed of best designs across sources. |
| Dribbble / Behance| Visual trends + emerging styles (aesthetic-first; not usability). |

### 5. Technical analysis — stack + code

For understanding implementation patterns behind admired sites.

| Tool                   | Use |
|------------------------|-----|
| CSS Stats              | cssstats.com — complexity, selectors, colors, fonts of any site. |
| a11y Project           | Accessibility checklist based on WCAG 2.1 + 2.2. |
| BuiltWith / Wappalyzer | Reveals stack, frameworks, libraries of any site. |

## Application flow (mandatory order)

1. **Inspire** — Awwwards or Godly for trends aligned to the project.
2. **Study patterns** — Material / Apple HIG for the *principles*, not just the aesthetics.
3. **Watch real apps** — Mobbin for how leaders solve UX in production (not mockups).
4. **Validate with metrics** — Lighthouse + WAVE on references *and* on the current product.
5. **Monitor technically** — CSS Stats + Wappalyzer for stack and implementation patterns.

Never skip step 4. Aesthetic choices that fail Lighthouse or WAVE are regressions, not improvements.

## Guiding principle

> Observe how leaders solve problems — do not copy aesthetics.
>
> Good design is **functional, accessible, and fast**. Audits make those qualities measurable instead of subjective.

## How to apply inside a task

When invoked (by the orchestration protocol or explicitly):

1. Identify *which* of the five categories applies to the current task.
2. Cite at least **two** sources from **different** categories — never rely on one.
3. Cross-check any visual choice against a measurable audit (Lighthouse score, WCAG conformance, Core Web Vitals).
4. Document the source in code comments only when the decision is non-obvious (e.g., "Following Apple HIG dialog dismissal pattern: tap-outside dismisses unless destructive").
5. If a choice fails an audit dimension, revisit step 1–2 with stricter constraints — never ship an aesthetic win that breaks measurable quality.

## References

- Full source: `docs/ecossistema_ui_ux_revisado.pdf` (Interpop repository).
- Project-specific application fluxo: `AGENTS.md` → section *Padrão `ecossistemas_ui_ux`*.
- Companion skill (when dashboards are involved): `referencias_dashboards` standard in the same AGENTS.md.
