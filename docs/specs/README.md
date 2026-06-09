# Specs — Interpop

> **Spec-Driven Development (SDD)** aplicado ao Interpop. Esta pasta é a "pasta-fonte do COMO" — para o "O QUÊ" do produto vá em [`requirements/`](../requirements/README.md), para o "QUEM faz O QUÊ" vá em [`backlog/`](../backlog/README.md).

---

## O método (TLC SDD canon — auto-sized)

A complexidade da mudança decide a profundidade do spec, não um pipeline fixo.

```
┌──────────┐   ┌──────────┐   ┌─────────┐   ┌─────────┐
│ SPECIFY  │ → │  DESIGN  │ → │  TASKS  │ → │ EXECUTE │
└──────────┘   └──────────┘   └─────────┘   └─────────┘
   required      optional       optional      required
```

| Tamanho     | Escopo                    | O que se produz                                   |
| ----------- | ------------------------- | ------------------------------------------------- |
| **Quick**   | ≤3 arquivos, 1 linha      | TASK.md em `_quick/NNN-slug/`                     |
| **Medium**  | feature clara, <10 tasks  | spec.md (brief) → executar                        |
| **Large**   | multi-componente          | spec.md + design.md + tasks.md + execute          |
| **Complex** | ambiguidade, domínio novo | spec.md + context.md + design.md + tasks.md + UAT |

### Mapeamento com a hierarquia engenharia-de-requisitos (que já existe)

| Etapa SDD (TLC) | Onde mora no Interpop                                                                       |
| --------------- | ------------------------------------------------------------------------------------------- |
| Specify         | `docs/requirements/RF-NNN.md` (negócio) + `docs/backlog/features/F-NN.md` (CAs + USs + BDD) |
| Discuss/Context | `docs/specs/<feature>/REVIEW-PHASE-{1,2,3}.md` + `_specialist-outputs/`                     |
| Design          | `docs/specs/<feature>/DESIGN.md` + ADRs em `adrs/`                                          |
| Tasks           | Tabela "Tasks" dentro do `F-NN.md` (com commit hash)                                        |
| Execute         | Commits referenciando Task ID + PR para `main`                                              |
| UAT             | Smoke manual + tests E2E + axe-core nos 5 estados                                           |

**Conclusão**: o pipeline SDD do TLC e a hierarquia da skill `engenharia-de-requisitos` são complementares. A skill foca em **negócio → backlog**, o SDD foca em **design técnico → execução**. Ambos se encontram em `F-NN.md` (specify) e em `DESIGN.md` (design).

---

## Estrutura desta pasta

```
docs/specs/
├── README.md                    ← este arquivo
│
├── codebase/                    ← BROWNFIELD: snapshot do codebase como ele É
│   ├── STACK.md                 versões reais das libs (extraídas dos lockfiles)
│   ├── ARCHITECTURE.md          topologia + componentes + 3 fluxos cross-layer
│   ├── STRUCTURE.md             onde vive o quê (backend + frontend)
│   ├── CONVENTIONS.md           convenções de código (Python + TS + React + Django)
│   ├── TESTING.md               política de testes resumida + matriz "qual aplicar quando"
│   ├── INTEGRATIONS.md          12 integrações externas com status + plano B
│   └── CONCERNS.md              débito técnico + áreas frágeis + gotchas (anti-sycophancy)
│
├── project/                     ← VISÃO + ESTADO
│   ├── PROJECT.md               visão + objetivos + KPIs + bases
│   ├── ROADMAP.md               features + milestones (substitui Improvement-system)
│   └── STATE.md                 memória viva: decisões, blockers, lessons, deferred ideas
│
├── _template/                   ← ESQUELETO canônico para nova Feature complex
│   ├── README.md                como usar
│   ├── DESIGN.md                template de design.md
│   ├── REVIEW.md                template de code review
│   ├── SECURITY-REVIEW.md       (opcional para features que tocam auth/PII)
│   ├── TEST-STRATEGY.md         (opcional para features Complex)
│   └── adrs/INDEX.md            template de inventário de ADRs
│
├── busca-editorial/             ← EXEMPLO completo (US30.1, Sprint 4)
│   ├── DESIGN.md v3 (1090 LOC)
│   ├── REVIEW-PHASE-{1,2,3}.md
│   ├── SECURITY-REVIEW.md, TEST-STRATEGY.md
│   ├── adrs/ (35 ADRs)
│   └── _specialist-outputs/
│
└── <feature>/                   ← novos specs criados conforme features chegam
    └── DESIGN.md + adrs/ + ...
```

---

## Quando criar um spec

| Cenário                                                                 | Resposta                                                                                                                                                                         |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bug fix em ≤3 arquivos com 1 linha de descrição                         | **Não cria spec.** Quick mode: commit direto após PR review humano.                                                                                                              |
| Feature pequena (refresh visual em página existente)                    | **Não cria spec.** Documenta na Feature em `docs/backlog/features/`.                                                                                                             |
| Feature média (novo endpoint + UI + tests <10 tasks)                    | **Cria spec.md em `docs/backlog/features/F-NN.md`** com CAs + USs + BDD. DESIGN inline.                                                                                          |
| Feature grande (multi-componente, multi-app, novo bounded context)      | **Cria pasta `docs/specs/<feature>/`** com DESIGN.md + ADRs. Use o `_template/`.                                                                                                 |
| Feature complexa (novo domínio, ambiguidade, ≥3 specialists envolvidos) | **Cria pasta `docs/specs/<feature>/` completa** (DESIGN + REVIEW-PHASE-N + SECURITY-REVIEW + TEST-STRATEGY + ADRs + \_specialist-outputs). Exemplo canônico: `busca-editorial/`. |

---

## Como criar um spec novo (passo a passo, feature Large/Complex)

1. **Confirme em `docs/backlog/features/`** que existe uma F-NN para a feature. Se não, crie primeiro (a skill `engenharia-de-requisitos` rege esse arquivo).

2. **Copie o template**:

   ```bash
   cp -r docs/specs/_template docs/specs/<slug-da-feature>
   ```

3. **Preencha DESIGN.md** seguindo a estrutura do `_template/DESIGN.md`:
   - Problem statement (1 parágrafo)
   - Decomposition map (camadas envolvidas: software, DB, algoritmos, BE, FE, UI/UX)
   - Layer decisions (uma seção por camada com decisão + alternativas rejeitadas)
   - Cross-layer decisions (orquestrador)
   - ADRs a criar (lista)
   - Open questions ao usuário

4. **Materialize ADRs** em `<spec>/adrs/ADR-NNN-titulo.md` seguindo padrão MADR ([referência: ADRs da busca](busca-editorial/adrs/)).

5. **Se Complex**: dispare specialists em paralelo (database-architect, algorithms-data-structures-architect, frontend-architect, ui-ux-architect, backend-architect, software-architect) e preserve outputs literais em `_specialist-outputs/`.

6. **Reviews**: rode `cyber-security-architect` + `testing-engineer` antes de fechar. Produza `REVIEW-PHASE-N.md` + `SECURITY-REVIEW.md` + `TEST-STRATEGY.md`.

7. **Implementação**: `code-implementer` consome o spec bundle (DESIGN + ADRs + REVIEWs). Cada commit cita Task ID + DESIGN-vN. Atualize `F-NN.md` com commit hash de cada Task.

8. **Quando feature fechar**: `git mv docs/backlog/features/F-NN.md docs/backlog/done/F-NN.md`. O spec em `docs/specs/<feature>/` PERMANECE no lugar (referência viva).

---

## Como navegar como reviewer

| Pergunta                                      | Onde olhar                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Que stack o projeto usa hoje?                 | `codebase/STACK.md`                                                                        |
| Como onboarding em 30 min?                    | `codebase/STACK.md` + `codebase/ARCHITECTURE.md` + `codebase/STRUCTURE.md`                 |
| Onde está o débito?                           | `codebase/CONCERNS.md`                                                                     |
| Como o time testa?                            | `codebase/TESTING.md` + [`docs/tests/testing-standards.md`](../tests/testing-standards.md) |
| Que decisões já foram tomadas para X feature? | `<feature>/DESIGN.md` + `<feature>/adrs/INDEX.md`                                          |
| Por que esta decisão arquitetural?            | ADR específica em `<feature>/adrs/ADR-NNN-titulo.md`                                       |
| Que dívida ficou pendente?                    | `<feature>/REVIEW-PHASE-N.md` §Tasks restantes + `project/STATE.md` §Open questions        |
| Como o produto evolui?                        | `project/ROADMAP.md`                                                                       |
| Memória do tech lead?                         | `project/STATE.md`                                                                         |

---

## Cross-references

- [Requisitos (O QUÊ)](../requirements/README.md)
- [Backlog (QUEM faz QUANDO)](../backlog/README.md)
- [Architecture overview legacy](../architecture/overview.md) (sucessor: `codebase/ARCHITECTURE.md`)
- [Testing standards](../tests/testing-standards.md) (referência longa)
- [Hosting plan](../planning/HOSTING-DEPLOY-PLAN.md)
- [Runbooks operacionais](../runbooks/README.md)
- Skill canônica: [seekdevcore/sk-requirements-engineering-theskill](https://github.com/seekdevcore/sk-requirements-engineering-theskill)

---

_Pasta criada em 2026-06-09 como parte do PR de reorg (`chore/docs-reorg-requirements-backlog`). Brownfield docs em `codebase/` produzidas por fan-out de 6 agentes especializados._
