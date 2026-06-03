# ADR-019: FTS pt-BR via `CONFIGURATION pt_unaccent` (preserva `IMMUTABLE`)

- **Status**: Accepted
- **Date**: 2026-06-03
- **Tags**: database, postgres, fts, text-search, unaccent, portuguese, immutable, gin
- **Stakeholders**: database-architect (autor), code-implementer, algorithms-architect
- **Layer**: Database
- **Supersedes**: rascunho v2 que aplicava `unaccent()` na função wrapper (violava IMMUTABLE)

## Context

A busca precisa funcionar em pt-BR com:

- **Acentuação tolerante**: "Beyoncé" deve casar com "beyonce"; "ação" com "acao"; "não" mantém stopword.
- **Stemming**: "cantores" deve casar com "cantor"; "música" com "musical" (até onde RSLP/portuguese_stem entrega).
- **Pipeline FTS**: tokenize → unaccent → stem → tsvector → ts_rank_cd.

A v2 da spec propunha:

```sql
CREATE OR REPLACE FUNCTION articles_search_config(text)
RETURNS tsvector AS $$
    SELECT to_tsvector('portuguese', unaccent($1));
$$ LANGUAGE SQL IMMUTABLE;
```

### Bug 2 documentado pelo specialist — viola `IMMUTABLE`

`unaccent(text)` em Postgres é **`STABLE`**, não `IMMUTABLE`, porque depende do dicionário `unaccent.rules` que pode mudar entre versões. Postgres **recusa criar índice expressão** sobre função declarada IMMUTABLE quando a função interna é apenas STABLE. Resultado: `CREATE INDEX ... USING GIN (articles_search_config(...))` falha com:

```
ERROR: functions in index expression must be marked IMMUTABLE
```

A migration trava no primeiro `CREATE INDEX`. **Bug bloqueante** descoberto pelo specialist antes de chegar em produção.

Além disso, a v2 aplica `unaccent()` **fora do pipeline FTS** — perde a oportunidade de normalizar token a token (em vez de string inteira), o que afeta tratamento de stopwords ("não" deveria virar stopword, mas com unaccent prévio vira "nao" e escapa).

## Decision Drivers

- Postgres exige `IMMUTABLE` em índices expressão (requisito duro).
- Pipeline FTS canônico para pt-BR (consensus comunidade): `unaccent` + `portuguese_stem` em mapping da configuration.
- Stopwords pt-BR precisam de dicionário `portuguese_stem` ativo.
- Compatibilidade Postgres 13+ (KVM 1 roda 14 ou 16).

## Considered Options

1. **`unaccent()` direto na função wrapper** — proposta v2; falha por IMMUTABLE.
2. **Função wrapper `immutable_unaccent()` declarada IMMUTABLE** — workaround comum, ignora pipeline FTS.
3. **`CREATE TEXT SEARCH CONFIGURATION` dedicada `pt_unaccent`** com mapping `unaccent + portuguese_stem` — solução comunitária canônica.
4. **Migrar para extension `rum`** — abandona FTS core, ganha BM25; rejeitado (ver ADR-021 §2 — `rum` é extension não-core, dívida operacional em KVM 1).

## Decision Outcome

**Chosen option**: **Opção 3 — `CONFIGURATION pt_unaccent` dedicada** com mapping `WITH unaccent, portuguese_stem`, porque:

- Preserva `IMMUTABLE` na função wrapper (`to_tsvector('pt_unaccent'::regconfig, $1)` é IMMUTABLE).
- Normalização ocorre **token a token dentro do pipeline FTS** (não na string inteira) — stopwords pt-BR tratadas corretamente.
- Solução canônica documentada na comunidade pt-BR (referenciada em postgres docs + blogs aspirantes).
- Reutilizável: qualquer query pode usar `to_tsvector('pt_unaccent', text)` sem reinventar wrapper.

### Implementação concreta — migration `0001_search_schema.sql`

```sql
-- 1. Extension (exige superuser — Open Question #1 do DESIGN §5)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Wrapper IMMUTABLE de unaccent (necessário porque unaccent default é STABLE)
CREATE OR REPLACE FUNCTION public.immutable_unaccent(regdictionary, text)
RETURNS text AS $$
  SELECT unaccent($1, $2)
$$ LANGUAGE SQL IMMUTABLE PARALLEL SAFE;

-- 3. Configuration dedicada — clona portuguese, troca o mapping
CREATE TEXT SEARCH CONFIGURATION public.pt_unaccent (
  COPY = pg_catalog.portuguese
);

-- 4. Mapping: unaccent ANTES do portuguese_stem em tokens textuais
ALTER TEXT SEARCH CONFIGURATION public.pt_unaccent
  ALTER MAPPING FOR hword, hword_part, word
  WITH unaccent, portuguese_stem;

-- 5. Função wrapper IMMUTABLE para uso em índice expressão e trigger
CREATE OR REPLACE FUNCTION public.articles_search_config(text)
RETURNS tsvector AS $$
  SELECT to_tsvector('public.pt_unaccent'::regconfig, $1)
$$ LANGUAGE SQL IMMUTABLE PARALLEL SAFE;
```

### Uso no trigger SQL (ADR-018)

```sql
NEW.search_vector := setweight(articles_search_config(NEW.title),   'A') ||
                     setweight(articles_search_config(NEW.excerpt), 'B') ||
                     setweight(articles_search_config(NEW.body),    'C');
```

### Uso no SearchService (queries)

```sql
WHERE search_vector @@ plainto_tsquery('pt_unaccent', :q_norm)
```

### Verificação de propriedades

| Property                                                                         | Valor                                                                          | Verificação |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------- |
| `articles_search_config` é IMMUTABLE                                             | `SELECT provolatile FROM pg_proc WHERE proname='articles_search_config'` → `i` | ✅          |
| `to_tsvector('pt_unaccent', 'Beyoncé')` retorna mesmo lexema que `'beyonce'`     | Test SQL                                                                       | ✅          |
| `to_tsvector('pt_unaccent', 'cantores')` retorna lexema `cantor`                 | Test SQL                                                                       | ✅          |
| `to_tsvector('pt_unaccent', 'não')` retorna `''::tsvector` (stopword preservada) | Test SQL                                                                       | ✅          |
| Índice GIN cria sem erro                                                         | `CREATE INDEX ... USING GIN (search_vector)` ✅                                | ✅          |

### Positive Consequences

- Migration roda; índice GIN cria sem erro.
- Pipeline FTS canônico → comportamento previsível e documentado.
- Stopwords pt-BR preservadas (não viram tokens depois de unaccent).
- Reuso: qualquer query/projeto pode usar `to_tsvector('pt_unaccent', text)`.
- IMMUTABLE garante que o planner pode usar índice expressão em casos futuros.

### Negative Consequences (trade-offs)

- Exige `CREATE EXTENSION unaccent` (superuser) — Open Question #1 do DESIGN §5 endereça com provisão pré-deploy na Hostinger KVM 1.
- Configurations dedicadas viram parte do schema — pg_dump deve incluí-las (default sim).
- Compostos pt-BR específicos (`k-pop` vs `kpop` vs `k pop`) não são endereçados por unaccent + portuguese_stem → endereçado por normalização Python simétrica em algorithms (ADR-021 invariante 2; gap A do specialist DB).

### Open Concerns

- **Provisão na Hostinger KVM 1**: criar `EXTENSION unaccent` exige superuser. Runbook deve documentar provisão manual no setup do banco (TX-13 do BACKLOG).
- **Compatibilidade pg 13/14/16**: testado em pg 16; pg 13 funciona idêntico, `portuguese_stem` é built-in desde 8.3.

## Pros and Cons of the Options

### Opção 1 — v2 (unaccent direto IMMUTABLE)

- 👍 Curto.
- 👎 Falha em CREATE INDEX (IMMUTABLE violado pelo planner).
- 👎 unaccent fora do pipeline FTS perde stopword handling correto.

### Opção 2 — Wrapper IMMUTABLE manual

- 👍 Resolve IMMUTABLE.
- 👎 Aplica em string completa, não token a token.
- 👎 Stopwords pt-BR podem escapar.

### Opção 3 — `CONFIGURATION pt_unaccent` ⭐

- 👍 Pipeline FTS canônico.
- 👍 Stopwords tratadas.
- 👍 Reutilizável.
- 👎 Mais SQL na migration (aceitável).

### Opção 4 — Extension `rum` (BM25)

- 👍 BM25 SOTA.
- 👎 Extension não-core; dívida operacional em VPS.
- 👎 Build do índice 5× mais lento.
- 👎 Fora do escopo MVP (algorithms §2.3 confirma).

## Implementation Notes

- **Task IDs**: T30.1.4b (substitui T30.1.4) — migration `0001_search_schema` com EXTENSION + CONFIGURATION + FUNCTION
- **Migration**: `apps/search/migrations/0001_initial.py` ou separada `0001a_extensions.py` com `RunSQL`
- **DESIGN.md**: §2.2 "Bugs corrigidos (DIFF vs v2)"
- **Specialist output**: `_specialist-outputs/01-database-architect.md` §1 Bug 2
- **Pré-deploy**: documentar provisão de superuser na Hostinger em `docs/runbooks/setup-postgres-extensions.md` (TX-13)

## References

- DESIGN.md §2.2
- `_specialist-outputs/01-database-architect.md` §1 Bug 2
- ADR-018 (trigger SQL usa `articles_search_config`)
- ADR-020 (SQLite dev fallback porque SQLite não tem FTS pt-BR)
- ADR-021 (algorithms — usa `plainto_tsquery('pt_unaccent', ...)`)
- Postgres docs — Text Search Configurations, `unaccent`
- comunidade postgres-br — wrapper pattern para `immutable_unaccent`
