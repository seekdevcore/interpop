# RNF-a11y — Acessibilidade

> **Tipo**: Requisito Não-Funcional (transversal)
> **Prioridade**: 🔴 Imediato (release gate hard)
> **Status**: ✅ Baseline AA atendido + 🚧 expansão E2E Sprint 5

---

## Enunciado

Sistema atende **WCAG 2.2 AA** em todas as superfícies públicas e privadas, garantindo que pessoas com deficiência visual, motora, auditiva ou cognitiva consigam usar o produto editorial inteiro (ler, comentar, curtir, buscar, navegar) com leitores de tela, navegação por teclado, alto contraste, e zoom até 200%.

### Métricas obrigatórias

| Métrica                 | Alvo                                                 | Como medir                                           |
| ----------------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| **AIM Score WAVE**      | ≥ 10/10 em página de entrega                         | WAVE Browser Extension                               |
| **axe-core violations** | 0 (zero) em estados estáveis                         | `vitest-axe` em CI + `axe-playwright` E2E (Sprint 5) |
| **Lighthouse a11y**     | ≥ 95 mobile e desktop                                | Lighthouse CI                                        |
| **Contraste WCAG AA**   | ≥ 4.5:1 texto normal, ≥ 3:1 texto grande             | Tokens validados (`global.css:60-75` documenta)      |
| **Navegação teclado**   | 100% das ações públicas                              | Manual + axe-playwright                              |
| **Leitor de tela**      | NVDA (Windows) + VoiceOver (macOS/iOS) sem dead-ends | Manual checklist por Sprint                          |

### Princípios operacionais

1. **Semantic HTML primeiro** — `<form role="search">`, `<button>`, `<dialog>`, `<time datetime>` antes de qualquer ARIA workaround ([ADR-028](../../specs/busca-editorial/adrs/ADR-028-input-type-search-rejeita-combobox.md))
2. **ARIA só quando necessário** — `role` redundante com semântica nativa é proibido (axe pega)
3. **Foco visível** — todos os elementos focáveis têm `:focus-visible` distinto
4. **Live regions** — `aria-live="polite"` para count/status; `aria-live="assertive"` apenas para erros
5. **Anti-CLS no design** — dimensões fixas para imagens + skeletons com dimensões idênticas ao conteúdo final

---

## Realizado por (rastreabilidade ↓)

| Epic / Feature                                                         | Como atende                                                                              |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Plataforma base                                                        | WAVE 10/10 baseline em todas as rotas pre-busca                                          |
| [EP-10 Busca → F-30](../../backlog/features/F-30-busca-texto-livre.md) | CA08 (axe nos 5 estados em light/dark/mobile/desktop) + CA09 (URL navegável por teclado) |
| [EP-10 Busca → F-31](../../backlog/features/F-31-filtros-busca.md)     | CA20 (mobile sheet acessível) + CA17 (popover navegável por teclado)                     |
| Todos Epics futuros                                                    | DEVEM passar Lighthouse a11y + axe-core antes de merge                                   |

---

## Estado atual (Fase 3 busca — Sprint 4)

- ✅ axe-core ativo via `vitest-axe@0.1.0` em `src/pages/Buscar/__tests__/a11y.test.tsx` cobrindo 12 cenários nos 5 estados (empty, loading, results, no-results, rate-limited, error) + componentes-chave (SearchInput, ResultCard com e sem cover, FilterChips com e sem filtros)
- ✅ Bug a11y real encontrado e corrigido na 1ª execução: `<ul role="status">` no Skeleton sobrescrevia `role="list"` implícito → `<div role="status">` wrapper com `<ul aria-hidden>` filho
- ✅ Tokens de contraste validados em light (9.4:1 / 7.2:1 highlight/chip) e dark (6.8:1 / 5.4:1)
- ⏳ NVDA + VoiceOver manual: TX-20 Sprint 5
- ⏳ axe-playwright E2E: TX-17 Sprint 5

---

## Cross-references

- Spec da skill: [`ui-ux-architect`](../../specs/busca-editorial/_specialist-outputs/04-ui-ux-architect.md) e [`ecossistemas-ui-ux`](../../../skills/ecossistemas-ui-ux/SKILL.md)
- ADR a11y: [ADR-045 axe-playwright + NVDA/VoiceOver](../../specs/busca-editorial/adrs/ADR-045-a11y-e2e-axe-playwright-manual-nvda-voiceover.md)
- ADR semântico: [ADR-028 input type=search](../../specs/busca-editorial/adrs/ADR-028-input-type-search-rejeita-combobox.md)
- Tokens canônicos: `src/styles/global.css`
