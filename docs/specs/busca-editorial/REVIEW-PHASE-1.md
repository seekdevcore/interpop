# REVIEW — Fase 1 (DB schema + indexes + triggers + vacuum tuning) — Busca Editorial

> **Reviewer**: `gsd-code-reviewer` (sócio sênior — Gabarito PDF aplicado)
> **Data**: 2026-06-03 15:30 GMT-3
> **Branch**: `develop` (5 commits à frente de origin) — `c017e1f` → `64c49d9`
> **Escopo**: `backend/apps/search/` (bootstrap + 4 migrations + 4 arquivos de teste + README)
> **Quality gate**: decidir se Fase 2 (SearchService) pode empilhar em cima desta Fase 1.
> **Acknowledgment**: PDF Gabarito lido — esta review aplica as 5 diretrizes (Extreme Ownership, anti-sycophancy, profundidade, elevação, obsessão pelo objetivo). Sem suavização.

---

## §0. Veredito

### **APROVADO COM RESSALVAS** — pode empilhar Fase 2, mas H-01 (`ENABLE ALWAYS`) precisa ser resolvida ANTES do PR final da US30.1 — não é blocker da Fase 2 em si, mas é blocker para fechar a feature.

**Justificativa em 1 parágrafo**: a Fase 1 cumpre 95% do que o DESIGN v3 + ADRs 018/019/020/030-DB/034 pedem. Os dois Bugs canônicos do specialist DB (author_id UUID, função IMMUTABLE) estão corrigidos e cobertos por teste; trigger SQL cobre os 4 cenários de falha do signal Python (CRUD direto, bulk_update, raw SQL, DELETE); todos os 4 índices ADR-030-DB estão presentes; vacuum tuning ADR-034 está aplicado com unidades corretas; o fallback SQLite-dev é honesto e testado; o splitter de SQL multi-statement está bem escrito e respeita blocos `$$...$$`. **A ressalva dura** é uma inconsistência entre o ADR-039 (que pede `ALTER TABLE ... ENABLE ALWAYS TRIGGER` **dentro da migration 0003**) e o BACKLOG/tracker (que classifica T30.4.X7 como 🟡 Medium pendente para implementação tardia). O implementador escolheu seguir o BACKLOG, deixando a trigger no modo `ORIGIN` default — isso reabre o vetor M-04/H-04-bypass até T30.4.X7 ser feita. Há também 4 outras ressalvas de menor severidade. Nenhuma delas bloqueia o início do trabalho da Fase 2 (SearchService roda sobre o schema existente sem mudança), mas elas precisam estar fechadas antes do PR de fechamento da US30.1.

---

## §1. Skills invocadas

| Skill                              | Por quê                                                                                               |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `code-review-excellence`           | Estrutura do review (severidade, achados, conformidade ADR)                                           |
| `postgresql`                       | Validar idempotência DDL, `IF NOT EXISTS`, partial/covering indexes, GIN reloptions                   |
| `postgresql-optimization`          | Conferir unidade `gin_pending_list_limit` (KB), autovacuum scale_factor, fastupdate                   |
| `database-migration`               | Reverse symmetry, `atomic = False` para CONCURRENTLY, dependências entre migrations                   |
| `django-pro`                       | `managed = False`, `RunPython` vs `RunSQL`, dependency tree de migrations, `connection.vendor` guards |
| `superpowers:systematic-debugging` | Cenários de falha (bypass replica role, status revertido, fixture conflict) por método científico     |
| `cc-skill-security-review`         | Cross-check com SECURITY-REVIEW.md (H-01..M-10), CWE mapping, SECURITY DEFINER, search_path injection |
| `gsd-code-review`                  | Workflow e formato do REVIEW.md                                                                       |

**Mapeamento ao roadmap.sh** (sanity-check §5 CLAUDE.md): toca `backend` (Postgres tuning + migrations) + `software-architect` (ADR materialização) + `cyber-security` (CWE-863 trigger bypass + CWE-200 search_log) — sem desvio do mainstream.

---

## §2. Conformidade ADR por ADR

| ADR                  | Item esperado                                                                                                                                                                                                                                                | Implementação                                                                                                                    | Veredito                                            | Evidência                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **ADR-018**          | Trigger SQL `AFTER INSERT OR UPDATE OF (status, published_at, title, excerpt, body, author_id, category_id)` + `AFTER DELETE`; signal Python apenas cache invalidation (stub)                                                                                | Implementação literal em `0003_search_triggers.py:100-114`; signal stub em `signals.py:14` (vazio com docstring correta)         | ✅ **CONFORME**                                     | `0003:101-107` lista exata de campos; `signals.py:1-15` deixa claro "signal NÃO escreve em SearchIndex"              |
| **ADR-019**          | `CONFIGURATION pt_unaccent` COPY de `pg_catalog.portuguese` + `ALTER MAPPING ... WITH unaccent, portuguese_stem` + função `articles_search_config` IMMUTABLE PARALLEL SAFE                                                                                   | Implementação literal em `0001_initial.py:65-81`                                                                                 | ✅ **CONFORME**                                     | Bug 2 do specialist DB coberto; test `test_articles_search_config_is_immutable` em `test_migrations_0001.py:104-124` |
| **ADR-020**          | SQLite-dev guard via `connection.vendor == 'postgresql'`; migration cria esqueleto mínimo em SQLite                                                                                                                                                          | Guard presente em todas as 4 migrations (`0001:248`, `0002:74`, `0003:159`, `0004:70`); fallback CREATE TABLE em `0001:160-188`  | ✅ **CONFORME**                                     | Marker `requires_postgres` registrado em `pytest.ini:23`                                                             |
| **ADR-030-DB**       | 4 índices: GIN; composite partial `(category_id, published_at DESC) WHERE category_id IS NOT NULL`; composite covering `(author_id, published_at DESC) INCLUDE (article_id)`; BTree `(published_at DESC)`. Todos `CONCURRENTLY`. Migration `atomic = False`. | Implementação literal em `0002_search_indexes.py:34-62`; `atomic = False` em `0002:99`                                           | ✅ **CONFORME**                                     | 5 testes em `test_migrations_0002.py` cobrem presença + WHERE + INCLUDE                                              |
| **ADR-034**          | `fastupdate = on`, `gin_pending_list_limit = 2MB` (em KB integer = 2048), `autovacuum_vacuum_scale_factor = 0.05`, `autovacuum_analyze_scale_factor = 0.02`, `autovacuum_vacuum_cost_delay = 10ms`                                                           | Implementação literal em `0004_search_vacuum_tuning.py:32-48`; unidade KB integer correta (test em `test_migrations_0004.py:49`) | ✅ **CONFORME**                                     | NOTA explícita sobre unidade em `0004:88-92` (`gin_pending_list_limit` aceita inteiro em KB, não string)             |
| **ADR-039**          | Trigger declarada com `ENABLE ALWAYS` (não default `ENABLE`); `ALTER TABLE articles ENABLE ALWAYS TRIGGER articles_sync_search`                                                                                                                              | **AUSENTE** em `0003_search_triggers.py` — trigger usa `ENABLE` default (ORIGIN)                                                 | ⚠️ **NÃO CONFORME** (com justificativa de processo) | Ver H-01 §3                                                                                                          |
| **Bug 1** specialist | `author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE` (não BIGINT, não auth_user)                                                                                                                                                                 | Implementação literal em `0001:111-113` (FK aponta `users(id)`)                                                                  | ✅ **CONFORME**                                     | 2 testes (`test_search_index_author_id_is_uuid`, `test_search_index_author_id_is_uuid_in_db`)                        |
| **Bug 2** specialist | `articles_search_config` IMMUTABLE PARALLEL SAFE                                                                                                                                                                                                             | Implementação em `0001:78-81`                                                                                                    | ✅ **CONFORME**                                     | Test `test_articles_search_config_is_immutable` checa `provolatile = 'i'`                                            |

---

## §3. Achados por severidade

### 🟠 High (devem ser fixados antes do PR final da US30.1)

---

#### **H-01 — Trigger criada sem `ENABLE ALWAYS` reabre o vetor M-04/H-04-bypass do SECURITY-REVIEW**

- **Onde**: `backend/apps/search/migrations/0003_search_triggers.py:100-114`
- **Severidade**: 🟠 High (não 🔴 porque o ataque exige insider com role `REPLICATION` + execução intencional de `SET session_replication_role='replica'` — vetor estreito; mas ADR-039 é categórica e existe teste no DESIGN/TEST-STRATEGY que vai falhar)
- **CWE**: CWE-863 (Incorrect Authorization Check)
- **Vetor**:
  1. ADR-039 §"Decision Outcome" exige `ALTER TABLE articles ENABLE ALWAYS TRIGGER articles_sync_search` e `... articles_remove_search` na própria migration 0003.
  2. SECURITY-REVIEW M-04 §256 confirma: "Trigger definido como `ALWAYS` (não `ON REPLICA`) — força execução mesmo em modo replica: `CREATE TRIGGER ... ENABLE ALWAYS ...`".
  3. A implementação atual (`0003:102-107`) usa `CREATE TRIGGER ... AFTER ...` puro, sem o `ALTER TABLE ... ENABLE ALWAYS`. Default Postgres é `ENABLE` (modo ORIGIN), que é **bypassável** por `SET session_replication_role = 'replica'`.
  4. Em produção, atacante com acesso `postgres` user (host comprometido) ou role com `REPLICATION` consegue inserir/atualizar `articles` sem disparar a trigger → drift silencioso entre `articles` e `search_index`.
- **Por que isso aconteceu (anti-sycophancy)**: existe inconsistência entre os documentos da spec — ADR-039 fala "atualizar 0003" mas o BACKLOG.md:784 classifica T30.4.X7 como `🟡 Medium` ("Test integration: SET session_replication_role = 'replica' + INSERT → search_index ainda populado via trigger") e o tracker.md liga ADR-039 a T30.4.X7. O implementador seguiu o BACKLOG. A inconsistência da spec não é defeito do implementador, mas o achado material é real.
- **Impacto**: defesa em profundidade incompleta; bypass intencional é trivial em produção; cron de auditoria de drift (também T30.4.X7) ausente.
- **Mitigação**:
  1. **Decidir agora** (em 1 commit): adicionar à 0003 (e ao reverse) as duas linhas:
     ```sql
     ALTER TABLE articles ENABLE ALWAYS TRIGGER articles_sync_search;
     ALTER TABLE articles ENABLE ALWAYS TRIGGER articles_remove_search;
     ```
     Reverse: `ALTER TABLE articles ENABLE TRIGGER ...` (volta ao default ORIGIN).
  2. Atualizar `test_migrations_0003.py` com `test_triggers_are_enable_always` checando `pg_trigger.tgenabled = 'A'`.
  3. Reconciliar a spec: ou T30.4.X7 promove a "🔴 Immediate"+absorvida pela 0003 (preferido), ou o ADR-039 perde a parte do `ENABLE ALWAYS` (não recomendado — perde defesa de baixo custo).
- **Refs**: ADR-039:50-65, SECURITY-REVIEW §3 M-04 + §9 passo 8, TEST-STRATEGY §7 TX-20.

---

### 🟡 Medium (entram no backlog, não bloqueiam Fase 2 nem o PR final)

---

#### **M-01 — `search_log` ainda guarda `query_text` plain (não está pseudonimizado)**

- **Onde**: `backend/apps/search/migrations/0001_initial.py:126-138` (Postgres) e `0001:173-184` (SQLite)
- **Severidade**: 🟡 Medium (SECURITY-REVIEW H-02 é 🟠 High mas trata da FUTURA persistência via SearchService — Fase 2; em Fase 1, a tabela vazia é apenas um shell)
- **CWE**: CWE-200 (info exposure) + privacy CWE-359
- **Vetor**:
  1. Colunas atuais: `query_text TEXT`, `query_norm TEXT`, `user_id UUID`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
  2. A spec SECURITY-REVIEW H-02 + ADR-035 exigem: hash com HMAC-pepper (não query plain), bucket de timestamp 5min, IP /16 (ou drop IP em favor de só `user_hash`).
  3. A migration atual nem persiste IP nem hash — então o achado é "design pendente que precisa ser materializado em ADR-035 ANTES da Fase 2 (SearchService) escrever uma única linha".
- **Mitigação**:
  1. Antes de SearchService começar a escrever: **adicionar migration 0005** que altera `search_log` para schema final do ADR-035 (`query_hash_hmac CHAR(32)`, `query_bucket_5min TIMESTAMPTZ`, drop `query_text`/`query_norm`).
  2. Documentar no docstring de `SearchLog` (`models.py:71`) que persistência ainda é stub e não autorizada até ADR-035 ser materializado.
  3. Considerar `search_log` com `managed = False` + DEFERRED — não criar a tabela final na Fase 1; só na 0005 quando o design estiver fechado. **Risco se NÃO fizer**: SearchService Fase 2 vai escrever em `search_log` plano e violar LGPD silenciosamente. (Mitigado pelo handoff SECURITY-REVIEW §9.5).
- **Refs**: SECURITY-REVIEW H-02, ADR-035 (a materializar), DESIGN §3.4 linha 437.

---

#### **M-02 — Trigger `articles_sync_search` não filtra `UPDATE OF slug` mas atualiza projeção sem o slug — risco latente quando search incorporar slug**

- **Onde**: `backend/apps/search/migrations/0003_search_triggers.py:103-104`
- **Severidade**: 🟡 Medium (risco LATENTE; impacto zero hoje porque `search_index` não armazena slug)
- **Vetor**:
  1. Lista `UPDATE OF` cobre `status, published_at, title, excerpt, body, author_id, category_id` — todos os campos relevantes ao `search_vector` atual.
  2. Article tem campo `slug` (`models.py:32`) que aparece na URL pública. Se alguém um dia adicionar slug ao tsvector (ou a algum filtro do `SearchService`), trigger não vai re-sincronizar quando slug mudar isoladamente.
  3. Hoje slug não está no SearchIndex → bug seria 100% latente. Mas isso é exatamente o tipo de coisa que vira bug em 6 meses quando ninguém lembra do escopo da `UPDATE OF`.
- **Mitigação**:
  1. Adicionar comment em `0003:103-105` explicitando o que **NÃO** está na lista e por quê:
     ```sql
     -- NOTA: campos intencionalmente fora da UPDATE OF (não sincronizam):
     --   slug, view_count, is_featured, cover_image, cover_caption, updated_at
     -- Se algum desses entrar no search_vector futuro, ADICIONAR aqui.
     ```
  2. Adicionar test "negativo" em `test_migrations_0003.py`: update `view_count` em artigo publicado NÃO dispara reindex (`indexed_at` permanece igual). Garante que a otimização da `UPDATE OF` não é perdida em refactor descuidado.
- **Refs**: ADR-018 §"escopo de campos relevantes apenas, reduz overhead".

---

#### **M-03 — `_split_sql_statements` está duplicado entre 0001 e 0003 (DRY); risco quando os dois divergirem em refactor**

- **Onde**: `0001_initial.py:199-232` e `0003_search_triggers.py:128-154`
- **Severidade**: 🟡 Medium (custo cognitivo + risco de drift em fix futuro)
- **Vetor**:
  1. Comment em `0003:130-132` admite duplicação: "não compartilhado para evitar import cíclico entre migrations".
  2. **Anti-sycophancy: o comment está errado.** Migrations Django podem importar helpers de utilidade que estejam em `apps/search/_migration_helpers.py` (ou qualquer módulo que NÃO seja outra migration). Não há ciclo. O risco real é que migrations precisam ser auto-contidas para reprodutibilidade histórica — se você refactor o helper, migrations antigas não devem mudar comportamento. Argumento legítimo, mas dois copy-paste de 30 linhas idênticas é frágil.
  3. Quando alguém corrigir um edge case do splitter (ex.: aceitar `--` como comment delimiter em meio à linha) e esquecer de propagar — divergência silenciosa.
- **Mitigação**:
  1. Opção A (preferida): extrair para `apps/search/migrations/_helpers.py` (NÃO uma migration, só helper module). Migrations importam de lá. Reproducibilidade preservada porque o helper é versionado e qualquer mudança vira migration nova se afetar comportamento.
  2. Opção B (mais barata): manter o copy-paste, mas adicionar comment-lock em ambos os lugares: `# DUPLICATED in 0001 — propagar fix se alterar`.
- **Refs**: princípio DRY (PEP 20 "Although practicality beats purity").

---

#### **M-04 — Migration 0001 não tem `atomic = False` mas mistura DDL Postgres-only (CREATE EXTENSION) com CREATE TABLE — alguns DDL falham em transação dependendo da config do PG**

- **Onde**: `backend/apps/search/migrations/0001_initial.py:270-273` (comment afirma `atomic = True` é OK)
- **Severidade**: 🟡 Medium (depende do estado do banco; pode passar local e falhar prod)
- **Vetor**:
  1. `CREATE EXTENSION unaccent` **dentro de transação** funciona em PG 9.1+. ✅
  2. `CREATE TEXT SEARCH CONFIGURATION` **dentro de transação** funciona. ✅
  3. **Mas** em PG 16, `CREATE EXTENSION IF NOT EXISTS unaccent` precisa de SUPERUSER ou role com `CREATE` em `pg_catalog`. Se a extension já estiver criada e a role não tiver permissão, `IF NOT EXISTS` é no-op silencioso e tx continua. ✅
  4. O único caso onde `atomic = True` morde aqui é se a função `articles_search_config` for **chamada** dentro da mesma transação (não é). Logo, OK na prática.
- **Sub-achado**: a sequência `DO $$ BEGIN IF NOT EXISTS ... CREATE TEXT SEARCH CONFIGURATION ... END $$;` (linhas 59-69) é idempotente, mas o `ALTER TEXT SEARCH CONFIGURATION ... ALTER MAPPING` (linhas 71-73) **roda incondicionalmente** — em re-run, ele tenta alterar uma mapping que já tem `unaccent, portuguese_stem` e Postgres aceita (substitui pela mesma sequência). Não é bug, mas é fragil — se a sequência fosse diferente entre runs, o último ganha silenciosamente.
- **Mitigação**:
  1. Mover `ALTER MAPPING` para dentro do `DO $$ ... END $$` (só roda se a config acabou de ser criada).
  2. Adicionar test `test_pt_unaccent_mapping_idempotent` que roda a migration 2× e confirma que `pg_ts_config_map` ainda tem exatamente as mappings esperadas. (Hoje os testes só checam estado final, não idempotência.)
- **Refs**: PG docs `ALTER TEXT SEARCH CONFIGURATION`, ADR-019.

---

### ⚪ Low / opcional

---

#### **L-01 — `trg_articles_sync_search` não declara `SECURITY DEFINER` nem `SET search_path`**

- **Onde**: `0003_search_triggers.py:43-80`
- **Vetor**:
  1. Função PL/pgSQL roda como o usuário invocante (`SECURITY INVOKER`, default). Como a app role só tem `INSERT/UPDATE/DELETE` em `articles` e na própria `search_index`, isso é seguro.
  2. **Search path injection**: função chama `public.articles_search_config(...)` (qualificado) — bom; chama `setweight(...)` (não qualificado — vem de `pg_catalog`). Se atacante criasse um schema `evil` à frente de `pg_catalog` no search_path do role, poderia shadow. Vetor estreito.
- **Mitigação opcional**: adicionar `SET search_path = pg_catalog, public` na função para defesa em profundidade. Custo zero.
- **Refs**: CWE-426 (Untrusted Search Path), PG docs `SECURITY DEFINER`.

---

#### **L-02 — `gin_pending_list_limit` valor 2048 é magic number; ADR-034 sugere settings/env**

- **Onde**: `0004_search_vacuum_tuning.py:38`
- **Vetor**: tuning futuro (subir pra 4MB, descer pra 1MB conforme observação de p95) exige nova migration em vez de um `ALTER INDEX` num runbook. **Trade-off legítimo**: migration é fonte de verdade reprodutível; runbook bypass é op fragility. Manter como está é defensável.
- **Mitigação opcional**: deixar nota no docstring de `0004` apontando para `docs/ops/postgres-tuning.md` como ponto onde o valor pode ser re-evaluado.

---

#### **L-03 — Test `test_publish_article_inserts_into_search_index` usa fixture `admin_user` mas não declara o conftest path; pode falhar se conftest mover**

- **Onde**: `backend/apps/search/tests/test_migrations_0003.py:47-48`
- **Vetor**: fixture `admin_user` vem de `apps/users/conftest.py` (cita o comment). Se algum dia esse conftest mudar de lugar ou a fixture for renomeada, o test quebra silenciosamente (Postgres-only — nem todo CI run pega imediatamente).
- **Mitigação**: criar fixture local em `apps/search/tests/conftest.py` que importa explicitamente do conftest de users OU usa `UserFactory` quando ela existir. Custo baixo, robustez alta.

---

#### **L-04 — README descreve `tests/test_migrations.py` mas arquivo real é `tests/test_migrations_0001.py` etc. (drift de doc)**

- **Onde**: `backend/apps/search/README.md:31`
- **Vetor**: documentação está stale antes mesmo do PR mergear. Pequeno, mas é exatamente o tipo de drift que cresce.
- **Mitigação**: trocar `└── test_migrations.py` por:
  ```
  ├── test_app_config.py
  ├── test_migrations_0001.py
  ├── test_migrations_0002.py
  ├── test_migrations_0003.py
  └── test_migrations_0004.py
  ```

---

## §4. Cobertura de testes — matriz invariantes × tests

| Invariante ADR                                                          | Test correspondente                                                                                                                 | Status                |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| ADR-018: trigger dispara em INSERT publicado                            | `test_migrations_0003.py::test_publish_article_inserts_into_search_index`                                                           | ✅                    |
| ADR-018: trigger atualiza tsvector em UPDATE title em PUBLISHED         | `test_migrations_0003.py::test_update_title_in_published_refreshes_vector`                                                          | ✅                    |
| ADR-018: trigger cobre bulk_update (`QuerySet.update`)                  | `test_migrations_0003.py::test_bulk_update_status_to_draft_removes_from_index`                                                      | ✅                    |
| ADR-018: trigger cobre raw SQL                                          | `test_migrations_0003.py::test_raw_sql_update_status_removes_from_index`                                                            | ✅                    |
| ADR-018: trigger DELETE remove projeção                                 | `test_migrations_0003.py::test_delete_article_removes_from_index`                                                                   | ✅                    |
| ADR-018: trigger NÃO dispara em campos fora da `UPDATE OF` (otimização) | **AUSENTE** — ver M-02                                                                                                              | ❌                    |
| ADR-018: ENABLE ALWAYS resiste a replica role                           | **AUSENTE** — ver H-01; ADR-039 explicitamente exige `t_enable_always_resists_replica_role`                                         | ❌                    |
| ADR-019: `articles_search_config` IMMUTABLE                             | `test_migrations_0001.py::test_articles_search_config_is_immutable`                                                                 | ✅                    |
| ADR-019: pt_unaccent normaliza Beyoncé → beyonce                        | `test_migrations_0001.py::test_pt_unaccent_normalizes_accents`                                                                      | ✅                    |
| ADR-019: pt_unaccent stem cantores → cantor                             | `test_migrations_0001.py::test_pt_unaccent_stems_portuguese`                                                                        | ✅                    |
| ADR-019: stopword "não" preserva (`tsvector` vazio)                     | **AUSENTE** — DESIGN §"Verificação de propriedades" cita explicitamente                                                             | ❌                    |
| ADR-019: idempotência da migration (re-run não rompe ALTER MAPPING)     | **AUSENTE** — ver M-04                                                                                                              | ❌                    |
| ADR-020: SQLite-dev guard (migration não trava)                         | `test_migrations_0002.py::test_migration_0002_runs_in_sqlite_dev_as_noop` (apenas 0002 e 0003 e 0004 — 0001 não tem teste idêntico) | 🟡 parcial            |
| ADR-020: marker `requires_postgres` em pytest.ini                       | `pytest.ini:23`                                                                                                                     | ✅                    |
| ADR-030-DB: 4 índices presentes                                         | `test_migrations_0002.py::test_all_four_indexes_present_on_search_index`                                                            | ✅                    |
| ADR-030-DB: partial WHERE NOT NULL                                      | `test_migrations_0002.py::test_partial_category_index_exists`                                                                       | ✅                    |
| ADR-030-DB: covering INCLUDE                                            | `test_migrations_0002.py::test_covering_author_index_exists`                                                                        | ✅                    |
| ADR-030-DB: index-only scan via EXPLAIN                                 | **AUSENTE** — ADR-030-DB §"Test: integration via EXPLAIN ANALYZE" cita explicitamente                                               | ❌ (fica para Fase 2) |
| ADR-034: fastupdate=on                                                  | `test_migrations_0004.py::test_gin_index_has_fastupdate_on`                                                                         | ✅                    |
| ADR-034: gin_pending_list_limit=2048                                    | `test_migrations_0004.py::test_gin_index_has_pending_list_limit_2mb`                                                                | ✅                    |
| ADR-034: autovacuum scale_factor 0.05/0.02/10ms                         | `test_migrations_0004.py::test_search_index_table_autovacuum_aggressive`                                                            | ✅                    |
| Bug 1: author_id UUID                                                   | `test_app_config.py::test_search_index_author_id_is_uuid` + `test_migrations_0001.py::test_search_index_author_id_is_uuid_in_db`    | ✅                    |
| Constraint: FK ON DELETE CASCADE para article_id                        | **AUSENTE** — testar via DELETE no parent e contagem                                                                                | ❌                    |
| Constraint: FK ON DELETE CASCADE para author_id                         | **AUSENTE** — testar via DELETE no user e contagem                                                                                  | ❌                    |
| Constraint: FK ON DELETE SET NULL para category_id                      | **AUSENTE**                                                                                                                         | ❌                    |

**Cobertura quantitativa estimada Fase 1**: 18 cenários cobertos / 27 esperados ≈ **66%**. Acima do gate global 40% (`pytest.ini` indireto via `--cov-fail-under=40`), mas abaixo do gate local da feature `apps/search/ ≥85%` (TEST-STRATEGY §9.6). **Diferença explicada**: cobertura _de código_ deve ser muito alta (migrations são quase puro SQL — pouca lógica Python para cobrir); cobertura _de invariantes_ tem gaps reais nos itens marcados ❌.

---

## §5. Open questions (novas, não as do DESIGN)

1. **Q-NEW-1 (H-01)**: o BACKLOG classifica T30.4.X7 como `🟡 Medium` e ADR-039 exige `ENABLE ALWAYS` na 0003. Qual prevalece? Recomendação dura: ADR é fonte de verdade arquitetural; BACKLOG deve ser corrigido para promover T30.4.X7 a `🔴 Immediate` E absorver a parte da migration na 0003 (deixando só "cron audit" + "test integration" como T30.4.X7 restante).

2. **Q-NEW-2 (M-01)**: a tabela `search_log` deve ser criada **agora** (Fase 1, com schema "ingênuo" plano) ou apenas em **Fase 4** quando ADR-035 estiver materializado e SearchLogService for escrito? Risco da criação agora: cargo cult de uso (Fase 2 dev tenta gravar sem pseudonimização). Risco de adiar: 1 migration a mais. Recomendação: **adiar** — comentar o `CREATE TABLE search_log` em 0001 e mover para `0005_search_log_lgpd.py` que vem junto com SearchLogService.

3. **Q-NEW-3 (M-04)**: idempotência da migration 0001 — em produção, primeira execução é via `migrate` Django (DDL roda dentro da transação Django; OK). Mas se houver `reset_db` parcial (DROP TABLE search_index sem DROP CONFIGURATION) e depois `migrate` novamente, a migration 0001 acerta o `IF NOT EXISTS` e segue. Confirmar com o usuário se o ciclo de recovery está documentado em runbook.

4. **Q-NEW-4 (L-01)**: `SECURITY DEFINER` + `SET search_path` na trigger function vale o custo cognitivo extra? Recomendação: SIM, é zero-custo. Adicionar.

5. **Q-NEW-5 (testes de constraint)**: testes de FK CASCADE/SET NULL devem ficar na Fase 1 (DB layer) ou são responsabilidade da Fase 2 (SearchService valida)? Recomendação: ficam aqui — são propriedades do schema, não do service.

---

## §6. Tasks novas para BACKLOG

| ID proposto   | Título                                                                                                                                                                                                                                        | Prioridade   | Origem                |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------------------- |
| **T30.1.5d**  | Migration 0003 adicionar `ALTER TABLE articles ENABLE ALWAYS TRIGGER articles_sync_search` (+remove_search) + test `test_triggers_are_enable_always` checando `pg_trigger.tgenabled='A'`                                                      | 🔴 Immediate | H-01 / ADR-039        |
| **T30.1.X13** | Migration 0001 mover `ALTER TEXT SEARCH CONFIGURATION ... ALTER MAPPING` para dentro do bloco `DO $$ ... END $$` (idempotência forte) + test `test_pt_unaccent_mapping_idempotent_on_rerun`                                                   | 🟡 Medium    | M-04                  |
| **T30.1.X14** | Migration 0001 (ou 0005 novo) — remover criação de `search_log` da Fase 1; recriar apenas em `0005_search_log_lgpd.py` junto com ADR-035 e SearchLogService                                                                                   | 🟡 Medium    | M-01 / Q-NEW-2        |
| **T30.1.X15** | Trigger function: adicionar `SET search_path = pg_catalog, public` em `trg_articles_sync_search` + `trg_articles_remove_search` (defesa em profundidade contra search-path injection)                                                         | ⚪ Low       | L-01                  |
| **T30.1.X16** | Test "negativo" da `UPDATE OF`: update `view_count`/`slug`/`is_featured` em artigo publicado NÃO atualiza `indexed_at` (garante que otimização da `UPDATE OF` não é perdida)                                                                  | 🟡 Medium    | M-02                  |
| **T30.1.X17** | Tests de FK constraint: DELETE author → search_index linhas CASCADE; DELETE category → search_index.category_id vira NULL; DELETE article → CASCADE                                                                                           | 🟡 Medium    | §4 gaps de constraint |
| **T30.1.X18** | Refactor — extrair `_split_sql_statements` para `apps/search/migrations/_helpers.py` OU adicionar comment-lock `# DUPLICATED in 0001/0003` em ambos                                                                                           | ⚪ Low       | M-03                  |
| **T30.1.X19** | Stopword test: `to_tsvector('public.pt_unaccent', 'não')` retorna `''::tsvector` (ADR-019 §"Verificação de propriedades" cita explicitamente)                                                                                                 | 🟡 Medium    | §4 gap ADR-019        |
| **T30.1.X20** | Comment-lock em `0003:103-105` listando explicitamente os campos de Article que NÃO disparam trigger (slug, view_count, is_featured, cover_image, cover_caption, updated_at) — guarda contra regressão silenciosa                             | ⚪ Low       | M-02                  |
| **TX-25**     | Atualizar `README.md` da `apps.search` com a lista correta dos arquivos de teste (drift de doc)                                                                                                                                               | ⚪ Low       | L-04                  |
| **TX-26**     | Reconciliação spec: BACKLOG.md linha 784 deve casar com ADR-039 — promover T30.4.X7 a `🔴 Immediate` E desacoplar "ENABLE ALWAYS na migration" (vira T30.1.5d) de "test integration + cron audit" (continua T30.4.X7 mas com escopo reduzido) | 🟠 High      | H-01 (processo)       |

**Total: 11 tasks novas** (1 🔴 Immediate, 1 🟠 High, 6 🟡 Medium, 3 ⚪ Low).

---

## §7. Recomendação para `code-implementer` ANTES de Fase 2

### Faça em commits separados, antes de tocar em `services.py`:

1. **Commit 1 (T30.1.5d) — H-01**: adicionar `ALTER TABLE articles ENABLE ALWAYS TRIGGER ...` à migration 0003 + reverse + test. **Não é destrutivo** (`ENABLE ALWAYS` em migration nova é idempotente se rodar 2×). Custo: 10 minutos. **Retorno**: fecha o vetor M-04 antes do SearchService começar a depender da consistência.

2. **Commit 2 (T30.1.X13) — M-04**: corrigir idempotência forte do `ALTER MAPPING` (mover para dentro do `DO $$`). Custo: 5 minutos.

3. **Commit 3 (T30.1.X19 + T30.1.X16 + T30.1.X17)**: adicionar os 3 grupos de teste faltantes (stopword, UPDATE OF negativo, FK constraints). Custo: 30 minutos. **Retorno**: cobertura de invariantes sobe para ≥85% local conforme TEST-STRATEGY.

4. **Commit 4 (M-01 / Q-NEW-2)**: **decidir** com o usuário se mantém `search_log` na Fase 1 (com docstring "shell, não usar ainda") ou move para 0005. Não inicia Fase 2 sem essa decisão — SearchService Fase 2 vai querer logar.

5. **Commit 5 (TX-26)**: reconciliação da spec — corrigir BACKLOG/tracker para casar com ADR-039. Doc-only, mas é onde o defeito de processo virou defeito de código.

**Tempo total estimado: 1h30min de implementador + 15min de revisão**. Bloqueio efetivo da Fase 2: zero — você pode literalmente abrir a branch da Fase 2 em paralelo, mas o PR final da US30.1 não fecha sem H-01 resolvido.

### Não faça antes de Fase 2:

- L-01 (`SECURITY DEFINER` + `SET search_path`) — opcional, custo zero, mas pode entrar em PR separado de "hardening" pós-MVP. Sem impacto na Fase 2.
- L-02 (settings para `gin_pending_list_limit`) — adiar. Tuning real só depois de medir.
- L-04 (README drift) — corrigir junto com Commit 5 (linha única).

---

## §8. Itens validados (anti-sycophancy é justa — onde estiver bom, diga)

Para o `code-implementer` saber o que está sólido e não tocar:

1. **Splitter SQL multi-statement** (`0001:199-232`, `0003:128-154`): respeita blocos `$$...$$` via paridade de contagem; lida com comments `--`; lida com linhas vazias. Testado implicitamente porque as migrations rodam tanto em PG quanto em SQLite. **Solidíssimo**. Único defeito é duplicação (M-03).

2. **Tratamento do "fantasma do publicado" (Bug 3 do specialist)**: trigger faz `DELETE FROM search_index WHERE article_id = NEW.id` quando `status != 'published' OR published_at IS NULL` (`0003:73-77`). Cobre revert published → draft. Cobre publication scheduled cancelada (`published_at = NULL`). Teste `test_bulk_update_status_to_draft_removes_from_index` valida. **Correto**.

3. **`CONCURRENTLY` com `atomic = False`**: 0002 está literalmente certo. Comment em `0002:91-97` é honesto sobre risco de falha parcial em produção e como recuperar. **Maduro**.

4. **Unidade `gin_pending_list_limit = 2048`**: documentação Postgres confirma — `ALTER INDEX` aceita inteiro em KB; `2048` = `2MB`. O comment em `0004:88-91` explica que o formato `'2MB'` (string) só funciona em `SHOW`, não em `ALTER`. **Implementador acertou um detalhe que muita gente erra**.

5. **`COALESCE(NEW.title, '')`** etc. na trigger (`0003:53-58`): defesa contra NULL implícito que evita `setweight(NULL, 'A') || ...` virar NULL inteiro (NULL || qualquer = NULL). **Boa prática silenciosa**.

6. **`db_column='...'` em todos os campos do `SearchIndex`** (`models.py:49-59`): garante que ORM use exatamente os nomes do schema SQL. **Defensivo correto** dado `managed = False`.

7. **Trigger DELETE separada (`articles_remove_search`)** apesar de FK `ON DELETE CASCADE` (`0003:86-93`): o comment em `0003:83-85` explica — cobre cenário de FK desabilitada temporariamente (mesmo session_replication_role). **Decisão arquitetural pensada**, não redundância à toa.

8. **`pytest.ini` registra `requires_postgres` corretamente** (`pytest.ini:23`) com `--strict-markers` ativo (`pytest.ini` addopts). **Não há risco de typo silencioso no marker** — pytest vai falhar duro se alguém escrever `@pytest.mark.requires_postgress`. Excelente disciplina.

9. **Test `test_search_index_author_id_is_uuid_in_db`** (`test_migrations_0001.py:180-193`): valida o tipo no nível do **DB**, não só do ORM. Bug 1 do specialist é testado tanto via `_meta.get_field` (test_app_config) quanto via `information_schema` (test_migrations_0001). **Defesa em profundidade no test**.

10. **README** (apesar do drift L-04) é **bom** como onboarding: cita ADRs, explica `managed = False`, lista fallback SQLite, dá comandos. Substancialmente acima da média.

---

## §9. Recomendação final ao orquestrador

- **Pode despachar `code-implementer` para Fase 2** (SearchService + DTOs) **EM PARALELO** com as 5 ações do §7. Não há conflito de arquivos: §7 toca `migrations/` + `tests/`; Fase 2 toca `services.py` + `dto.py` (stubs hoje).
- **PR final da US30.1 NÃO mergeia** sem T30.1.5d (H-01) resolvido. Esse é o gate dura.
- **Próximo handoff**: este REVIEW vai para o `documentation-engineer` (para atualizar BACKLOG/tracker conforme TX-26) E para o `code-implementer` (para executar as ações do §7).

---

**Fim do REVIEW-PHASE-1.md** — 1 High, 4 Medium, 4 Low, 11 tasks novas, 10 itens validados.

**Reviewer signature**: `gsd-code-reviewer` (Opus 4.7 — sócio sênior, Gabarito aplicado, anti-sycophancy ativo).
