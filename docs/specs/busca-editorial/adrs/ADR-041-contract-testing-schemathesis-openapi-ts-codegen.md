# ADR-041: Contract testing OpenAPI ↔ TS via schemathesis — falha de build TS bloqueia merge

- **Status**: Accepted
- **Date**: 2026-06-03
- **Tags**: testing, contract-testing, schemathesis, openapi, drf-spectacular, openapi-typescript, ci-gate
- **Stakeholders**: testing-engineer (autor da strategy), backend-architect, frontend-architect, code-implementer
- **Layer**: Testing / CI
- **Origin**: TEST-STRATEGY.md §8 + §9.5 contestação anti-sycophancy

## Context

O pipeline planejado para o contrato frontend ↔ backend é:

1. Django + DRF expõe `SearchSerializer`
2. `drf-spectacular` (TX-06) gera `schema.yaml` (OpenAPI 3) de `/api/schema/`
3. `openapi-typescript` (TX-07) consome `schema.yaml` e gera tipos `.d.ts`
4. Frontend importa tipos e tipa `useSearch` com eles
5. `npm run typecheck` rejeita drift

TEST-STRATEGY §9.5 contestou (anti-sycophancy):

- O pipeline garante que **tipos TS refletem schema OpenAPI**.
- O pipeline **NÃO garante** que **respostas reais da view** batem com o schema.
- Mudança em `SearchSerializer.Meta.fields` que `drf-spectacular` introspect parcialmente (ex.: `SerializerMethodField` sem hint), ou view que retorna campo extra fora do serializer → **drift silencioso** entre OpenAPI declarado e resposta real.
- Frontend continua com tipo correto vs OpenAPI, mas backend produz dados que não casam → runtime error em produção sem warning em CI.

Vetor concreto: dev adiciona `bookmarked = serializers.SerializerMethodField()` sem `@extend_schema_field(bool)` → spectacular gera tipo `Any` → TS aceita qualquer coisa → runtime quebra em mobile.

**Schemathesis** ataca esse gap: gera requests via Hypothesis sobre o schema OpenAPI, valida que **respostas reais** batem com schema declarado. É property-based contract testing.

CWE: drift entre spec e implementação ≈ CWE-1059 (Incomplete Documentation) com risco operacional.

## Decision Drivers

- **Garantir que OpenAPI = realidade** (não só "OpenAPI = tipos TS").
- **Detecção precoce** — runtime de mock no CI, não em produção mobile.
- **Reuso do pipeline existente** (drf-spectacular + Hypothesis já adotados pelo ADR-040).
- **Bloqueio de merge** — drift = build falha.
- **Compatibilidade com DRF** — schemathesis fala OpenAPI 3, compatível com `drf-spectacular`.

## Considered Options

1. **Confiar no pipeline TX-06 + TX-07 + typecheck** (DESIGN v3 atual) — rejeitado por §9.5.
2. **Schemathesis no CI rodando contra `/api/schema/`** ⭐
3. **Dredd** — alternativa mais antiga; pior suporte a OpenAPI 3.
4. **Pact contract testing** — consumer-driven, overkill para single FE consumer + single BE.
5. **Postman collection runner** — manual, não bloqueia merge.

## Decision Outcome

**Chosen: Opção 2** — Schemathesis no CI como step próprio. Gate de merge: build falha se schemathesis detectar resposta real fora do schema declarado.

### Setup

```bash
# Adicionar dependência de dev (não vai pra prod)
uv add --dev schemathesis>=3.27
```

### Config

```bash
# Comando canônico (rodado no CI após server start)
schemathesis run \
  http://localhost:8000/api/schema/ \
  --endpoint /api/v1/search/articles/ \
  --hypothesis-max-examples=50 \
  --checks all \
  --workers 2 \
  --base-url http://localhost:8000
```

`--checks all` ativa:

- `not_a_server_error` — nenhuma 5xx
- `status_code_conformance` — status retornado declarado no schema
- `content_type_conformance` — content-type bate
- `response_schema_conformance` — corpo da resposta bate com schema
- `response_headers_conformance` — headers (incluindo `Vary` de ADR-037)

### CI step em `.github/workflows/ci.yml`

```yaml
- name: Start Django for contract test
  run: |
    cd backend
    uv run python manage.py migrate
    uv run python manage.py loaddata fixtures/search_smoke.json
    uv run python manage.py runserver 0.0.0.0:8000 &
    sleep 5  # wait for boot

- name: Schemathesis contract test
  run: |
    cd backend
    uv run schemathesis run \
      http://localhost:8000/api/schema/ \
      --endpoint "/api/v1/search/articles/" \
      --hypothesis-max-examples=50 \
      --checks all \
      --workers 2 \
      --report-junit-xml=test-reports/schemathesis.xml
  # falha bloqueia merge
```

### Fixtures de seed para schemathesis

```json
// backend/fixtures/search_smoke.json
[
  {
    "model": "articles.article",
    "fields": {
      "title": "Beyoncé Renaissance review",
      "status": "published",
      "published_at": "2026-01-15T10:00:00Z",
      ...
    }
  },
  // 50 artigos com diversidade de campos
]
```

### Casos cobertos automaticamente

Schemathesis com `--checks all` detecta:

| Cenário                                                                             | O que pega                                                                                                |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| View retorna 500 inesperado para input borderline                                   | `not_a_server_error`                                                                                      |
| Endpoint declara 200 mas retorna 204 em caso de zero resultados                     | `status_code_conformance`                                                                                 |
| Schema declara `query_terms_expanded: string[]` mas view retorna `null`             | `response_schema_conformance`                                                                             |
| Schema declara `cache_status: enum[HIT, MISS]` mas view retorna `"STALE"`           | `response_schema_conformance`                                                                             |
| Schema declara header `Vary: Authorization` mas view não envia                      | `response_headers_conformance`                                                                            |
| Adição de campo `bookmarked: bool` no SerializerMethodField sem extend_schema_field | Schema gera `Any` → schemathesis aceita; pega no `response_schema_conformance` quando valor real conflita |
| Request com `q` Unicode obscuro causa 5xx                                           | `not_a_server_error`                                                                                      |

### Integração com Hypothesis (compartilha base)

`schemathesis` usa Hypothesis internamente — `max_examples`, `deadline`, profile registration são compatíveis. Pode reusar `conftest.py` registrado para ADR-040.

### Bloqueio de merge

```yaml
# .github/workflows/ci.yml
- name: Merge gate
  if: failure() && github.event_name == 'pull_request'
  run: |
    echo "::error::Contract test falhou — OpenAPI schema não bate com resposta real. Ver ADR-041."
    exit 1
```

### Positive Consequences

- **Drift OpenAPI ↔ realidade detectado no PR** — antes de chegar em mobile/produção.
- **Cobertura ampla** — Hypothesis gera 50 inputs aleatórios incluindo edge cases.
- **Catch automático de `SerializerMethodField` sem hint** — vetor real.
- **Headers de segurança verificados** — `Vary`, `Cache-Control`, `X-Robots-Tag` (de ADR-037 e T30.4.X11).
- **Compatível com pipeline existente** — reusa drf-spectacular e Hypothesis.

### Negative Consequences

- **Tempo CI +~8s** (50 examples sobre 1 endpoint).
- **Requer server rodando em CI** — startup de Django + migrate + fixtures (~10s overhead).
- **Falsos positivos possíveis** se schema declara constraints mais frouxas que view real (ex.: schema diz `string` mas view sempre retorna UUID; tecnicamente OK, mas schema deveria refletir). Mitigação: docs apontam para corrigir schema, não relaxar test.
- **Mais 1 dep dev** (schemathesis); manutenção de versão.

## Pros and Cons of the Options

### Opção 1 — Só TX-06 + TX-07 + typecheck

- 👍 Zero novo tooling.
- 👎 Drift silencioso entre OpenAPI e resposta real — vetor documentado.

### Opção 2 — Schemathesis ⭐

- 👍 Property-based; cobre headers + body + status + content-type; bloqueia merge.
- 👎 +8s CI; startup Django no CI.

### Opção 3 — Dredd

- 👍 Mais antigo, comunidade grande.
- 👎 Suporte fraco a OpenAPI 3 moderno; sem property-based; UX ruim.

### Opção 4 — Pact

- 👍 Padrão de fato em contract testing.
- 👎 Consumer-driven; over-engineering para 1 BE + 1 FE; mais infra (Pact broker).

### Opção 5 — Postman collection

- 👍 GUI familiar.
- 👎 Manual, não bloqueia merge, não property-based.

## Implementation Notes

- **Task ID**: **T30.1.TY9** — 🟠 High, Sprint 4
- **Pacote**: `schemathesis>=3.27` via `uv add --dev`
- **Arquivos**:
  - `.github/workflows/ci.yml` (step novo)
  - `backend/fixtures/search_smoke.json` (50 artigos seed)
  - `backend/conftest.py` (compartilhado com ADR-040 Hypothesis profile)
- **Coordenação**:
  - **TX-06** (drf-spectacular setup) é pré-requisito direto
  - **TX-07** (openapi-typescript) continua funcionando — `npm run typecheck` no FE
  - **ADR-040** (property-based) — mesma stack Hypothesis, profile compartilhado
- **Ampliação futura**: extender para todos os endpoints `/api/v1/*` em Sprint 5+ (não só busca). Este ADR estabelece padrão.
- **Documentação dev**: `docs/tests/contract-testing.md` — quando rodar local (debug), como ler output, como adicionar fixtures.

## Open Concerns

- **`--hypothesis-max-examples=50` é trade-off** entre cobertura e tempo CI. Subir para 100 em nightly schedule se latência permitir; manter 50 em PR check (custo +8s).
- **Server runtime em CI** adiciona pontos de falha (port collision, race condition no boot). Mitigação: `wait-on http://localhost:8000/healthz/` antes do schemathesis.
- **Headers de cache (`Vary`)** dependem de fixtures que ativem cache hit — preparar 2 calls back-to-back na suíte.
- **Drift propagação**: quando schema mudar legitimamente, dev precisa regenerar `.d.ts` via openapi-typescript **E** ajustar fixtures se schemathesis começar a quebrar com novos casos.

## References

- TEST-STRATEGY.md §2 (item 4 contract), §6.1 (4 contract tests planejados), §8 (ADR-041 proposto), §9.5 (contestação)
- BACKLOG.md T30.1.TY9
- ADR-023 (endpoint /api/v1/search/articles/) — superfície sob teste
- ADR-037 (Vary header) — verificado por `response_headers_conformance`
- ADR-040 (property-based Hypothesis) — stack compartilhada
- TX-06, TX-07 (pipeline OpenAPI ↔ TS) — pré-requisitos
- Schemathesis docs — `--checks`, integração CI, Hypothesis profile
- `docs/tests/testing-standards.md §2.11` — Contract testing como extensão
- OWASP API Top 10 #8 (Security Misconfiguration — drift schema/runtime)
