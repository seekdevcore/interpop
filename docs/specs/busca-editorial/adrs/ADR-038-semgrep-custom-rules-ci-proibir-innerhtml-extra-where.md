# ADR-038: Semgrep custom rules em CI — proibir `dangerouslySetInnerHTML` em `apps.search` FE + `extra(where=)` no `SearchService`

- **Status**: Accepted
- **Date**: 2026-06-03
- **Tags**: security, devsecops, sast, semgrep, ci, comment-lock, regression-guard
- **Stakeholders**: cyber-security-architect (autor da review), backend-architect, frontend-architect, code-implementer
- **Layer**: Security / DevSecOps
- **Origin**: SECURITY-REVIEW.md §3 achado **M-01** (SQL injection guard) + §3 H-01 (XSS guard via highlight) + §7.3 contestação

## Context

Dois vetores documentados na SECURITY-REVIEW exigem **guard automatizado** contra regressão em PRs futuros:

### Vetor 1 — SQL injection via `extra(where=...)` (M-01, CWE-89)

`plainto_tsquery` protege a expressão tsquery contra SQL injection — mas **não** protege filtros opcionais construídos em Python. Se `code-implementer` (ou um dev em refactor futuro) optar por `.extra(where=[...])`, `RawSQL(...)` ou `.raw(...)` para montar filtros, perde-se o escape do ORM e abre-se vetor de injeção em filtro opcional (ex.: `?editoria=' OR 1=1 --`).

### Vetor 2 — XSS via `dangerouslySetInnerHTML` em `<HighlightedText>` (H-01, CWE-79)

DESIGN v3 + specialist UI/UX confirmam que `mark.js` usa **refs** (Node.textContent escape automático). Mas a SECURITY-REVIEW §7.3 contestou: **sem mecanismo automatizado**, um PR futuro pode substituir `mark.js` por regex+`innerHTML` ad-hoc e ativar XSS storage-like via `query_terms_expanded` (que reflete input).

### Princípio: defense in depth via SAST automatizado

Comment-lock no código (humano lê e respeita) é fraco — vive de disciplina. Linter rule customizada em CI é **forte** — bloqueia merge automaticamente. Os dois se complementam: comment-lock explica o motivo, semgrep impede a regressão.

ESLint `react/no-danger` cobre parcialmente o vetor 2 (avisa, não bloqueia merge sem config explícito). Semgrep é a ferramenta uniforme cross-language (Python + TypeScript) já considerada no roadmap §11.6 do `docs/planning/Improvement-system.md` e na S15-S17 do CLAUDE.md §6.

## Decision Drivers

- **Garantia mecânica** (não-humana) de invariantes de segurança.
- **Cross-language** — Python (`apps.search`) + TypeScript (`src/pages/Buscar/`) na mesma ferramenta.
- **Custo zero adicional** — Semgrep já é planejado no S15-S17 do CLAUDE.md §6 (testing-standards stack); este ADR antecipa por necessidade da feature crítica.
- **Block merge se violação** — não warning soft.
- **Mensagem clara ao dev**: aponta para SECURITY-REVIEW + ADR.

## Considered Options

1. **Confiar em comment-lock + code review humano** — rejeitado: humanos esquecem; PRs em sprint apertado passam.
2. **Semgrep custom rules em `.semgrep.yml` no CI** ⭐
3. **ESLint custom rule** (frontend) + **bandit custom check** (backend) — fragmentado; duas ferramentas.
4. **Pre-commit hook local sem CI** — opcional, fácil de pular; não bloqueia merge.

## Decision Outcome

**Chosen: Opção 2** — Semgrep com regras customizadas no repo, ativado em CI como step obrigatório.

### Configuração concreta

Arquivo `.semgrep.yml` na raiz do projeto:

```yaml
rules:
  - id: interpop-search-no-extra-where
    languages: [python]
    severity: ERROR
    message: |
      `.extra(where=)`, `RawSQL(...)` e `.raw(...)` perdem o escape do Django ORM.
      Em apps/search/, isso é vetor de SQL injection em filtros opcionais.
      Use parametrização explícita (cursor.execute(sql, params)) ou QuerySet.filter(Q(...)).
      Ver SECURITY-REVIEW.md M-01 + ADR-038.
    paths:
      include:
        - 'backend/apps/search/**/*.py'
    patterns:
      - pattern-either:
          - pattern: $X.extra(where=...)
          - pattern: $X.extra(where=$WHERE, ...)
          - pattern: RawSQL(...)
          - pattern: $X.raw(...)

  - id: interpop-search-no-dangerously-set-inner-html
    languages: [typescript, javascript]
    severity: ERROR
    message: |
      `dangerouslySetInnerHTML` em src/pages/Buscar/ ou src/components/Search* abre XSS
      via reflexão de `query_terms_expanded` (que ecoa input do usuário).
      Use mark.js com refs (Node.textContent escape automático) — padrão atual.
      Ver SECURITY-REVIEW.md H-01 + ADR-038.
    paths:
      include:
        - 'src/pages/Buscar/**/*.{ts,tsx,js,jsx}'
        - 'src/components/Search**/*.{ts,tsx,js,jsx}'
        - 'src/components/Highlighted*.{ts,tsx}'
    pattern: dangerouslySetInnerHTML={...}

  - id: interpop-search-no-inner-html-assignment
    languages: [typescript, javascript]
    severity: ERROR
    message: |
      Assignment direto a `.innerHTML` em código de busca = XSS storage-like.
      Manipule via textContent, createElement, ou mark.js wrapMatches com refs.
      Ver SECURITY-REVIEW.md H-01 + ADR-038.
    paths:
      include:
        - 'src/pages/Buscar/**/*.{ts,tsx,js,jsx}'
        - 'src/components/Search**/*.{ts,tsx,js,jsx}'
        - 'src/components/Highlighted*.{ts,tsx}'
    patterns:
      - pattern-either:
          - pattern: $X.innerHTML = $Y
          - pattern: $X.outerHTML = $Y
```

### CI step em `.github/workflows/ci.yml`

```yaml
- name: Semgrep custom rules (search hardening)
  uses: returntocorp/semgrep-action@v1
  with:
    config: .semgrep.yml
    severity: ERROR
    # Build falha se qualquer rule ERROR matar
```

Adicionalmente, **registro central** das regras + alinhamento com regras `p/django` e `p/react` do Semgrep registry — rodadas no mesmo job para cobertura ampla:

```yaml
- name: Semgrep registry rules (django + react)
  uses: returntocorp/semgrep-action@v1
  with:
    config: >-
      p/django
      p/react
      p/owasp-top-ten
```

### Local + pre-commit (defesa adicional, não substitui CI)

```yaml
# .pre-commit-config.yaml (adicionar)
- repo: https://github.com/returntocorp/semgrep
  rev: v1.50.0
  hooks:
    - id: semgrep
      args: ['--config=.semgrep.yml', '--error']
      pass_filenames: false
```

### Testes de meta-validação

Antes de ativar o gate, validar que as regras pegam violações reais:

```python
# tests/security/test_semgrep_rules.py (ou .github/workflows test)
# Smoke test: arquivo bait com violação intencional → semgrep retorna findings
def test_semgrep_detects_extra_where_bait():
    # apps/search/tests/_bait_extra_where_violation.py contém código bait
    # rodar semgrep, assert que findings > 0
    ...
```

### Positive Consequences

- **Bloqueia regressão automaticamente** — PR com `dangerouslySetInnerHTML` em search não merge.
- **Cross-language uniforme** — Python + TS na mesma ferramenta com mesma sintaxe.
- **Mensagem educativa** — dev vê motivo + link para ADR/SECURITY-REVIEW.
- **Antecipa investimento S15-S17** — Semgrep entra no projeto agora pela demanda concreta, prepara terreno para hardening geral.
- **Catch de PR futuro** — proteção persiste mesmo após autor original sair do projeto.

### Negative Consequences

- **Falso positivo possível** em refactors legítimos que usem `RawSQL` para perf justificável fora de busca — mitigação: regra escopada a `apps/search/**` apenas (não cobre apps que legitimamente precisem).
- **Custo CI marginal** (~15s rodando Semgrep no `apps/search/` e `src/pages/Buscar/`) — aceitável.
- **Manutenção da regra** — se padrão de código mudar (ex.: migração para `prisma` ORM hipotético), regra precisa update.
- **Tooling Semgrep precisa entrar no projeto agora** — antes do roadmap original S15-S17 (Sprint 1-2 do testing-standards). Trade-off: introdução cedo paga por ela mesma pela criticidade da feature.

## Pros and Cons of the Options

### Opção 1 — Comment-lock + review humano

- 👍 Zero tooling.
- 👎 Falha previsível em sprint apertado; comment-lock decay com tempo.

### Opção 2 — Semgrep custom rules ⭐

- 👍 Bloqueia merge; cross-language; antecipa S15-S17.
- 👎 Tooling novo no CI (~15s); manutenção da regra.

### Opção 3 — ESLint + bandit separados

- 👍 Cada ferramenta no idioma nativo.
- 👎 Fragmenta — duas configs, dois pipelines, dois pontos de falha.

### Opção 4 — Pre-commit local sem CI

- 👍 Sem custo CI.
- 👎 Devs podem pular (`--no-verify`); não vincula merge.

## Implementation Notes

- **Task ID**: **T30.4.X5** — 🟡 Normal, Sprint 4 (mas blocking: regra precisa estar em CI antes de Tasks T30.1.8 e T30.1.9 mergeerem)
- **Arquivo**: `.semgrep.yml` na raiz do repo
- **CI**: `.github/workflows/ci.yml` step novo `semgrep`
- **Pre-commit**: opcional (defesa em profundidade)
- **Testes**: arquivo bait com violação intencional + assertion que semgrep detecta
- **Coordenação**:
  - **T30.4.X1** (sanitização de `q` + comment-lock anti-`innerHTML` em `HighlightedText`) usa essas regras como guard
  - **T30.4.X4** (cache key + invariante de response) também usa pattern análogo para invariante de "no per-user fields" (futuro)
- **Documentação dev**: `docs/security/semgrep-rules.md` — lista todas as regras custom + motivo + link para ADR

## Open Concerns

- **Manutenção a longo prazo**: regra `interpop-search-no-extra-where` escopada por path; refactor de estrutura de pastas precisa atualizar `paths.include`. Adicionar comment no `.semgrep.yml` lembrando.
- **Cobertura incompleta de XSS**: Semgrep não cobre runtime composition (ex.: `setState(input)` que vira `innerHTML` via lib terceira). Mitigação: CSP `default-src 'self'` + WCAG axe-playwright (TY7 da TEST-STRATEGY).
- **Versionamento da regra**: bumping de Semgrep major pode mudar sintaxe; pin de versão obrigatório em CI.

## References

- SECURITY-REVIEW.md §3 M-01, §3 H-01, §7.3
- BACKLOG.md T30.4.X5
- ADR-035 (LGPD) — comment-lock na linha de defesa
- ADR-037 (cache key + invariante) — comment-lock análogo, futuro Semgrep rule
- Semgrep docs — Custom rules, Path filtering
- Semgrep Registry — `p/django`, `p/react`, `p/owasp-top-ten`
- OWASP ASVS V5.1, V5.2, V5.3 (validação de input/output)
- CWE-79 (XSS), CWE-89 (SQL injection)
- CLAUDE.md §6 — testing-standards stack (Semgrep planejado em S15-S17)
- `docs/planning/Improvement-system.md` §11.6
