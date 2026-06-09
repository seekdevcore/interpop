# Requisitos — Interpop

> **Pasta-fonte do "o QUÊ" do produto.** Tudo aqui responde "que necessidade o sistema atende?", sem entrar em "como" (isso é `architecture/` + `specs/` + ADRs).

## Hierarquia de rastreabilidade (engenharia-de-requisitos)

```
Requisito (RF/RNF)                       ← ESTA pasta
  ↓ realizado por
Epic                                     ← docs/backlog/epics/
  ↓ decomposto em
Feature                                  ← docs/backlog/features/
  ↓ aceito quando
Critério de Aceitação (CA)               ← dentro do arquivo de Feature
  ↓ ilustrado por
User Story (US) + cenários BDD           ← dentro do arquivo de Feature
  ↓ implementado por
Task (T / TX)                            ← dentro do arquivo de Feature
  ↓ entregue em
Sprint                                   ← docs/backlog/sprints/
  ↓ materializada em
Commit (SHA)
```

**Regra dura**: cada nível cita explicitamente os nós **pai** e **filhos** via link relativo. Sem rastreabilidade bidirecional, a documentação vira ficção — quando alguém ajustar um requisito, precisa enxergar imediatamente quais Epics/Features/CAs/Tasks são afetados.

## Estrutura

```
requirements/
├── README.md                         este arquivo
├── personas-e-cenarios.md            personas (anônimo, autenticado, editor, admin, dev) + casos de uso
├── RF/                               Requisitos Funcionais (1 arquivo por módulo)
│   ├── RF-001-articles.md
│   ├── RF-002-comments.md
│   ├── RF-003-moderation.md
│   ├── RF-004-newsletter.md
│   ├── RF-005-users-auth.md
│   ├── RF-006-audit.md
│   └── RF-007-busca-editorial.md
└── RNF/                              Requisitos Não-Funcionais (corte transversal)
    ├── RNF-perf.md
    ├── RNF-security.md
    ├── RNF-a11y.md
    ├── RNF-lgpd.md
    └── RNF-availability.md
```

## Convenções (idênticas às de `backlog/README.md` — Interpop/IFPB)

- **pt-BR explícito**. Nunca infinitivo no título de RF. Use verbo no presente do indicativo: "Sistema permite que leitor busque artigos por termo livre" (não "permitir busca").
- **Sem termo técnico no título do RF**. Linguagem de negócio. `tsvector`, `JWT`, `Postgres` ficam na seção "decisões técnicas relacionadas" ou nas ADRs — não no enunciado do requisito.
- **IDs canônicos**: `RF-NNN`, `RNF-NN`. Imutáveis depois de criados. Se requisito for descontinuado, vira `RF-NNN-deprecated.md` (não some).
- **Prioridade**: 🔴 Imediato (MVP/segurança) · 🟠 Alta (release atual) · 🟡 Normal (próxima sprint) · ⚪ Baixa (backlog longo).
- **Cada arquivo tem seção `## Realizado por`**: lista de Epics/Features que executam este requisito.

## Como adicionar um requisito novo

1. Identifique o módulo: existe `RF-NNN` correspondente? Se sim, adicione uma seção. Se não, crie `RF-NNN-novo-modulo.md` com próximo número livre.
2. Escreva o enunciado em pt-BR de negócio (sem jargão técnico).
3. Marque prioridade explícita.
4. Adicione seção `## Realizado por` listando Epic(s) já aprovados que executam este requisito (vazio se ainda não há).
5. Quando um Epic novo for criado citando este requisito, **edite este arquivo** para atualizar `## Realizado por` — rastreabilidade bidirecional é obrigatória.

## Link com a skill canônica

Tudo aqui segue [`~/.claude/skills/engenharia-de-requisitos/`](https://github.com/seekdevcore/sk-requirements-engineering-theskill) (baseada em curso ERS IFPB + Sommerville 10e + Pressman 9e + Wiegers 3e + Cohn + Robertson + BABOK v3).

A skill exige:

1. Hierarquia Epic → Feature → CA · US → BDD → Task
2. Naming pt-BR (sem infinitivo, sem termo técnico em níveis de negócio)
3. Cross-references bidirecionais
4. Critérios de Aceitação testáveis em booleano
5. Cenários BDD em Gherkin pt-BR
6. Definition of Done explícita

## Cross-references rápidas

- [Backlog operacional](../backlog/README.md) — Epics, Features, Sprints
- [Specs técnicas](../specs/) — DESIGN, ADRs por feature
- [ADRs do projeto](../planning/adrs/) — decisões arquiteturais transversais
- [Architecture overview](../architecture/overview.md) — visão de cima
- [Testing standards](../tests/testing-standards.md) — política de testes

---

_Criado em 2026-06-09 como parte da reorganização `chore/docs-reorg`._
