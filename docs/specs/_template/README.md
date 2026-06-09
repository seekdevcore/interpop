# `_template/` — Esqueleto para Feature Large/Complex

> Copie este folder ao iniciar uma Feature que justifica spec completa (multi-componente OU ambiguidade). Para Feature Medium, basta `docs/backlog/features/F-NN.md`. Para Quick, nem cria spec.

---

## Como usar

```bash
# Crie o diretório usando o slug da feature (em kebab-case pt-BR)
FEATURE_SLUG="filtros-busca"   # ex.: F-31
cp -r docs/specs/_template docs/specs/${FEATURE_SLUG}

# Renomeie/preencha os arquivos
cd docs/specs/${FEATURE_SLUG}
# DESIGN.md          ← obrigatório
# adrs/INDEX.md      ← lista ADRs locais
# adrs/ADR-NNN-*.md  ← uma por decisão
# REVIEW.md          ← code review pós-implementação
# SECURITY-REVIEW.md ← se feature toca auth/PII/financeiro
# TEST-STRATEGY.md   ← se feature é Complex
# _specialist-outputs/  ← outputs literais dos agentes (auditoria)
```

---

## Quando usar cada arquivo

| Arquivo                                  | Quando                                               | Quem cria                            |
| ---------------------------------------- | ---------------------------------------------------- | ------------------------------------ |
| `DESIGN.md`                              | **SEMPRE** para Large/Complex                        | Specialist orquestrador OU main loop |
| `adrs/ADR-NNN-titulo.md`                 | Cada decisão arquitetural não-trivial                | Specialist autor da decisão          |
| `REVIEW.md`                              | Após implementação, antes do PR final                | `gsd-code-reviewer` ou humano sênior |
| `SECURITY-REVIEW.md`                     | Feature toca auth, PII, financeiro, ou dado regulado | `cyber-security-architect`           |
| `TEST-STRATEGY.md`                       | Feature Complex com múltiplos tipos de teste         | `testing-engineer`                   |
| `_specialist-outputs/0N-<specialist>.md` | Feature Complex que usou fan-out de specialists      | Cada specialist (preservar literal)  |

---

## Exemplo canônico

[`docs/specs/busca-editorial/`](../busca-editorial/) é a referência viva. Inclui:

- DESIGN.md v3 (1090 LOC, 6 specialists integrados)
- REVIEW-PHASE-1/2/3.md (3 reviews em fases distintas)
- SECURITY-REVIEW.md (17 achados auditados)
- TEST-STRATEGY.md (matriz 10 tipos × 110 testes projetados)
- 35 ADRs em adrs/
- 4 specialist outputs literais em \_specialist-outputs/

Use esse padrão como teto. Para features menores, esculpa para baixo.

---

## Fluxo SDD completo (Large/Complex)

```
1. F-NN.md criada em docs/backlog/features/ (specify)
2. cp docs/specs/_template/ docs/specs/<feature>/
3. Preencher DESIGN.md (decomposition + layer decisions)
4. Materializar ADRs em adrs/
5. Se Complex: fan-out specialists em _specialist-outputs/
6. Iterar com REVIEW.md (Phase 1/2/3 se grande)
7. SECURITY-REVIEW + TEST-STRATEGY se aplicável
8. code-implementer consome o bundle (DESIGN + ADRs + REVIEWs)
9. Atualizar F-NN.md com commit hashes de cada Task
10. Quando done: git mv F-NN.md → docs/backlog/done/F-NN.md
    docs/specs/<feature>/ permanece (referência viva)
```

---

## Cross-references

- [docs/specs/README.md](../README.md) — método SDD
- [docs/backlog/README.md](../../backlog/README.md) — onde Features (F-NN) vivem
- [Skill `tlc-spec-driven`](https://github.com/davidteren/tech-leads-club-skills)
- [`busca-editorial/` exemplo](../busca-editorial/)
