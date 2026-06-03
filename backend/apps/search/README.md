# apps.search

App da **busca editorial full-text** do Interpop. Esta pasta é a **fonte de verdade da camada DB** da feature (Fase 1 do `DESIGN.md §6`). Camadas de serviço (`SearchService`), view (`SearchView`), serializers, signals reais e frontend ficam para fases subsequentes.

## Resumo arquitetural (decisões locked)

| Decisão | ADR | Implementação |
|---|---|---|
| Tabela paralela `search_index` (read-projection) | ADR-015, ADR-016 | Migration `0001_initial` |
| FTS pt-BR via `CONFIGURATION pt_unaccent` (IMMUTABLE preservado) | **ADR-019** | Migration `0001_initial` + função `articles_search_config` |
| Trigger SQL = fonte de verdade da sincronia | **ADR-018** | Migration `0003_search_triggers` |
| Signal Python apenas invalida cache Redis | ADR-018 | `signals.py` (stub — Fase 2) |
| Composite indexes parciais + covering | **ADR-030-DB** | Migration `0002_search_indexes` (`atomic=False`) |
| Vacuum tuning GIN agressivo | **ADR-034** | Migration `0004_search_vacuum_tuning` |
| Fallback SQLite-dev (sem FTS pt-BR) | ADR-020 | Guards `connection.vendor == 'postgresql'` |

## Estrutura

```
apps/search/
├── apps.py              # AppConfig — ready() registra signals
├── models.py            # SearchIndex (managed=False), SearchLog (managed=False)
├── services.py          # STUB Fase 2 (SearchService.query)
├── dto.py               # STUB Fase 2 (QuerySpec, SearchResultPage)
├── signals.py           # STUB Fase 2 (cache invalidation)
├── migrations/
│   ├── 0001_initial.py             # ext + config + function + tabelas
│   ├── 0002_search_indexes.py      # CONCURRENTLY + partial + covering (atomic=False)
│   ├── 0003_search_triggers.py     # trg_articles_sync_search + 2 triggers
│   └── 0004_search_vacuum_tuning.py # ALTER INDEX/TABLE SET
├── management/commands/  # reindex_search vem na Fase 2 (T30.1.6b)
├── tests/
│   └── test_migrations.py
└── README.md
```

## Fallback SQLite-dev (ADR-020)

Em ambiente local (`config.settings.development`), o engine padrão é SQLite.
SQLite não suporta:

- `CREATE EXTENSION unaccent`
- `CREATE TEXT SEARCH CONFIGURATION`
- `to_tsvector` / `tsvector` nativos
- Trigger PL/pgSQL (suporta apenas trigger SQL muito limitado)
- `CREATE INDEX CONCURRENTLY`
- Partial indexes com expressões complexas
- `ALTER INDEX ... SET (fastupdate = ...)`

**Estratégia** (DESIGN §3.6 + ADR-020):

1. Toda migration desta pasta guarda as operações Postgres-only com:

   ```python
   if connection.vendor == 'postgresql':
       schema_editor.execute(POSTGRES_SQL)
   ```

   Em SQLite, a migration cria **apenas o esqueleto mínimo das tabelas** (sem `search_vector` real, sem trigger, sem GIN). Isso garante que `migrate` não trava, e modelos com `managed=False` continuam mapeáveis.

2. O `SearchService` (Fase 2) faz fallback `__icontains` em SQLite — qualidade de resultado pior, mas evita drift dev/prod no fluxo de desenvolvimento.

3. **CI usa Postgres** (sempre). Testes marcados com `pytest.mark.requires_postgres` pulam em SQLite local.

## Como rodar as migrations

```bash
# Sync deps
cd backend && uv sync

# Aplicar todas as migrations de search
uv run python manage.py migrate search

# Em Postgres, isso cria:
#   - extension unaccent
#   - configuration pt_unaccent
#   - função articles_search_config(text)
#   - tabela search_index com 4 índices (1 GIN + 2 partial/covering + 1 BTree)
#   - trigger trg_articles_sync_search em apps.articles.Article
#   - ALTER TABLE/INDEX com vacuum tuning agressivo

# Em SQLite (dev local), isso cria apenas o esqueleto das tabelas
# search_index e search_log, sem extensions, sem configuration, sem triggers.
```

## Provisão Postgres em produção

`CREATE EXTENSION unaccent` exige `SUPERUSER`. Documentação de provisão na
Hostinger KVM 1 → `docs/runbooks/setup-postgres-extensions.md` (TX-13, ainda
não escrito). Em ambientes gerenciados, executar a primeira vez como usuário
admin do Postgres antes de rodar as migrations Django como usuário da app.

## Referências

- `docs/specs/busca-editorial/DESIGN.md §2.2` (database arch)
- `docs/specs/busca-editorial/_specialist-outputs/01-database-architect.md`
- ADR-018 (trigger SQL fonte de verdade)
- ADR-019 (pt_unaccent CONFIGURATION)
- ADR-020 (SQLite dev fallback)
- ADR-030-DB (composite indexes parciais/covering)
- ADR-034 (vacuum tuning GIN)
