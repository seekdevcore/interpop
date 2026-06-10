# F-31 — Filtros (autor, editoria, intervalo de datas)

> **Tipo**: Feature
> **Epic pai**: [EP-10 Busca editorial](../epics/EP-10-busca-editorial.md)
> **Sprint de execução**: [Sprint 5](../sprints/sprint-5-filtros-deep-linking.md)
> **Status**: ⏳ Pending (Sprint 5)
> **Prioridade**: 🟠 Alta

---

## Descrição (visão de produto)

Em cima da busca por texto livre (F-30), leitor pode refinar resultados por **autor**, **editoria** e **intervalo de datas de publicação**. Filtros são exibidos como chips removíveis abaixo do campo de busca. No mobile, abrem em uma folha (sheet) que respeita o teclado virtual.

Esta Feature **estende** F-30 — não a substitui. A shell `<FilterChips>` já foi entregue vazia no Sprint 4; aqui plugamos popovers funcionais.

---

## Requisitos atendidos (rastreabilidade ↑)

| ID                                                                 | Requisito                                                                            | Relação             |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------- |
| [RF-007](../../requirements/RF/RF-007-busca-editorial.md) §filtros | Busca aceita filtros opcionais que reduzem o conjunto resultante                     | Realiza diretamente |
| [RNF-perf](../../requirements/RNF/RNF-perf.md)                     | p95 ≤ 300ms mesmo com filtros (composite indexes parciais já presentes — ADR-030-DB) | Mantém              |
| [RNF-a11y](../../requirements/RNF/RNF-a11y.md)                     | Popover/sheet acessível por teclado; chips com `aria-pressed`                        | Estende             |

---

## Critérios de Aceitação (CAs — escopo Sprint 5)

| ID       | Critério                                                                                  | Como verificar                                        | Status |
| -------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------ |
| **CA16** | Autor selecionável por popover com search-as-you-type (lista paginada)                    | Test integração FilterAuthor                          | ⏳     |
| **CA17** | Editoria selecionável por dropdown com as 5 categorias canônicas + ícones                 | Test FilterCategory                                   | ⏳     |
| **CA18** | Intervalo de datas selecionável por dois date-pickers (de/até) com validação              | Test FilterDateRange + FormValidation                 | ⏳     |
| **CA19** | Chip de cada filtro ativo aparece com botão "remover" (`×`)                               | Test FilterChips (extensão de chip vazio do Sprint 4) | ⏳     |
| **CA20** | Mobile (≤ 640px) abre filtros em `<dialog>` HTML respeitando `dvh` + safe-area + keyboard | Test responsive + manual iOS/Android                  | ⏳     |
| **CA21** | Limpar todos os filtros com 1 clique mantém o termo `q`                                   | Test FilterChips clear-all                            | ⏳     |

---

## User Stories (rascunho — refinar no kickoff do Sprint 5)

### US31.1 — Leitor filtra busca por autor

> **Como** leitor
> **Quero** ver apenas artigos de uma autora específica
> **Para** ler trabalhos da curadora que sigo.

- **Prioridade**: 🟠 Alta
- **CAs cobertos**: CA16, CA19, CA21
- **Status**: ⏳ Pending Sprint 5

### US31.2 — Leitor filtra busca por editoria

> **Como** leitor
> **Quero** restringir a busca à editoria "Música" (ou outra)
> **Para** explorar apenas conteúdo daquela seção.

- **Prioridade**: 🟠 Alta
- **CAs cobertos**: CA17, CA19, CA21
- **Status**: ⏳ Pending Sprint 5

### US31.3 — Leitor filtra busca por intervalo de datas

> **Como** leitor
> **Quero** ver artigos publicados entre duas datas
> **Para** revisitar análise editorial de um período específico.

- **Prioridade**: 🟡 Normal
- **CAs cobertos**: CA18, CA19, CA21
- **Status**: ⏳ Pending Sprint 5

### US31.4 — Leitor usa filtros em mobile sem fricção

> **Como** leitor em smartphone
> **Quero** abrir os filtros sem que o teclado quebre o layout
> **Para** filtrar buscas em qualquer dispositivo.

- **Prioridade**: 🟠 Alta
- **CAs cobertos**: CA20
- **Status**: ⏳ Pending Sprint 5

> **Cenários BDD detalhados serão escritos no kickoff do Sprint 5**, alinhados ao mockup final do popover/sheet.

---

## Tasks previstas (alocação Sprint 5 — refinar antes do start)

| ID    | Descrição                                                                                                             | Prioridade |
| ----- | --------------------------------------------------------------------------------------------------------------------- | ---------- |
| T31.1 | Backend — endpoint aceita combinação `q + author + category + de/ate` (já parcialmente implementado em SearchService) | 🟠         |
| T31.2 | `<FilterAuthor>` popover com lookup + search-as-you-type (axios search autores)                                       | 🟠         |
| T31.3 | `<FilterCategory>` dropdown com 5 categorias hardcoded (depois service)                                               | 🟠         |
| T31.4 | `<FilterDateRange>` com date-pickers nativos `<input type="date">` + validação                                        | 🟡         |
| T31.5 | Mobile `<dialog>` HTML sheet com dvh + safe-area + close-on-input-focus                                               | 🟠         |
| T31.6 | Tests integração combinando filtros (Hypothesis combinatorial)                                                        | 🟡         |
| T31.7 | A11y E2E axe-playwright com filtros ativos                                                                            | 🟠         |

---

## Specs técnicas relacionadas

- Backend já preparado: `SearchQuerySerializer` aceita filtros, `SearchService.query()` aplica WHERE condicional (ver `apps/search/services.py:240-247`)
- Composite indexes parciais `(author_id, published_at DESC)` + `(category_id, published_at DESC)` já criados na migration 0002 ([ADR-030-DB](../../specs/busca-editorial/adrs/ADR-030-DB-composite-indexes-parciais-covering.md))
- Tokens UI: `--clr-chip-bg`, `--clr-chip-on` (ADR-030-UI), `radius-md`, mobile `<dialog>` patterns (ui-ux-architect specialist output)

---

## Cross-references resumidas

| Direção                    | Onde                                                                                                                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ↑ Requisitos atendidos     | [RF-007 §filtros](../../requirements/RF/RF-007-busca-editorial.md), [RNF-perf](../../requirements/RNF/RNF-perf.md), [RNF-a11y](../../requirements/RNF/RNF-a11y.md)                        |
| ↑ Epic pai                 | [EP-10](../epics/EP-10-busca-editorial.md)                                                                                                                                                |
| → Sprint(s)                | [Sprint 5](../sprints/sprint-5-filtros-deep-linking.md)                                                                                                                                   |
| → Specs técnicas           | [DESIGN.md v3 §2.6 mobile dialog](../../specs/busca-editorial/DESIGN.md) + ADRs 030-UI, 030-DB                                                                                            |
| ← Features irmãs sob EP-10 | [F-30 Texto livre](F-30-busca-texto-livre.md) (dependência hard), [F-32 Deep-linking](F-32-deep-linking-busca.md) (dependência soft — deep-linking precisa de filtros para fazer sentido) |

---

_Pending — kickoff previsto Sprint 5._
