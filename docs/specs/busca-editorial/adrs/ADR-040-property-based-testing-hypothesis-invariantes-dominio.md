# ADR-040: Property-based testing obrigatório via Hypothesis para `normalize_search_text()`, cursor `encode/decode`, `estimate_total()`

- **Status**: Accepted
- **Date**: 2026-06-03
- **Tags**: testing, property-based, hypothesis, invariants, domain-logic, tdd
- **Stakeholders**: testing-engineer (autor da strategy), algorithms-data-structures-architect, backend-architect, code-implementer
- **Layer**: Testing
- **Origin**: TEST-STRATEGY.md §8 + §9.4 contestação anti-sycophancy

## Context

Os 12 invariantes do `algorithms-data-structures-architect` (DESIGN §2.3 + specialist 02 §8) contêm **5 propriedades por definição** (não casos específicos):

1. **Determinismo** (Inv 1) — para qualquer `(q, filters, cursor)`, `SearchService.query()` × N runs retorna mesma ordem.
2. **Simetria de normalização** (Inv 2) — `normalize_search_text(idx_text) == normalize_search_text(query_text)` para qualquer string Unicode.
3. **Idempotência de normalização** — `normalize(normalize(s)) == normalize(s)` (derivada de Inv 2).
4. **Round-trip de cursor** (Inv 5+6) — `decode_cursor(encode_cursor(score, pub, id)) == (round(score, 6), pub, id)` para qualquer float em [0, 1] e UUID válido.
5. **Cap de tokens** (Inv 8) — `len(cap_tokens(s)) <= 8` para qualquer string.

A TEST-STRATEGY §9.4 contestou (anti-sycophancy): o DESIGN v3 **não menciona property-based testing** apesar dessas propriedades serem natural fit. Casos manuais cobrem exemplos típicos; Hypothesis gera **edge cases** que humanos não imaginam (strings com U+200B zero-width space, floats em underflow IEEE 754, UUIDs com prefixos 0x00).

Adicionalmente, `estimate_total()` (ADR-025 — `total_estimate` via EXPLAIN com floor) tem propriedade verificável: para qualquer ground truth `n_real`, `estimate >= floor(len(results))` E `estimate <= 10 * n_real` (limite superior de erro plan estimate).

Sem property-based, esses invariantes ficam **declarados, não provados** — risco de regressão silenciosa em refactor (ex.: trocar `unicodedata.normalize('NFKD', s)` por algo "mais simples").

## Decision Drivers

- **Provar propriedades, não testar casos** — invariantes são afirmações universais (∀x: P(x)).
- **Cobrir edge cases Unicode/IEEE 754** automaticamente — humanos não geram U+200B, U+FEFF, IEEE subnormals.
- **Documentação executável** — `@given(text())` lê como "para todo texto, vale que…".
- **Compatibilidade com stack existente** — Hypothesis é nativo pytest, integra com `pytest-django`.
- **Custo CI aceitável** (~12s para 5 propriedades × 100 examples cada).

## Considered Options

1. **Manter só casos manuais** (DESIGN v3 atual) — rejeitado por §9.4.
2. **Hypothesis 6+ obrigatório para 5 invariantes-propriedade** ⭐
3. **Fuzz testing dedicado** (atheris, americanfuzzylop) — overkill para o escopo; sem integração pytest.
4. **QuickCheck-style implementação manual** — reinventar Hypothesis; pior em todos os eixos.

## Decision Outcome

**Chosen: Opção 2** — Hypothesis como obrigatório para os 5 invariantes-propriedade. Pyramid não muda significativamente (5 testes property-based adicionais em ~110 totais — 4,5%).

### Setup

```bash
# backend
uv add hypothesis>=6.100
```

```python
# backend/conftest.py
from hypothesis import settings, HealthCheck

# Profile padrão CI: 100 examples, deadline 200ms por example
settings.register_profile("ci",
    max_examples=100,
    deadline=200,
    suppress_health_check=[HealthCheck.too_slow],
)
settings.register_profile("dev",
    max_examples=20,
    deadline=500,
)
settings.load_profile("ci" if os.getenv("CI") else "dev")
```

### 5 propriedades a cobrir

#### Property 1 — `normalize_search_text` idempotência

```python
# apps/search/tests/test_properties.py
from hypothesis import given, strategies as st

@given(st.text(min_size=0, max_size=500))
def test_normalize_is_idempotent(s):
    """∀ s: normalize(normalize(s)) == normalize(s)"""
    assert normalize_search_text(normalize_search_text(s)) == normalize_search_text(s)
```

#### Property 2 — `normalize` simetria semântica (K-Pop ≡ kpop)

```python
# Conjunto reduzido: variações case + hifenizadas devem colapsar
@given(st.text(alphabet=st.characters(min_codepoint=0x20, max_codepoint=0x7E),
               min_size=1, max_size=50))
def test_normalize_collapses_case_and_hyphens(s):
    """∀ s: normalize(s.upper()) == normalize(s.lower())"""
    # case-folding garantido
    assert normalize_search_text(s.upper()) == normalize_search_text(s.lower())
    # hifens internos removidos consistentemente
    assert normalize_search_text(s) == normalize_search_text(s.replace("-", ""))
```

#### Property 3 — Cursor encode/decode round-trip preserva ROUND(6)

```python
@given(
    score=st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False),
    published_at=st.datetimes(min_value=datetime(2000, 1, 1), max_value=datetime(2030, 12, 31)),
    article_id=st.uuids(),
)
def test_cursor_round_trip_preserves_round_6(score, published_at, article_id):
    """∀ (score, pub, id): decode(encode(...)) == (round(score, 6), pub, id)"""
    cursor_token = encode_cursor(score, published_at, article_id)
    decoded_score, decoded_pub, decoded_id = decode_cursor(cursor_token)
    assert decoded_score == round(score, 6)
    assert decoded_pub == published_at
    assert decoded_id == article_id
```

#### Property 4 — Determinismo de `SearchService.query`

```python
@given(
    q=st.text(min_size=2, max_size=50, alphabet=st.characters(whitelist_categories=('L', 'N', 'Zs'))),
)
@settings(deadline=2000)  # query DB é mais cara
def test_query_is_deterministic_across_5_runs(q):
    """∀ q: query()  × 5 retorna mesma ordem"""
    runs = [SearchService.query(QuerySpec(q=q, filters={}, cursor=None)) for _ in range(5)]
    first = [r.article_id for r in runs[0].results]
    for run in runs[1:]:
        assert [r.article_id for r in run.results] == first
```

#### Property 5 — Cap de tokens ≤8

```python
@given(st.text(min_size=0, max_size=500))
def test_cap_tokens_never_exceeds_8(s):
    """∀ s: len(cap_tokens(s)) <= 8"""
    assert len(cap_tokens(s)) <= 8
```

### Estratégia de geração (custom strategies)

Para propriedades específicas de domínio, registrar strategies em `apps/search/tests/strategies.py`:

```python
@st.composite
def search_queries(draw):
    """Gera queries realistas (pt-BR com acentos, símbolos, hifens)."""
    return draw(st.text(
        alphabet=st.characters(
            whitelist_categories=('L', 'N', 'Zs', 'Pd', 'Pc'),
            blacklist_categories=('Cc',),  # controle chars
        ),
        min_size=1, max_size=100,
    ))
```

### `estimate_total()` (ADR-025) — propriedade adicional

```python
@given(
    n_real=st.integers(min_value=0, max_value=10_000),
)
def test_estimate_total_floor_invariant(n_real):
    """∀ n_real: estimate >= len(results); estimate <= 10 * n_real (limite plan EXPLAIN)"""
    # fixture: popula DB com n_real artigos, executa search.estimate_total()
    estimate = SearchService.estimate_total(query_spec, results_returned=min(20, n_real))
    assert estimate >= min(20, n_real)
    assert estimate <= max(10 * n_real, 100)  # planejador erra pra cima até 10x
```

### Shrinking + repro

Hypothesis shrinka contra-exemplos para o mínimo. Quando falha, output inclui input minimal — facilita debug. Cada falha automaticamente vira regression test via `@example()` decorator no commit do fix.

### Positive Consequences

- **Cobre edge cases não-óbvios** — strings com U+200B, floats subnormais, UUIDs com prefix 0x00.
- **Provas executáveis dos invariantes** — declaração + verificação no mesmo arquivo.
- **Detecção precoce de regressão** — refactor que quebra simetria gera falha em ~5min de CI.
- **Documentação semântica** — `@given(text())` lê como spec formal.
- **Shrinking** dá contra-exemplo minimal para debug.

### Negative Consequences

- **Tempo CI +12s** (5 propriedades × 100 examples × ~24ms média).
- **Flake potencial** se propriedade tem dependência externa (DB lento) — mitigação: `@settings(deadline=...)` calibrado por propriedade.
- **Learning curve** para o time — Hypothesis tem idioms próprios; investimento em onboarding.
- **`@given` + Django DB** exige `@django_db` + cuidado com transações — documentar em runbook de testes.

## Pros and Cons of the Options

### Opção 1 — Só casos manuais

- 👍 Zero tooling novo.
- 👎 Não cobre edge cases sistematicamente; regressões silenciosas.

### Opção 2 — Hypothesis ⭐

- 👍 Edge cases automáticos; shrinking; integração pytest nativa.
- 👎 +12s CI; learning curve.

### Opção 3 — Fuzz testing dedicado

- 👍 Cobertura ampla.
- 👎 Sem integração pytest; overkill para o escopo; setup separado.

### Opção 4 — Implementação manual QuickCheck-style

- 👍 Sem dependência externa.
- 👎 Reinventa Hypothesis; pior em manutenção e shrinking.

## Implementation Notes

- **Task IDs**:
  - **T30.1.TY1** (setup Hypothesis + conftest) — 🟠 High, Sprint 4
  - **T30.1.TY8** (5 testes property-based) — 🟠 High, Sprint 4
- **Pacote**: `hypothesis>=6.100` via `uv add hypothesis`
- **Arquivos**:
  - `backend/conftest.py` (profile registration)
  - `apps/search/tests/test_properties.py` (5 propriedades)
  - `apps/search/tests/strategies.py` (custom strategies)
- **Pyramid impact**: +5 testes property-based em ~110 totais (~4.5%)
- **Coordenação**:
  - **ADR-021** (ts_rank_cd + recency) → property de determinismo
  - **ADR-025** (estimate_total) → property de floor + upper bound
  - **ADR-021b** (cursor HMAC) → property de round-trip
  - **TX-20** (trigger test protocol) — properties que dependem de DB usam marker `requires_postgres`
- **Documentação dev**: `docs/tests/property-based-guide.md` — quando preferir property vs case, idioms Hypothesis, shrinking + repro.

## Open Concerns

- **`@given` com DB queries** pode virar lento se 100 examples × 200ms = 20s por propriedade. Mitigação: factory `build` (não `create`) sempre que possível; `transaction.atomic + rollback` no teardown.
- **Hypothesis examples database** (cache de contra-exemplos) versionar no git? Sim, em `.hypothesis/examples/` — garante repro entre devs.
- **Cobertura percentual** de Hypothesis: cada example incrementa coverage; relatório pode mostrar 100% sem invariante real provado. Mitigação: ADR-043 (mutation testing) cobre o risco de "coverage tautológica".

## References

- TEST-STRATEGY.md §2 (item 1 unit + property-based), §4 (invariantes mapping), §8 (ADR-040 proposto), §9.4 (contestação)
- BACKLOG.md T30.1.TY1, T30.1.TY8
- DESIGN.md §2.3 (12 invariantes); specialist 02 §8-9
- ADR-021, ADR-021b, ADR-025 (invariantes que viram propriedades)
- Hypothesis docs — `@given`, `strategies`, `@settings`, profiles
- `superpowers:test-driven-development` — disciplina TDD aplicada a properties
- `docs/tests/testing-standards.md §2.11` — Property-based testing como extensão
