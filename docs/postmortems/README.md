# Postmortems — Interpop

> Postmortems são **blameless** — foco em causas sistêmicas, não em pessoas.
> Cada incidente SEV-1 ou SEV-2 deve gerar um postmortem dentro de 7 dias.
> SEV-3 fica a critério.

## Convenção de nome de arquivo

`YYYY-MM-DD-slug-curto.md`

Ex.: `2026-05-19-c1-jwt-rotation-broken.md`

## Template

[`TEMPLATE.md`](./TEMPLATE.md) — copiar + renomear + preencher.

## Catálogo

| Data       | Severidade | Título                                                                                | Status                            |
| ---------- | ---------- | ------------------------------------------------------------------------------------- | --------------------------------- |
| 2026-05-19 | SEV-2      | [C1: rotação de JWT silenciosamente quebrada](./2026-05-19-c1-jwt-rotation-broken.md) | Resolvido — postmortem retroativo |

---

_A39 do reorganization-proposal. Estrutura criada 2026-05-22._
