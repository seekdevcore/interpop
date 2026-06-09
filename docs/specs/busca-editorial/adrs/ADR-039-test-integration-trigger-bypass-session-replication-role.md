# ADR-039: Test integration de não-bypass de trigger SQL (`session_replication_role='replica'`) + trigger `ENABLE ALWAYS`

- **Status**: Accepted
- **Date**: 2026-06-03
- **Tags**: security, database, postgres, trigger, defense-in-depth, integrity, audit
- **Stakeholders**: cyber-security-architect (autor da review), database-architect, testing-engineer, code-implementer
- **Layer**: Security / Database
- **Origin**: SECURITY-REVIEW.md §3 achado **M-04** + §7.6 contestação (factory_boy + replica role)

## Context

ADR-018 estabelece `trg_articles_sync_search` como **fonte de verdade da consistência** entre `articles` e `search_index`. O `cyber-security-architect` identificou (M-04) que triggers PostgreSQL podem ser **bypassados** por:

- `SET session_replication_role = 'replica'` — triggers tipo `ORIGIN` (default) ignoradas; só triggers `ENABLE ALWAYS` ou `ENABLE REPLICA` rodam.
- Role com permissão `REPLICATION` ou superuser.

Cenários de risco:

1. **Insider comprometido** com acesso `postgres` user no Hostinger KVM 1 executa `SET session_replication_role='replica'` + INSERT em `articles` — artigo aparece em listagem pública (via FK) **sem** linha em `search_index` → artigo invisível na busca apesar de visível na home.
2. **Inverso**: atacante despublica artigo legítimo via bypass — entry em `search_index` permanece, busca mostra resultado que ao clicar redireciona para 404 ou drafts.
3. **Restore parcial** de backup (`pg_restore` usa `--disable-triggers` por padrão!) → tabelas restoradas em modo `replica` por design → linhas inseridas pulam trigger. Inconsistência silenciosa.
4. **Tests com `factory_boy`** (open question #3 do DESIGN §5): bypass via replica role é **feature desejável** — testes que não querem mexer em search_index usam o bypass. Mas se feature de teste vaza pra produção (ex.: management command com bug), reabre o vetor.

Specialist `database-architect` aceitou trade-off na v3 mas sem **garantia mecânica**. SECURITY-REVIEW §7.6 propõe: `ENABLE ALWAYS` em produção (immune a `replica` role) + test integration explícito que verifica que bypass falha em produção.

CWE-863 (Incorrect Authorization Check) + integridade de read-projection.

## Decision Drivers

- **Garantia mecânica** (test) de que `search_index` **não** drifta de `articles` sob nenhum cenário (CRUD direto, bulk update, raw SQL, bypass tentado).
- **Aceitar bypass em test** (factory_boy needs it) **rejeitando** em prod (segurança).
- **Detecção precoce** de drift via cron de auditoria diário.
- **Não confiar só em código operacional** — atestado por test rodando em CI todo PR.

## Considered Options

1. **Trigger default (`ENABLE`, ORIGIN apenas)** — DESIGN v3 atual; vulnerável a M-04.
2. **`CREATE TRIGGER ... ENABLE ALWAYS`** + test integration que tenta bypass e assert que falha + cron diário de audit drift ⭐
3. **Replicação lógica + reconciler async** — over-engineering para MVP.
4. **Remover trigger e voltar pra signal Python** — rejeitado por ADR-018 (cobre apenas CRUD ORM, falha em 4 cenários).

## Decision Outcome

**Chosen: Opção 2** — trigger `ENABLE ALWAYS` em produção + test integration de bypass tentado + cron diário de auditoria.

### Migration: `ENABLE ALWAYS`

Atualização da migration `apps/search/migrations/0003_search_triggers.py` (criada em ADR-018):

```sql
-- Trigger AFTER INSERT/UPDATE/DELETE como ENABLE ALWAYS
-- Imune a session_replication_role = 'replica'
-- Cobre: bulk update, raw SQL, restore parcial, bypass intencional
CREATE TRIGGER articles_sync_search
AFTER INSERT OR UPDATE OF status, published_at, title, excerpt, body,
                          author_id, category_id ON articles
FOR EACH ROW EXECUTE FUNCTION trg_articles_sync_search();

-- Após CREATE, força ENABLE ALWAYS:
ALTER TABLE articles
  ENABLE ALWAYS TRIGGER articles_sync_search;

ALTER TABLE articles
  ENABLE ALWAYS TRIGGER articles_remove_search;
```

### Exceção controlada para tests

Tests que querem desativar trigger (factory_boy criando massa de artigos sem mexer em SearchIndex) usam **role** com permissão de bypass explícita — **não** o role default da app:

```python
# apps/search/tests/conftest.py
import pytest
from django.db import connection

@pytest.fixture
def disable_search_trigger(db):
    """
    Desativa trigger via SET LOCAL session_replication_role='replica' DENTRO da transação.
    Funciona apenas porque tests rodam como user com REPLICATION grant (interpop_test).
    Em produção, role `interpop_app` NÃO tem REPLICATION → bypass falha.
    Ver SECURITY-REVIEW.md M-04 + ADR-039.
    """
    with connection.cursor() as cursor:
        cursor.execute("SET LOCAL session_replication_role = 'replica'")
        yield
        cursor.execute("SET LOCAL session_replication_role = 'origin'")
```

Uso em test específico:

```python
def test_factory_bulk_create_without_search_index(disable_search_trigger):
    ArticleFactory.create_batch(1000, status='published')
    assert SearchIndex.objects.count() == 0  # bypass ativo em test
```

### Test integration de não-bypass em prod-like (gate de CI)

```python
# apps/search/tests/test_trigger_no_bypass.py
@pytest.mark.requires_postgres_trigger
@pytest.mark.django_db
def test_enable_always_resists_replica_role():
    """
    Mesmo com session_replication_role='replica', trigger ENABLE ALWAYS dispara.
    Ver SECURITY-REVIEW.md M-04 + ADR-039.
    """
    with connection.cursor() as cursor:
        cursor.execute("SET LOCAL session_replication_role = 'replica'")
        # INSERT direto via SQL (mais raw possível)
        cursor.execute("""
            INSERT INTO articles (title, status, published_at, ...)
            VALUES ('Test bypass', 'published', NOW(), ...)
            RETURNING id
        """)
        article_id = cursor.fetchone()[0]

    # search_index DEVE estar populado mesmo com replica role
    assert SearchIndex.objects.filter(article_id=article_id).exists(), (
        "Trigger ENABLE ALWAYS falhou — bypass via replica role tem sucesso. "
        "VULN: M-04 reaberta. Ver ADR-039."
    )

@pytest.mark.requires_postgres_trigger
@pytest.mark.django_db
def test_drift_audit_query_returns_zero_in_healthy_state():
    """Query da auditoria diária deve retornar 0 em DB saudável."""
    ArticleFactory.create_batch(50, status='published')
    drift_count = Article.objects.filter(
        status='published'
    ).exclude(
        id__in=SearchIndex.objects.values('article_id')
    ).count()
    assert drift_count == 0
```

### Cron de auditoria diária

```python
# apps/search/management/commands/audit_search_drift.py
class Command(BaseCommand):
    """
    Cron diário (systemd timer) que detecta drift entre articles e search_index.
    Drift = artigo publicado SEM linha em search_index, OU search_index COM article_id removido.
    Alert Sentry se drift > 0. Ver SECURITY-REVIEW.md M-04 + ADR-039.
    """
    def handle(self, *args, **options):
        missing_in_index = Article.objects.filter(
            status='published'
        ).exclude(
            id__in=SearchIndex.objects.values('article_id')
        ).count()

        orphan_in_index = SearchIndex.objects.exclude(
            article_id__in=Article.objects.values('id')
        ).count()

        if missing_in_index > 0 or orphan_in_index > 0:
            sentry_sdk.capture_message(
                f"search_index drift detected: "
                f"missing={missing_in_index}, orphan={orphan_in_index}",
                level='error'
            )
        # Prometheus gauge atualizado em qualquer caso
        registry.search_drift_count.set(missing_in_index + orphan_in_index)
```

systemd timer `apps/search/ops/audit-search-drift.timer`:

```ini
[Timer]
OnCalendar=daily
RandomizedDelaySec=600  # spread carga
Persistent=true
```

### Positive Consequences

- **Bypass intencional** falha em produção (role app não tem REPLICATION grant + trigger ENABLE ALWAYS).
- **Tests mantêm flexibilidade** (factory_boy bypass via role de test apenas).
- **Detecção precoce de drift** — cron diário fecha janela de risco em ≤24h mesmo se outro vetor abrir drift.
- **Restore parcial** (`pg_restore --disable-triggers`) **ainda funciona** porque é operação intencional; cron pega o drift no próximo run e dispara reindex manual via `manage.py reindex_search`.
- **Test integration documenta a invariante** — code-implementer não pode "esquecer" `ENABLE ALWAYS` sem o CI quebrar.

### Negative Consequences

- **`ENABLE ALWAYS` em prod requer disciplina operacional** — DBA fazendo restore precisa rodar `manage.py reindex_search` ou aceitar 1 dia de drift no Sentry.
- **Test integration depende de `requires_postgres_trigger` marker** — sem Postgres real em CI, test skipa (cobertura aparente, ausência real). Mitigação: TX-09 (docker-compose Postgres em CI) + assertion explícita do vendor em CI (ver TEST-STRATEGY §9.11).
- **Cron de auditoria mete +1 cron no sistema** — operacional acumula; mitigação: convergir com outros crons de busca (purga search_log T30.4.X8) em um `apps/search/ops/` único.
- **False positive em drift transitório**: durante reindex em massa, query da auditoria pode pegar estado intermediário. Mitigação: cron roda em horário de baixo tráfego + tolerância ≤ 0.1% (não > 0 absoluto).

## Pros and Cons of the Options

### Opção 1 — Trigger default ORIGIN

- 👍 Comportamento Postgres clássico.
- 👎 Bypass trivial via replica role + restore parcial silencioso.

### Opção 2 — `ENABLE ALWAYS` + test integration + cron audit ⭐

- 👍 Defesa em 3 camadas (config + test + monitoring).
- 👍 Test no CI prova a invariante.
- 👎 Disciplina operacional em restore; cron adicional.

### Opção 3 — Replicação lógica + reconciler async

- 👍 Reconciler resolveria drift automaticamente.
- 👎 Over-engineering para MVP em KVM 1; complexidade injustificada.

### Opção 4 — Voltar pra signal Python

- 👍 Sem trigger SQL.
- 👎 Cobre apenas CRUD ORM (ADR-018 já rejeitou); reabre 4 cenários documentados.

## Implementation Notes

- **Task ID**: **T30.4.X7** — 🟡 Normal (mas blocking se ADR-018 for implementado sem ENABLE ALWAYS, este vira 🟠 High)
- **Migration**: atualizar `apps/search/migrations/0003_search_triggers.py` com `ALTER TABLE ... ENABLE ALWAYS TRIGGER ...`
- **Tests**:
  - `apps/search/tests/test_trigger_no_bypass.py::test_enable_always_resists_replica_role`
  - `apps/search/tests/test_trigger_no_bypass.py::test_drift_audit_query_returns_zero_in_healthy_state`
  - Marker `requires_postgres_trigger` (TX-20 da TEST-STRATEGY)
- **Cron**:
  - `apps/search/management/commands/audit_search_drift.py`
  - `apps/search/ops/audit-search-drift.{service,timer}` (systemd)
  - `apps/search/ops/audit-search-drift-cron.md` (runbook)
- **Métricas**:
  - Sentry custom event `search_index_drift_detected`
  - Prometheus gauge `interpop_search_drift_count`
  - Grafana panel + alerta `> 0 por 2 ciclos consecutivos`
- **Role separation**:
  - `interpop_app` (prod) — sem `REPLICATION` grant
  - `interpop_test` (test) — com `REPLICATION` grant para fixture `disable_search_trigger`
  - Documentar em `docs/ops/postgres-roles.md`
- **Coordenação com ADR-018** (trigger base) — este ADR é refinamento, não substituição.

## Open Concerns

- **`pg_restore --disable-triggers` é padrão** em DR — runbook DR (TX-13) precisa documentar passo obrigatório `manage.py reindex_search` pós-restore. Acoplado a ADR-032.
- **Postgres versão**: `ENABLE ALWAYS` é estável desde 8.3. Hostinger KVM 1 roda 16+, seguro.
- **Detecção tardia (24h)**: SLA de 24h para detectar drift é aceitável dado que apenas insiders ou DBAs conseguem o vetor. Reduzir para 1h se threat model mudar.

## References

- SECURITY-REVIEW.md §3 M-04 + §7.6
- BACKLOG.md T30.4.X7
- ADR-018 (trigger SQL = fonte de verdade — este ADR refina)
- ADR-032 (backup lean — interage com `--disable-triggers` do pg_restore)
- ADR-040 (property-based testing — testa invariante de simetria que cron pode usar como base)
- TEST-STRATEGY.md §7 TX-20 (marker `requires_postgres_trigger`)
- CWE-863 (Incorrect Authorization Check)
- PostgreSQL docs — `session_replication_role`, `ALTER TABLE ... ENABLE ALWAYS TRIGGER`
- PostgreSQL docs — `pg_restore --disable-triggers` semantics
