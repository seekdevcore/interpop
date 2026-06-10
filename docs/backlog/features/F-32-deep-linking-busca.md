# F-32 — Deep-linking + compartilhamento da busca

> **Tipo**: Feature
> **Epic pai**: [EP-10 Busca editorial](../epics/EP-10-busca-editorial.md)
> **Sprint de execução**: [Sprint 5](../sprints/sprint-5-filtros-deep-linking.md)
> **Status**: ⏳ Pending (Sprint 5)
> **Prioridade**: 🟡 Normal

---

## Descrição (visão de produto)

Leitor pode copiar a URL da busca atual e enviar para outra pessoa — ela abre exatamente o mesmo estado (termo + filtros + página de paginação). Botão "Compartilhar" oferece atalho Web Share API em mobile, fallback cópia para clipboard em desktop. URL canonicalizada (ordem de params estável) para evitar fragmentação de cache.

URL como SSOT (single source of truth) já está implementada em F-30 para `?q=`. Esta Feature **completa** isso para filtros + paginação + adiciona compartilhamento explícito.

---

## Requisitos atendidos (rastreabilidade ↑)

| ID                                                                   | Requisito                                                       | Relação             |
| -------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------- |
| [RF-007](../../requirements/RF/RF-007-busca-editorial.md) §deep-link | Estado da busca é serializado em URL navegável e compartilhável | Realiza diretamente |
| [RNF-a11y](../../requirements/RNF/RNF-a11y.md)                       | Botão compartilhar acessível por teclado + label clara          | Estende             |
| [RNF-security](../../requirements/RNF/RNF-security.md)               | Cursor de paginação na URL é HMAC-assinado, não exposto plain   | Mantém              |

---

## Critérios de Aceitação (CAs — escopo Sprint 5)

| ID       | Critério                                                                                                | Como verificar                              | Status |
| -------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------ |
| **CA22** | URL contém todos os filtros ativos em ordem canônica (`?q=X&author=Y&category=Z&de=A&ate=B&cursor=...`) | Test `useSearchParamsState canonical order` | ⏳     |
| **CA23** | Copiar/colar URL em outra aba abre busca no mesmo estado                                                | Test E2E Playwright multi-tab               | ⏳     |
| **CA24** | Botão "Compartilhar" usa Web Share API em mobile; cai em clipboard em desktop                           | Test feature-detection + manual smoke       | ⏳     |
| **CA25** | Mudar `q` reseta `cursor` (corrige inconsistência de paginação)                                         | Test integração `useSearchParamsState.setQ` | ⏳     |
| **CA26** | URL ≤ 2KB mesmo com filtros máximos (8 tokens + range + cursor)                                         | Property-based test                         | ⏳     |
| **CA27** | Refresh (F5) mantém estado da busca                                                                     | Test integração + manual smoke              | ⏳     |

---

## User Stories (rascunho)

### US32.1 — Leitor compartilha resultado de busca

> **Como** leitor
> **Quero** copiar a URL atual da busca
> **Para** mandar para um amigo discutir o resultado.

- **Prioridade**: 🟡 Normal
- **CAs cobertos**: CA22, CA23, CA24
- **Status**: ⏳ Pending Sprint 5

### US32.2 — Leitor abre URL compartilhada e vê o mesmo estado

> **Como** leitor que recebeu uma URL de busca
> **Quero** ver exatamente os mesmos resultados que a pessoa que me enviou
> **Para** participar da conversa.

- **Prioridade**: 🟡 Normal
- **CAs cobertos**: CA22, CA23, CA27
- **Status**: ⏳ Pending Sprint 5

### US32.3 — Sistema garante paginação consistente em URL

> **Como** sistema
> **Quero** que mudanças em `q` resetem o cursor de paginação
> **Para** que páginas profundas de termo antigo não vazem em busca nova.

- **Prioridade**: 🟠 Alta (correção de inconsistência latente M-01 do REVIEW-PHASE-3)
- **CAs cobertos**: CA25
- **Status**: ⏳ Pending Sprint 5

---

## Tasks previstas (alocação Sprint 5)

| ID    | Descrição                                                              | Prioridade |
| ----- | ---------------------------------------------------------------------- | ---------- |
| T32.1 | Botão `<ShareButton>` com `navigator.share()` + fallback clipboard     | 🟡         |
| T32.2 | `useSearchParamsState.setQ` reseta `cursor` (fix M-01)                 | 🟠         |
| T32.3 | Garantir ordem canônica dos params (refac `canonicalKey` espelhando)   | 🟡         |
| T32.4 | Test E2E Playwright multi-tab (copy URL → open new tab → assert state) | 🟡         |

---

## Cross-references resumidas

| Direção                    | Onde                                                                                                                                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ↑ Requisitos atendidos     | [RF-007 §deep-link](../../requirements/RF/RF-007-busca-editorial.md), [RNF-a11y](../../requirements/RNF/RNF-a11y.md), [RNF-security](../../requirements/RNF/RNF-security.md)                               |
| ↑ Epic pai                 | [EP-10](../epics/EP-10-busca-editorial.md)                                                                                                                                                                 |
| → Sprint(s)                | [Sprint 5](../sprints/sprint-5-filtros-deep-linking.md)                                                                                                                                                    |
| → Specs técnicas           | [ADR-027 — URL SSOT](../../specs/busca-editorial/adrs/ADR-027-tanstack-query-usedebounced-deferred-url-ssot.md)                                                                                            |
| ← Features irmãs sob EP-10 | [F-30 Texto livre](F-30-busca-texto-livre.md) (dependência hard — F-32 estende SSOT já parcialmente implementado), [F-31 Filtros](F-31-filtros-busca.md) (deep-link só faz sentido com filtros funcionais) |

---

_Pending — depende de F-31 estar funcional. Kickoff Sprint 5._
