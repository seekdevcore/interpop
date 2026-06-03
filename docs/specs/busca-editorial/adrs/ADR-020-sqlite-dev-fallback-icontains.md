# ADR-020: SQLite dev = `__icontains` fallback documentado

- **Status**: Accepted
- **Date**: 2026-06-03
- **Tags**: database, sqlite, dev-environment, postgres, fts, fallback, ci
- **Stakeholders**: database-architect (autor), code-implementer, testing-engineer
- **Layer**: Database

## Context

O Interpop usa SQLite em desenvolvimento (`backend/db.sqlite3`, no `.gitignore`) e Postgres em produção (Hostinger KVM 1). A feature de busca depende de FTS pt-BR via `pt_unaccent` (ADR-019), `tsvector`, GIN index e `plainto_tsquery` — **nada disso existe em SQLite**.

Opções enfrentadas:

- Forçar Postgres em dev (Docker Compose) — overhead para devs novos do projeto.
- SQLite FTS5 — existe, mas sem stemming pt-BR + sem `unaccent` nativo.
- Fallback `__icontains` em dev — pesquisa "feia" mas funcional para smoke testing local.

Realidade do dev workflow: a maior parte do trabalho de implementação de busca acontece com **dados sintéticos pequenos** (10-200 artigos fixture). Ranking não importa — o que importa é validar fluxo (chama service, retorna lista, render no card). Postgres real é necessário para validar perf, ranking e edge cases de FTS — **isso vive em CI** (testcontainers ou marker `requires_postgres`).

## Decision Drivers

- DX: dev novo cloning o repo deve conseguir `npm run dev` + `uv run python manage.py runserver` e ter busca funcionando (mesmo que degradada).
- Fidelity: testes de FTS sérios (ranking, normalização, stemming, recency, cursor estável) precisam de Postgres real — rodam em CI com testcontainers OU em dev opcional com docker-compose.dev.yml.
- Honestidade: documentar abertamente que dev é degraded mode; resultados em dev não refletem produção.
- Marker pytest `requires_postgres`: skipa testes FTS quando engine for SQLite.

## Considered Options

1. **Forçar Postgres em dev via docker-compose.dev.yml obrigatório** — overhead instalação.
2. **SQLite FTS5 com tokenizer custom** — engenharia significativa para pouca fidelidade pt-BR.
3. **`__icontains` fallback em dev + Postgres em CI/prod** — degraded mode documentado.
4. **Forçar Postgres remoto (cloud free tier)** — viola privacidade dev local, depende de internet.

## Decision Outcome

**Chosen option**: **Opção 3 — Fallback `__icontains` em dev quando engine for SQLite; Postgres em CI/prod**, porque:

- Dev novo continua produtivo com mínimo setup (`uv sync` + `manage.py migrate` + `runserver` — zero docker).
- Testes que exigem FTS rodam em CI (Postgres via service container do GitHub Actions, ADR-013 §8).
- Devs que querem testar FTS real localmente sobem `docker-compose.dev.yml` (opcional, documentado em README).
- README + docstring do `SearchService` documenta open-eyed que dev é degraded mode.

### Implementação concreta

```python
# apps/search/services.py
from django.conf import settings
from django.db import connection

class SearchService:
    @staticmethod
    def query(spec: QuerySpec) -> SearchResultPage:
        engine = connection.vendor  # 'postgresql' | 'sqlite' | ...
        if engine == 'postgresql':
            return _query_postgres_fts(spec)
        elif engine == 'sqlite':
            # Degraded mode — apenas para dev local
            return _query_sqlite_icontains(spec)
        else:
            raise NotImplementedError(f'SearchService não suporta engine {engine}')


def _query_sqlite_icontains(spec: QuerySpec) -> SearchResultPage:
    """Fallback SQLite dev. Sem ranking, sem stemming, sem highlight server.
    Usa Article.objects diretamente (não SearchIndex — sem tsvector no SQLite)."""
    from apps.articles.models import Article
    qs = Article.objects.filter(status='published', published_at__isnull=False)
    if spec.q:
        qs = qs.filter(
            Q(title__icontains=spec.q) |
            Q(excerpt__icontains=spec.q) |
            Q(body__icontains=spec.q)
        )
    # ... aplica filtros author/category/de/ate
    qs = qs.order_by('-published_at')[:spec.per_page]
    # Retorna SearchResultPage com next_cursor=None (sem paginação cursor em dev)
    return SearchResultPage(
        results=[...],
        next_cursor=None,
        has_more=False,
        total_estimate=qs.count(),
        query_echo=spec.q,
        query_terms_expanded=[],  # sem stems em SQLite
        took_ms=0,
    )
```

### Marker pytest

```python
# backend/conftest.py
import pytest
from django.db import connection

requires_postgres = pytest.mark.skipif(
    connection.vendor != 'postgresql',
    reason='Teste requer Postgres (FTS pt-BR via pt_unaccent — ADR-019/020)',
)
```

```python
# apps/search/tests/test_ranking.py
@requires_postgres
def test_ts_rank_cd_ordena_por_relevancia():
    ...
```

### docker-compose.dev.yml (opcional, documentado em README)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: interpop_dev
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
    ports:
      - '5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

### Positive Consequences

- DX preservada (dev clone → `runserver` em <2 minutos).
- Testes FTS sérios rodam em CI (Postgres real).
- Dev opcional sobe Postgres local quando precisa.
- README documenta limitação (degraded mode).
- Code paths de produção (Postgres FTS) não são afetados por fallback (branching localizado em `SearchService.query`).

### Negative Consequences (trade-offs)

- **Resultados em dev diferem de prod**: ranking diferente, sem stemming, sem unaccent — devs devem entender isso antes de "demonstrar a feature".
- Branching no service layer (`if engine == 'postgresql'`) — código adicional, mas isolado.
- Highlight client-side em dev usa `q` puro (sem stems), pode highlightar errado — aceitável em dev.
- Risco de devs caírem em "passou em dev, quebrou em prod" — mitigado por CI rodando Postgres real.

### Open Concerns

- **Marker `requires_postgres`**: garante skip em SQLite, mas dev pode "passar todos os testes em dev" e não rodar FTS — mitigado por CI gate obrigatório.
- **Tests de integração específicos de SQLite fallback**: também precisam existir para garantir que branch SQLite não regride.

## Pros and Cons of the Options

### Opção 1 — Postgres obrigatório em dev

- 👍 Paridade dev-prod absoluta.
- 👎 Atrito DX; dev novo precisa Docker rodando antes de tudo.
- 👎 Viola tradição Django de "SQLite default em dev".

### Opção 2 — SQLite FTS5 com tokenizer pt-BR

- 👍 Sem Postgres em dev.
- 👎 Engenharia significativa (custom tokenizer C/Python via FTS5 extension).
- 👎 Paridade ainda imperfeita (sem RSLP).

### Opção 3 — `__icontains` fallback ⭐

- 👍 Zero overhead DX.
- 👍 CI cobre o caso real.
- 👎 Resultado dev ≠ prod (documentado).

### Opção 4 — Postgres remoto (cloud)

- 👍 Real engine.
- 👎 Depende de internet; conflito com privacy.

## Implementation Notes

- **Task IDs**: T30.1.7 (service com branch), T30.1.X5 (docker-compose.dev.yml opcional), TX-15 (documentar fallback no README)
- **DESIGN.md**: §2.2 "SQLite dev"; §3.6 "SQLite-dev gap"
- **Specialist output**: `_specialist-outputs/01-database-architect.md` §4 decisão 5
- **CI**: `.github/workflows/ci.yml` usa `postgres:16-alpine` como service; pytest sem `requires_postgres` skip
- **Test**: `apps/search/tests/test_sqlite_fallback.py` (branch SQLite) + `test_postgres_fts.py` (marker `requires_postgres`)

## References

- DESIGN.md §2.2, §3.6
- `_specialist-outputs/01-database-architect.md` §4 (table de confirmação)
- ADR-013 (observability gate — CI Postgres)
- ADR-019 (pt_unaccent — não existe em SQLite)
- Django docs — `Q.filter(title__icontains=...)`
