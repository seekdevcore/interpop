# ADR-043: Mutation testing via Stryker em `SearchService` (≤10% surviving) e `useSearch` (≤15% surviving) — nightly, não bloqueia merge

- **Status**: Accepted
- **Date**: 2026-06-03
- **Tags**: testing, mutation-testing, stryker, code-quality, coverage-quality, nightly
- **Stakeholders**: testing-engineer (autor da strategy), algorithms-data-structures-architect, frontend-architect, code-implementer
- **Layer**: Testing
- **Origin**: TEST-STRATEGY.md §8 + §9.3 contestação anti-sycophancy

## Context

Cobertura de linha (line coverage) é o gate atual do projeto (40% global em Sprint 1, alvo 75% em Sprint 4 — TEST-STRATEGY §6.3 exige **≥85%** para `apps/search/`). Mas cobertura **pode ser tautológica**: teste executa a linha sem assertar comportamento, ou assertion fraca aceita output errado.

Vetores de tautologia documentados pela TEST-STRATEGY §9.3:

- `SearchService.query()` tem 5 invariantes críticos (cursor HMAC, ranking, normalização, ROUND(6), recency_60d).
- Cobertura 85% pode estar concentrada em path feliz; mutação em sinal de comparação (`> ` → `>=`), constante (`60` → `30`), ou operador (`AND` → `OR`) **passa nos testes** se eles só verificam shape + presença de campo.
- Bug 6 do DESIGN §0 (`getNextPageParam` retorna `undefined` vs `null` no FE) é exatamente esse tipo de regressão — mutação trivial não pega por teste fraco.

**Mutation testing** insere mutações (ex.: troca `>` por `>=`) e roda toda a suite contra cada mutação. Mutações **mortas** = teste pegou (boa cobertura semântica). Mutações **sobreviventes** = teste tautológico ou caso não coberto.

TEST-STRATEGY §8 propõe inicialmente `mutmut` (Python only). Refino: testing-strategy mistura backend (Python) + frontend (TypeScript). **Stryker** é a ferramenta padrão para JS/TS; **mutmut** ou **Cosmic Ray** para Python. Este ADR adota **Stryker como nome canônico** para denotar a categoria; implementação real usa Stryker-JS para FE e mutmut para BE (ambos compatíveis com mesma filosofia).

## Decision Drivers

- **Validar qualidade semântica da cobertura** — não só linhas executadas, mas comportamento detectado.
- **Foco em módulos críticos** — `SearchService` (BE) e `useSearch` (FE) concentram lógica de domínio.
- **Não bloqueia merge** — mutation tem custo (~3-5min); rodar nightly como issue automaticamente aberta.
- **Threshold realista** — 100% mutation kill é impossível (mutantes equivalentes existem); ≤10% surviving é alvo agressivo.
- **Stack ortogonal**: BE usa mutmut, FE usa Stryker — convivem em workflows separados.

## Considered Options

1. **Confiar só em coverage 85%** (DESIGN v3 atual) — rejeitado por §9.3.
2. **Mutation testing (mutmut BE + Stryker FE), nightly, não bloqueia merge** ⭐
3. **Bloquear merge em mutation score** — custo muito alto (3-5min por PR); rejeitado.
4. **Property-based testing only** (ADR-040) — cobre invariantes mas não regressões de linha-por-linha.

## Decision Outcome

**Chosen: Opção 2** — mutation testing como guard de qualidade, rodando em nightly schedule. Mutação sobrevivente → issue automática no GitHub, não bloqueia PR.

### Configuração — Backend (mutmut)

```toml
# backend/pyproject.toml
[tool.mutmut]
paths_to_mutate = "apps/search/services.py,apps/search/cursor.py,apps/search/normalize.py"
runner = "uv run pytest -x --no-cov apps/search/tests/"
tests_dir = "apps/search/tests/"
backup = false
```

```bash
# Rodar local
cd backend
uv run mutmut run --runner "uv run pytest -x apps/search/tests/"
uv run mutmut results
```

### Configuração — Frontend (Stryker-JS)

```json
// stryker.conf.json (raiz do projeto)
{
  "testRunner": "vitest",
  "mutate": [
    "src/pages/Buscar/hooks/useSearch.ts",
    "src/pages/Buscar/hooks/useDebouncedValue.ts",
    "src/pages/Buscar/lib/cursor.ts",
    "src/pages/Buscar/lib/normalize.ts"
  ],
  "reporters": ["progress", "clear-text", "json", "html"],
  "coverageAnalysis": "perTest",
  "thresholds": { "high": 90, "low": 75, "break": null },
  "timeoutMS": 30000,
  "concurrency": 4
}
```

```bash
# Rodar local
npx stryker run
```

### CI workflow nightly

```yaml
# .github/workflows/mutation-testing.yml
name: Mutation testing (nightly)

on:
  schedule:
    - cron: '0 3 * * *' # 3am UTC daily
  workflow_dispatch:

jobs:
  mutation-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup uv + Python
        uses: astral-sh/setup-uv@v3
      - name: Mutmut run
        run: |
          cd backend
          uv sync
          uv run mutmut run --runner "uv run pytest -x apps/search/tests/" \
            --simple-output \
            --no-progress > mutmut-results.txt || true

      - name: Parse results + open issue if score < 90%
        run: |
          # Parse mutmut-results.txt
          # if surviving / total > 0.10 → gh issue create
          uv run python scripts/mutation-report.py mutmut-results.txt

  mutation-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
      - name: Stryker run
        run: |
          npm ci
          npx stryker run --reporters json,clear-text > stryker-results.txt || true

      - name: Parse + open issue if score < 85%
        run: node scripts/mutation-report.js stryker-results.txt
```

### Thresholds

| Módulo                      | Surviving threshold | Justificativa                                                    |
| --------------------------- | ------------------- | ---------------------------------------------------------------- |
| `SearchService.query()`     | ≤10%                | Lógica de domínio crítica (cursor HMAC + ranking + recency)      |
| `apps/search/cursor.py`     | ≤5%                 | Segurança HMAC — tolerância mínima                               |
| `apps/search/normalize.py`  | ≤10%                | Invariante de simetria (ADR-040) — propriedades pegam parte      |
| `useSearch` (TS)            | ≤15%                | UI hook com side-effects + cache — algumas mutações equivalentes |
| `useDebouncedValue`         | ≤10%                | Timing crítico                                                   |
| `lib/cursor.ts` (FE decode) | ≤10%                | Segurança HMAC do FE side                                        |

### Issue automática

Quando threshold quebra, script abre issue no GitHub:

```markdown
**Mutation testing degradation — apps/search/services.py**

- Score atual: 78% (alvo: ≥90%)
- Mutações sobreviventes: 22 / 100
- Top 5 mutações sobreviventes:
  - L42: `recency_half_life > 60` → `recency_half_life >= 60`
  - L88: `cursor_depth < 50` → `cursor_depth <= 50`
  - L120: `score * recency_weight` → `score + recency_weight`
  - ...

**Ação**: ver `docs/tests/mutation-runbook.md` — adicionar test que mate cada mutante listado.
Ref: ADR-043, TEST-STRATEGY §9.3.
```

### Custo + cadência

- Backend mutmut: ~3min em 4 módulos × ~50 mutações cada
- Frontend Stryker: ~5min em 4 módulos
- Nightly = 0 custo de PR; ~8min de Actions runtime grátis (GitHub free tier: 2000min/mês).

### Positive Consequences

- **Coverage 85% deixa de ser tautológica** — mutações revelam testes fracos.
- **Detecção de regressão semântica** — mutação que altera `>` para `>=` em recency é pega.
- **Não bloqueia PR** — desenvolvedor não fica preso em "score caiu de 92% para 89%".
- **Issue automática** — débito técnico é tracking-friendly, não "lembre disso depois".
- **Custo zero financeiro** (free tier GitHub Actions absorve nightly).

### Negative Consequences

- **Mutantes equivalentes** (mutações que produzem comportamento idêntico — ex.: `i < 10` vs `i <= 9`) inflam falso positivo. Mitigação: marcar com `# pragma: no mutate` ou Stryker `// Stryker disable next-line`.
- **Tempo de feedback longo** — 24h entre run e correção. Aceitável dado custo.
- **Falsa precisão** — score absoluto varia entre runs por flakiness de testes timed; threshold é range, não valor exato.
- **Stack divergente** entre BE (mutmut) e FE (Stryker) — duas ferramentas, dois reports. Mitigação: script Python unifica output e abre issue formatada igual.
- **Manutenção do CI workflow** — schedule precisa rodar em DB-disponibilidade (Postgres efêmero).

## Pros and Cons of the Options

### Opção 1 — Coverage 85% only

- 👍 Zero custo extra.
- 👎 Coverage tautológica não pega regressão semântica.

### Opção 2 — Mutation nightly ⭐

- 👍 Detecção real de teste fraco; não bloqueia PR; custo absorvido.
- 👎 Mutantes equivalentes; stack BE/FE divergente.

### Opção 3 — Mutation em PR

- 👍 Garantia mais cedo.
- 👎 +5min por PR; desenvolvedor preso em score que oscila por flake.

### Opção 4 — Só property-based (ADR-040)

- 👍 Cobre invariantes universais.
- 👎 Não pega regressões em casos específicos — complementar, não substituto.

## Implementation Notes

- **Task IDs**:
  - **T30.1.TY12** (configurar mutmut + GitHub Action nightly) — 🟡 Normal, Sprint 5
  - Stryker FE — sub-task de TY12 (mesmo PR)
- **Pacotes**:
  - BE: `uv add --dev mutmut` (na verdade `uv add` é resolução; mutmut está no PyPI)
  - FE: `npm i -D @stryker-mutator/core @stryker-mutator/vitest-runner`
- **Arquivos**:
  - `backend/pyproject.toml` (config mutmut)
  - `stryker.conf.json` (raiz)
  - `.github/workflows/mutation-testing.yml`
  - `scripts/mutation-report.py` (BE parser + issue creator)
  - `scripts/mutation-report.js` (FE parser + issue creator)
  - `docs/tests/mutation-runbook.md` (como corrigir mutações sobreviventes)
- **Coordenação**:
  - **ADR-040** (property-based) — complementar; properties cobrem ∀; mutation cobre regressões pontuais
  - **ADR-041** (contract testing) — não substitui; cobre integration FE/BE, não unidade
  - **TEST-STRATEGY §6.3** — gate 85% coverage continua; este ADR adiciona qualidade ao 85%
- **Onboarding**: novo dev lê `docs/tests/mutation-runbook.md` antes de ignorar issue de mutation.

## Open Concerns

- **GitHub Actions free tier** (2000min/mês) absorve este workflow + outros nightly (k6 — ADR-044). Se workflows crescerem, considerar self-hosted runner em Sprint 7+.
- **Mutantes equivalentes** sem marcação automática — primeira execução vai produzir muitos falsos positivos; investimento de 1 sprint para baseline.
- **Stryker config para Vitest** ainda evoluindo (2026); validar compatibilidade com `vitest@2.x` no momento de implementação.
- **Documentar exceções** — algumas linhas (config, simples passthrough) são `# no mutate` justificadamente; runbook precisa de critério claro.

## References

- TEST-STRATEGY.md §2 (item 9 perf), §6.1 (mutation no pyramid), §8 (ADR-043 proposto), §9.3 (contestação)
- BACKLOG.md T30.1.TY12
- ADR-040 (property-based — complementar)
- ADR-041 (contract testing — complementar)
- ADR-021 (ranking ts_rank_cd + recency — alvo prioritário de mutation)
- ADR-021b (cursor HMAC caps — alvo prioritário de mutation)
- mutmut docs — `paths_to_mutate`, runners
- Stryker-JS docs — Vitest runner, thresholds, coverage analysis
- `docs/tests/testing-standards.md §2.11` — Mutation testing como extensão
- Pizzino et al. (2024) "Mutation testing in practice" — score baseline (~80% típico para módulos bem testados)
