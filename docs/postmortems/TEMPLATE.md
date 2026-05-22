# Postmortem: <título curto descritivo do incidente>

> Template para postmortems do Interpop. Preencher cada seção. Blameless —
> nomes apenas quando indispensáveis (geralmente não são). Foco em "que
> condições do sistema permitiram que isso acontecesse" e "que mudança
> sistêmica evita que reaconteça".

## Cabeçalho

| Campo                     | Valor                                  |
| ------------------------- | -------------------------------------- |
| **Data do incidente**     | YYYY-MM-DD HH:MM BRT                   |
| **Detecção em**           | YYYY-MM-DD HH:MM BRT                   |
| **Mitigação completa em** | YYYY-MM-DD HH:MM BRT                   |
| **Severidade**            | SEV-1 / SEV-2 / SEV-3                  |
| **Usuários impactados**   | Todos / Subset (descrever) / Internos  |
| **Status atual**          | Resolvido / Mitigado / Em investigação |

## TL;DR (3 frases)

_O que aconteceu, qual foi o impacto, o que evita recorrência._

## Linha do tempo

| Hora (BRT) | Evento     |
| ---------- | ---------- |
| HH:MM      | _evento 1_ |
| HH:MM      | _evento 2_ |

## Causa raiz

_5 Whys ou Causal Loop. Não parar no "alguém esqueceu" — perguntar por que
o sistema deixou esquecer. Cada "porque" deve apontar uma propriedade do
sistema, não uma pessoa._

## Impacto

- _Usuários afetados_: quantidade, segmento, severidade do que perderam
- _Métricas_: queda em deploys/min, requests com erro, etc.
- _Reputacional_: postagens externas, contatos de imprensa

## O que funcionou

_Mecanismos que detectaram cedo / limitaram raio de explosão. Reforçar
isso é tão importante quanto consertar o que falhou._

## O que falhou

_Mecanismos que deveriam ter detectado / limitado mas não detectaram.
Listar cada um. Não buscar culpados — buscar pontos cegos do sistema._

## Action items

| #   | Ação        | Owner | Prioridade | Status          | PR   |
| --- | ----------- | ----- | ---------- | --------------- | ---- |
| 1   | _descrição_ | @user | P0/P1/P2   | TODO/Doing/Done | #NNN |

## Aprendizados arquiteturais

_O que esse incidente revela sobre design, observability, processos. Itens
candidatos a virar ADR. Conexão com Improvement-system.md._

---

_Postmortem por @autor. Revisado em YYYY-MM-DD por @revisor._
