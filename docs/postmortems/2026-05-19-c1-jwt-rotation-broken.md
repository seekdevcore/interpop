# Postmortem: rotação de JWT silenciosamente quebrada — toda sessão expirava em 15min

> Postmortem retroativo (A39 do reorganization-proposal). O incidente ocorreu
> antes de termos cultura formal de postmortems; reconstruído a partir do
> commit fix (`docs/planning/Improvement-system.md §11.1 C1`) e do teste
> de regressão em `backend/apps/users/tests/test_services.py`.

## Cabeçalho

| Campo                     | Valor                                                         |
| ------------------------- | ------------------------------------------------------------- |
| **Data do incidente**     | 2026-05-18 (estimado)                                         |
| **Detecção em**           | 2026-05-19 (durante refactor de session-auth)                 |
| **Mitigação completa em** | 2026-05-19 (commit do fix + testes de regressão)              |
| **Severidade**            | SEV-2 (UX crítica para produto editorial, sem perda de dados) |
| **Usuários impactados**   | Todos os autenticados em pré-prod                             |
| **Status atual**          | Resolvido                                                     |

## TL;DR

A função `rotate_refresh_token` em `apps/users/services.py` lia `refresh.access_token.user` — atributo inexistente em SimpleJWT — e o `except` genérico engolia o AttributeError silenciosamente, retornando False. Resultado: toda sessão "expirava" no fim do access token (15min naquela época), forçando re-login em vez de rotacionar. Pior cenário possível pra produto editorial de leitura longa. Fix: ler `refresh["user_id"]` (claim padrão) e cobrir o caminho com 5 testes de regressão.

## Linha do tempo

| Hora (BRT)       | Evento                                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ~                | Implementação inicial de rotação de refresh tokens (commit não identificado). Função usa atributo errado mas todos os testes existentes passam (não exercitavam o path). |
| ~                | Pré-prod uso real: usuários relatam re-login frequente. Sem ainda telemetria estruturada (req_id, user_id) — dor diagnostica é difícil.                                  |
| 2026-05-19 dia   | Refactor da estratégia de sessão (`docs/planning/session-auth-strategy.md`) força leitura linha-a-linha de `services.py`. Bug identificado por inspeção.                 |
| 2026-05-19 noite | Fix aplicado + 5 testes em `test_services.py` cobrindo: valid cookie, blacklist do antigo, missing cookie, garbage cookie, user deletado.                                |

## Causa raiz

5 Whys:

1. **Por que** o token não rotacionava? Porque `rotate_refresh_token` retornava False sempre que recebia um cookie válido.
2. **Por que** retornava False? Porque levantava AttributeError em `refresh.access_token.user`.
3. **Por que** o `except` engolia silenciosamente? Porque o caminho usava `except Exception: pass` defensivo "para não derrubar logout em token corrompido".
4. **Por que** ninguém pegou em CI/code review? Porque NÃO HAVIA TESTE para `rotate_refresh_token` exercitando o happy path — só os edge cases (missing/garbage cookie) que de fato retornavam False legitimamente.
5. **Por que** não tínhamos teste? Porque a função foi escrita sem TDD e a cobertura baseline era 0% para `services.py`.

Causa raiz **sistêmica**: combinação de (a) `except Exception: pass` defensivo escondendo bug real + (b) ausência de TDD na escrita inicial + (c) cobertura zero para esse módulo.

## Impacto

- **Usuários**: re-login forçado a cada ~15min em pré-prod. Sem perda de dados, mas UX inaceitável para produto editorial.
- **Métricas**: sem telemetria estruturada na época (request_id/user_id ainda não existiam no LOGGING — A27 entrou depois). Volume exato de re-logins desconhecido.
- **Reputacional**: incidente pré-prod, zero exposição externa.

## O que funcionou

- A leitura linha-a-linha durante refactor pegou o bug — sinal de que **refactors planejados rendem bugs grátis**.
- Após detectar, o fix foi atomic + acompanhado de 5 testes de regressão na MESMA PR. Disciplina TDD posthoc.

## O que falhou

- **`except Exception: pass`** em path crítico. Padrão proibido pelo guideline atual em `Improvement-system.md` — escondia o bug real.
- **Cobertura zero** em `services.py`. Não havia gate de cobertura mínima (entrou depois com A26: `--cov-fail-under=40`).
- **Sem teste** do happy path da rotação (só dos sad paths). Mesmo com gate de cobertura linha-a-linha, branches happy passariam — a métrica certa é cobertura **funcional** (cenário usuário-visível).

## Action items

| #   | Ação                                                                   | Owner   | Prioridade | Status | PR / Commit                     |
| --- | ---------------------------------------------------------------------- | ------- | ---------- | ------ | ------------------------------- |
| 1   | Fix do bug (ler `refresh["user_id"]`)                                  | Gabriel | P0         | Done   | (commit do fix C1)              |
| 2   | 5 testes de regressão em `test_services.py`                            | Gabriel | P0         | Done   | mesmo commit                    |
| 3   | Gate `--cov-fail-under=40` no CI                                       | Gabriel | P1         | Done   | A26                             |
| 4   | Política contra `except Exception: pass` em paths críticos             | Gabriel | P1         | Done   | Improvement-system.md guideline |
| 5   | LOGGING estruturado com request_id + user_id (para diagnóstico futuro) | Gabriel | P1         | Done   | A27                             |

## Aprendizados arquiteturais

- **Disciplina TDD não-negociável** para código de auth/sessão. Bug crítico zero-day vive em zonas que não foram testadas; "vou testar depois" = não vou testar.
- **Bare `except` é antipadrão**: sempre catch específico, e logar (mesmo que swallow no return) — bug silencioso é pior que bug ruidoso.
- **Cobertura mínima evolui**: 40% → 50% → 80% por sprint, sempre subindo, nunca descendo. Política dura de merge no `Improvement-system.md §12`.
- **Refactors são oportunidade de auditoria**. Quando reler código, ler com olho de adversário — "o que está implícito que pode estar errado?".

---

_Postmortem reconstruído em 2026-05-22 a partir de commit history + testes de regressão. Incidente original em 2026-05-18~19._
