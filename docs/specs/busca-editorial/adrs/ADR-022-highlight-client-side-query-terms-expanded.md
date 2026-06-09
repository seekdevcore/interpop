# ADR-022: Highlight client-side com `query_terms_expanded` do server (não só `q`)

- **Status**: Accepted (revisado v3)
- **Date**: 2026-06-03
- **Tags**: algorithms, frontend, highlight, stemming, pt-br, mark.js, csp-safe
- **Stakeholders**: algorithms-data-structures-architect (autor), frontend-architect, ui-ux-architect, cyber-security-architect, code-implementer
- **Layer**: Algorithms & Data Structures (server contract) + Frontend (consumer)

## Context

Highlight de termos de busca exige casar a query do usuário com o texto do resultado. Em pt-BR, **stemming é crítico**:

- Usuário busca `cantores` → tsvector normalizou para stem `cantor` (via `portuguese_stem` em `pt_unaccent`).
- Resultado contém "cantor" no título. `mark.js` puro (com `q="cantores"`) **NÃO destaca** "cantor". UX percebida: "busca encontrou mas não mostra por quê".

Forças:

- Client-side puro `mark.js` é 6KB gzipped, CSP-safe (refs, não `dangerouslySetInnerHTML`), zero round-trip extra. Mas não tem stemmer pt-BR.
- Client-side com `snowball-stemmers` ou RSLP adiciona +8KB e ainda tem drift potencial entre stemmer cliente vs Postgres `portuguese_stem`.
- Server tem `ts_lexize('portuguese_stem', token)` — uma chamada SQL barata, retorna stem canônico.
- **Drift entre normalização indexing e highlight = bug silencioso** (Invariante 2 do specialist `algorithms-data-structures-architect`).

## Decision Drivers

- Highlight correto pt-BR (plurais, conjugações, acentos)
- Zero bundle JS extra
- Determinismo (mesma query → mesmos stems → mesmo highlight)
- CSP-safe (sem `dangerouslySetInnerHTML`)
- Single source of truth para normalização (server = autoridade)

## Considered Options

1. **mark.js puro com `q` original** — não casa stems pt-BR.
2. **mark.js + snowball-stemmers cliente** — +8KB; risco de drift cliente↔server.
3. **Server retorna `query_terms_expanded: string[]` (stems pt-BR)** ⭐ — exato, zero KB cliente, +~5ms server.
4. **Server pré-renderiza `<mark>` no HTML do excerpt** — XSS surface; SSR (DESIGN é CSR).

## Decision Outcome

**Chosen: Opção 3**.

### Contrato do server

```json
{
  "results": [...],
  "next_cursor": "...",
  "total_estimate": 142,
  "query_terms_expanded": ["cantor", "brasil"]
}
```

Backend gera via:

```sql
SELECT array_agg(stem)
FROM (
  SELECT ts_lexize('portuguese_stem', token)[1] AS stem
  FROM unnest(string_to_array(:q_norm, ' ')) AS token
  WHERE token NOT IN (SELECT word FROM stopwords_pt)
) s
WHERE stem IS NOT NULL;
```

Custo ~5ms na response (acceptable budget §3.3 DESIGN).

### Frontend uso

```tsx
<HighlightedText text={article.title} terms={data.query_terms_expanded} />
```

Componente `<HighlightedText>` usa `mark.js` via refs (não `dangerouslySetInnerHTML`):

```tsx
const ref = useRef<HTMLDivElement>(null);
useEffect(() => {
  if (!ref.current) return;
  const instance = new Mark(ref.current);
  instance.unmark({
    done: () => {
      instance.mark(terms, {
        accuracy: 'complementary',
        separateWordSearch: false,
      });
    },
  });
}, [text, terms]);
```

Termos extras: o frontend também adiciona variantes simples (sem hífen) para queries compostas (`k-pop` → também tenta `kpop`) — mas autoridade é o server.

### XSS surface

`query_terms_expanded` reflete input do usuário (após normalização + stem). Atacante envia `q="<script>"` → após normalize + lexize, vira string vazia ou stem inócuo. Mesmo assim:

- **Cyber-security review** (SECURITY-REVIEW.md) confirma: frontend **deve escapar** cada term antes de passar ao `mark.js`. `Mark.mark(terms, ...)` trata cada item como string literal (escape interno) — confirmar versão.
- Test obrigatório: payload `<script>` em `q` → `query_terms_expanded` no JSON resposta nunca contém `<` ou `>` (assert no contract test).

### Positive Consequences

- Highlight pt-BR correto (stems casam plurais/conjugações).
- Zero KB extra no bundle JS (só `mark.js` 6KB já planejado).
- Server é fonte única de verdade para normalização — sem drift.
- CSP-safe — sem `dangerouslySetInnerHTML`.
- Determinístico e testável (property-based: mesma `q` → mesmos stems).

### Negative Consequences

- +5ms na response (acceptable).
- Acoplamento frontend↔backend: mudança no `portuguese_stem` (upgrade Postgres) muda highlight. Mitigação: contract test.
- Compostos com hífen (`k-pop`) exigem normalização simétrica adicional (ADR-021 + T30.1.X2).
- Variantes de pessoa/tempo verbal sem stem comum (raro pt-BR) não casam.

## Implementation Notes

- **Task IDs**: T30.1.X5 (response shape `query_terms_expanded`), T30.1.X10 (`<HighlightedText>` com refs)
- **Backend**: adicionar campo no `SearchResultSerializer`; gerar stems no `SearchService.query()`
- **Frontend**: componente `<HighlightedText text terms>` em `src/pages/Buscar/components/`
- **Tokens**: `--clr-highlight-bg` + `--clr-highlight-on` (auditados WCAG AA em ADR-029)
- **Test**: integration (`q="cantores"`, resultado contém "cantor" → highlighted), contract (`query_terms_expanded` nunca contém tag HTML), property-based (`q` adversarial → stems sempre alfanuméricos)
- **Referência DESIGN.md**: §2.3 (specialist output), §3.7 (highlighting end-to-end)
- **Referência specialist**: `_specialist-outputs/02-algorithms-architect.md` linhas 97-108

## References

- DESIGN.md §2.3, §3.7
- `_specialist-outputs/02-algorithms-architect.md`
- ADR-019 (CONFIGURATION pt_unaccent — define stemmer canônico)
- ADR-021 (recency + ranking — define normalização)
- ADR-029 (tokens de highlight WCAG AA)
- ADR-035+ (SECURITY-REVIEW — confirmação CSP/escape)
- `mark.js` docs — `accuracy: 'complementary'`, `separateWordSearch`
- Postgres docs — `ts_lexize`
