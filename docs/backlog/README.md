# Backlog — Interpop

> **Pasta-fonte do "QUEM faz O QUÊ, QUANDO".** Tudo aqui responde "que trabalho está planejado/em execução/feito?". O **porquê** vive em `requirements/`. O **como** vive em `specs/` + ADRs.

## Hierarquia rastreável (engenharia-de-requisitos)

```
Requisito (RF/RNF)        ← docs/requirements/
  ↓ realizado por
Epic (EP-NN)              ← ESTA pasta, epics/
  ↓ decomposto em
Feature (F-NN)            ← ESTA pasta, features/
  ↓ aceito quando
Critério de Aceitação (CA01..CANN)        ← dentro do arquivo de Feature
  ↓ ilustrado por
User Story (USNN.M) + cenários BDD        ← dentro do arquivo de Feature
  ↓ implementado por
Task (T / TX)             ← dentro do arquivo de Feature
  ↓ entregue em
Sprint                    ← ESTA pasta, sprints/
  ↓ materializada em
Commit (SHA)              ← cross-ref no Task
```

**Regra dura**: cada nó cita explicitamente o nó **pai** e os nós **filhos** via link relativo. Quando algo é fechado, **move-se** para `done/` (não cópia — `git mv` preserva histórico).

## Estrutura

```
backlog/
├── README.md                este arquivo
├── glossario.md             vocabulário de domínio editorial (artigo, editoria, redator, autor, leitor…)
│
├── epics/                   1 arquivo por Epic — descrição + lista de Features filhas
│   ├── EP-01-fundacao-plataforma.md
│   ├── EP-02-publicacao-editorial.md
│   ├── EP-03-engajamento-comunidade.md
│   ├── EP-04-newsletter-comunicacao.md
│   ├── EP-05-moderacao-comunidade.md
│   ├── EP-06-administracao-sistema.md
│   └── EP-10-busca-editorial.md
│
├── features/                1 arquivo por Feature — descrição + CAs + USs (com BDD) + Tasks
│   ├── F-30-busca-texto-livre.md
│   ├── F-31-filtros-busca.md
│   └── F-32-deep-linking-busca.md
│
├── sprints/                 1 arquivo por Sprint — execução temporal (mapping US/Tasks)
│   ├── sprint-4-busca-editorial.md
│   ├── sprint-5-filtros-deep-linking.md
│   └── sprint-6-supabase-evaluation.md
│
└── done/                    Epics e Features fechados (arquivos MOVIDOS, não copiados)
```

## Convenções inegociáveis (alinhadas com engenharia-de-requisitos)

### Naming (regra dura)

| Nível       | Pode no título                                                            | NÃO pode no título                                                        |
| ----------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Epic**    | Substantivo + adjetivo: "Fundação da plataforma", "Busca editorial"       | Verbo no infinitivo ("Implementar busca"), termo técnico ("Postgres FTS") |
| **Feature** | Substantivo + adjetivo: "Busca por texto livre"                           | Infinitivo, sigla técnica ("Implementar tsvector + GIN")                  |
| **CA**      | Estado verificável: "Resultados aparecem em até 300ms"                    | Vago: "Performance OK"                                                    |
| **US**      | "Como [persona], quero [ação], para [valor]" pt-BR                        | Mistura técnico-negócio na frase                                          |
| **Task**    | **PODE** usar termo técnico: "Migration 0001 — CONFIGURATION pt_unaccent" | (Tasks são o único nível operacional onde técnico é OK)                   |

### IDs canônicos (imutáveis após criação)

| Tipo                    | Formato                        | Exemplo                    |
| ----------------------- | ------------------------------ | -------------------------- |
| Epic                    | `EP-NN`                        | `EP-10`                    |
| Feature                 | `F-NN`                         | `F-30`                     |
| Critério de Aceitação   | `CANN` (dentro do Feature pai) | `CA01`, `CA15`             |
| User Story              | `USNN.M`                       | `US30.1`, `US31.4`         |
| Task US-bound           | `TNN.M.K`                      | `T30.1.4b`                 |
| Task transversal        | `TX-NN`                        | `TX-18`                    |
| Requisito Funcional     | `RF-NNN`                       | `RF-007`                   |
| Requisito Não-Funcional | `RNF-NN`                       | `RNF-perf`                 |
| Sprint                  | `sprint-N-slug`                | `sprint-4-busca-editorial` |

### Prioridade (em todos os níveis)

- 🔴 **Imediato** — bloqueia MVP, security crítico, regressão de produção
- 🟠 **Alta** — release atual; idealmente entregue no Sprint corrente
- 🟡 **Normal** — próxima Sprint
- ⚪ **Baixa** — backlog de longa data

### Definition of Done de Feature

Uma Feature está **Done** quando:

1. Todos os CAs estão verificados por automated test (ou manual checklist se for UX puro)
2. Todas as USs têm cenários BDD que rodam verde
3. Todas as Tasks estão `done` com commit hash
4. Code-review aprovado (ver `gsd-code-reviewer` ou humano sênior)
5. Cobertura ≥ gate do Sprint (40% Sprint 1 → 80% Sprint 4+)
6. Documentação cruzada atualizada (RF/RNF citados + Sprint cita Feature + Feature aparece em done/)
7. Mergeada em `main` via PR (sem `--force-push`, sem `--no-verify`)

## Como fechar uma Feature (workflow)

1. Confirmar que todos os CAs/USs/Tasks dela estão `✅ Done`.
2. Atualizar tabela em `features/F-NN-nome.md` com commit hashes finais.
3. Atualizar Epic pai (`epics/EP-NN-...md`) mudando a linha da Feature para `✅ Done`.
4. Atualizar Sprint correspondente (`sprints/sprint-N-...md`) mudando status.
5. Atualizar Requisitos realizados (`requirements/RF-NNN-...md` seção "Realizado por").
6. `git mv docs/backlog/features/F-NN-nome.md docs/backlog/done/F-NN-nome.md`
7. Commit: `chore(backlog): F-NN done — close + archive`.

## Link com a skill canônica

[`~/.claude/skills/engenharia-de-requisitos/`](https://github.com/seekdevcore/sk-requirements-engineering-theskill) — IFPB ERS + Sommerville/Pressman/Wiegers/BABOK v3 + Code de Ética 002/2024.

## Cross-references

- [Requisitos](../requirements/README.md) — RF/RNF que alimentam os Epics
- [Specs técnicas](../specs/) — DESIGN, ADRs por feature
- [ADRs do projeto](../planning/adrs/) — decisões arquiteturais transversais
- [Architecture overview](../architecture/overview.md)
- [Testing standards](../tests/testing-standards.md)
- [Hosting plan](../planning/HOSTING-DEPLOY-PLAN.md)

---

_Criado em 2026-06-09 como parte da reorganização `chore/docs-reorg`._
