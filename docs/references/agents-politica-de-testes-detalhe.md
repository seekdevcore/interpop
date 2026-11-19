# Política de testes — texto integral da §6 do AGENTS.md

> Movido do `AGENTS.md` em 2026-11-04 (era a §6 completa). Texto original, sem reescrita.
> O `AGENTS.md` mantém a regra inegociável e as convenções em forma condensada. Aqui ficam a tabela dos 10 tipos core (§6.1 — é esta a tabela que o `docs/tests/testing-standards.md` §2.12 manda atualizar ao criar tipo novo), as convenções por extenso, quando consultar o documento-mestre e a stack ativa.
> Caminhos relativos no texto abaixo (`./...`) partem da raiz do repositório, como no `AGENTS.md` original.

---

## 6. Política de testes (REGRA INEGOCIÁVEL)

> **Antes de implementar, modificar ou refatorar qualquer código que possa ser testado, deve existir teste.** Sem exceção. Regra dura, igual ao §0 (Gabarito) e ao §2 (skills).
>
> O catálogo completo, rationale, stack, gates, templates de report e exemplos vivem em [`docs/tests/testing-standards.md`](./docs/tests/testing-standards.md) — leitura obrigatória antes de tocar em código testável.

### 6.1 Os 10 tipos de teste praticados (core)

| #   | Tipo                              | Definição curta                                                      | Quando aplicar                                                                       | Estado                                                |
| --- | --------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| 1   | **Unitário**                      | Testa 1 função/método isolado, sem DB nem HTTP. Mais rápido (~ms).   | Lógica pura, helpers, utils, validators, computed properties.                        | ✅ ativo                                              |
| 2   | **Retroativo (backfill)**         | Testa código pré-existente sem cobertura, escrito DEPOIS do código.  | Refactor de área crítica; bug descoberto em código velho.                            | ✅ ativo                                              |
| 3   | **TDD (test-driven-development)** | Teste PRIMEIRO (vermelho → verde → refactor).                        | Lógica de segurança, cálculos de domínio, migrations one-shot, hotfix de produção.   | ✅ ativo                                              |
| 4   | **Integração**                    | Múltiplos componentes juntos com DB real, testa fronteiras.          | API endpoints E2E backend, signals + service interagindo.                            | ✅ ativo (parcial)                                    |
| 5   | **E2E (end-to-end)**              | Fluxo completo browser → API → DB via Playwright.                    | Fluxos críticos: login, publicar artigo, comentar, banir.                            | ⏳ implementação futura (Sprint 3+)                   |
| 6   | **Regressão**                     | Teste escrito APÓS um bug, reproduzindo o cenário exato que falhou.  | Toda vez que um bug crítico é corrigido. Garante que NÃO volta.                      | ✅ ativo                                              |
| 7   | **Smoke (fumaça)**                | Sanity check rápido — sistema subiu e responde no básico.            | Pós-deploy (rollback automático se falha), pós-restart, monitor externo UptimeRobot. | ✅ ativo (via `/healthz/`)                            |
| 8   | **Acessibilidade (a11y)**         | Conformidade WCAG 2.2 AA: contraste, teclado, ARIA, screen reader.   | Antes de QUALQUER mudança visual de frontend (§4 — WCAG obrigatório).                | ✅ ativo (WAVE/axe manual) · 🟡 axe-core em CI futuro |
| 9   | **Performance**                   | Core Web Vitals (LCP/INP/CLS), p50/p95/p99 backend, query count.     | Antes de mudança em hot path; antes de adicionar lib pesada; pós-pico de uso.        | 🟡 base via Sentry · gates Lighthouse CI em roadmap   |
| 10  | **Segurança**                     | SAST (bandit, semgrep), DAST, secret scan (gitleaks), depend. audit. | Todo PR (CI automático); antes de release; pós-CVE em dependência.                   | 🟡 base manual · S15-S17 em roadmap (Sprint 1-2)      |

**Extensão futura**: o documento mestre lista **13 tipos adicionais** (property-based, snapshot, mutation, migration, contract, visual regression, load/stress, fuzz, concurrency, doctest, compatibility, l10n, BDD) com critério "quando virar dor", e **protocolo formal para criar tipo novo** se nenhum dos 23 cobrir o caso. Ver [`docs/tests/testing-standards.md §2.11 + §2.12`](./docs/tests/testing-standards.md).

### 6.2 Convenções operacionais

- **Cada execução de teste gera report** em `docs/tests/reports/AAAA-MM-DD_HH-MM-SS.md` (timestamp ISO 8601 com underscore, hora em formato 24h, fuso UTC-3 Brasília).
- **Cópia em PDF** (gerada via `scripts/md-to-pdf.sh`) vai em `docs/tests/reports-pdf/` — formato com 2 seções obrigatórias: **(a) Resumo simples + direto** (1 parágrafo para qualquer leitor) e **(b) Análise técnica + detalhada** (stack traces, file:line, métricas).
- **Documento mestre** `docs/tests/testing-standards.md` define regras, stack, gates de cobertura, naming, templates. Atualiza junto com decisões arquiteturais de teste (cada mudança vira ADR no `Improvement-system.md`).
- **Política dura de merge**: PR não merge se cobertura **DESCE**. Aceitável: cobertura sobe ou estável.
- **Gate atual de cobertura**: 40% (Sprint 1 — atingido com 82% efetivo, 88 testes). Sobe 10pp/sprint até 80%.

### 6.3 Quando consultar testing-standards.md

- Antes de escrever **qualquer** novo teste — consultar template, naming, locality.
- Antes de criar **report** de teste — consultar template de PDF (simples + técnico).
- Antes de propor **mudança em gate** de cobertura ou stack — virar ADR antes de aplicar.
- Antes de aceitar PR de outro contribuidor — confirmar conformidade com §6.

### 6.4 Stack ativa

- **Backend**: pytest 9 + pytest-django 4.12 + pytest-cov 7 + factory-boy + freezegun + pytest-mock. Configurado em `backend/pytest.ini` + `backend/conftest.py`.
- **Frontend**: vitest + Testing Library + Playwright (E2E futuro). Configurado em `package.json` (a entrar — F4/F11).
- **CI gate**: `.github/workflows/ci.yml` roda `uv run pytest --cov-fail-under=40` em todo PR; falha bloqueia merge.
