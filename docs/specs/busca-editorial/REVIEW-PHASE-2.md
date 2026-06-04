# REVIEW — Fase 2 (Backend leitura) — Busca Editorial

**Reviewer**: `gsd-code-reviewer` (Opus 4.7, Gabarito aplicado, anti-sycophancy ativo)
**Data**: 2026-06-04 00:33 GMT-3 · **Branch**: `develop` · **Range**: `64c49d9..e4ce5df` (10 commits)
**Materializado por**: main-loop (agent retornou conteúdo mas não pôde escrever; salvo no path canônico)

---

## §0. Veredito

**APROVADO COM RESSALVAS** — Fase 3 (frontend) PODE começar consumindo o endpoint; PR final da US30 bloqueado até 3 achados 🟠 serem fixados.

A Fase 2 entrega os 12 invariantes com fidelidade alta (CTE Postgres correta, cursor HMAC timing-safe testado, cache key SHA256 isolado por `auth_tier` mata H-04, throttle 3-camadas defende H-03, ENABLE ALWAYS fix do REVIEW-PHASE-1-H-01); mas três falhas materiais existem: (1) **Inv #12 quebrada** — `SET LOCAL statement_timeout` roda em TX separada da query real porque cada `with connection.cursor()` é uma TX implícita em autocommit; (2) **`Vary: Authorization` + `Cache-Control: public`** é semanticamente perigoso para CDN (fragmentação para autenticado + risco caso o invariante function-pure seja quebrado por refactor futuro); (3) **`SEARCH_CURSOR_HMAC_SECRET` faz fallback silencioso para `SECRET_KEY`** em prod — leak do SECRET_KEY permite forjar cursores. Nenhum bloqueia Fase 3 (frontend não toca esses arquivos).

---

## §1. Skills aplicadas

`code-review-excellence`, `django-pro`, `postgresql`, `cc-skill-security-review`, `superpowers:systematic-debugging`. Mapeamento roadmap.sh: `backend` + `cyber-security` + `full-stack` — sem desvio mainstream.

---

## §2. Conformidade — 12 invariantes algorithms specialist

| #   | Invariante                               | Status          | Arquivo:linha                                        | Test                                                     |
| --- | ---------------------------------------- | --------------- | ---------------------------------------------------- | -------------------------------------------------------- |
| 1   | Determinismo                             | ✅              | `dto.py:30,60,85,107` + `services.py:267`            | `test_dto.py` frozen                                     |
| 2   | Normalização simétrica                   | ✅              | `utils.py:50` único; `services.py:51`, `cache.py:31` | `test_utils.py` idempotência+hífen                       |
| 3   | `plainto_tsquery` (não `to_tsquery`)     | ✅              | `services.py:234`                                    | `test_service.py:170-185`                                |
| 4   | Status published + published_at NOT NULL | ✅              | `services.py:177-179` + trigger 0003                 | `test_migrations_0005.py`                                |
| 5   | Cursor inválido → 400 (não 500)          | ✅              | `cursors.py:108` + `views.py:104-112`                | `test_cursors.py:75-116` (6 tampers)                     |
| 6   | `ROUND(score, 6)` simétrico              | ✅              | `services.py:253-256` + `cursors.py:79`              | `test_cursors.py:57-69`                                  |
| 7   | Empty tsquery early-exit                 | ✅              | `services.py:148-156` + stopwords `:61-65`           | `test_service.py:60-82` (CaptureQueriesContext 0 hits)   |
| 8   | Cap tokens significativos                | ✅              | `services.py:141-145`                                | `test_service.py:97-119`                                 |
| 9   | Cap depth paginação                      | ✅              | `cursors.py:127-132`                                 | `test_cursors.py:122-144`                                |
| 10  | Recency boost `exp(-Δt/half-life)`       | ✅ código       | `services.py:251-258`                                | ❌ **AUSENTE** unit test do decay                        |
| 11  | `query_terms_expanded` via `ts_lexize`   | ⚠️              | `services.py:350-369`                                | `test_service.py:126-131` só shape, não expansão         |
| 12  | `SET LOCAL statement_timeout`            | ❌ **QUEBRADA** | `services.py:341-348`                                | `test_service.py:191-211` só `mock.called` — ver F2-B-01 |

**9 ✅ · 2 ⚠️ · 1 ❌**

---

## §3. Conformidade ADRs

| ADR                                              | Status                             | Onde                                |
| ------------------------------------------------ | ---------------------------------- | ----------------------------------- |
| **ADR-021** ts_rank_cd + half-life 60d + CTE 500 | ✅ literal                         | `services.py:239,254,277`           |
| **ADR-021b** mitigações GIN pior-caso            | ⚠️ statement_timeout quebrado      | F2-B-01                             |
| **ADR-022** highlight client-side                | ✅ wire OK; semântica untested     | `serializers.py:159`                |
| **ADR-023** endpoint + cache headers + Vary      | ⚠️ Vary problemático               | F2-B-02                             |
| **ADR-024** DRF throttling 3 scopes              | ✅                                 | `throttles.py` + `settings:444-450` |
| **ADR-025** total = max(plan_rows, floor)        | ✅ aritmética; ⚠️ custo do EXPLAIN | F2-W-01                             |
| **ADR-036** throttle global anti-botnet          | ✅                                 | `throttles.py:45-71` key estática   |
| **ADR-037** cache key inclui auth_tier           | ✅ + fail-fast                     | `cache.py:64-94`                    |
| **ADR-039** triggers ENABLE ALWAYS               | ✅ FIX Fase 1 H-01                 | `migrations/0005_*.py`              |

---

## §4. Achados por severidade

### 🟠 BLOCKER PR final (não bloqueia Fase 3)

**F2-B-01** — `services.py:341-348` — `SET LOCAL statement_timeout` em `with connection.cursor()` separado fecha TX implícita; a query real em `:285-287` abre OUTRA TX → timeout não se aplica (Inv #12 quebrada). **Mitigação**: envolver `_query_postgres` em `@transaction.atomic` com SET LOCAL no início, OU usar `OPTIONS={'options': '-c statement_timeout=500'}` no DATABASES; test deve `SHOW statement_timeout` dentro da mesma TX da query. CWE-400 (mitigado por Inv #8 em camada).

**F2-B-02** — `views.py:48-53` — `Cache-Control: public` + `Vary: Authorization` em endpoint AllowAny: Cloudflare gera key por valor de Authorization → autenticados (cada JWT único) têm hit rate ≈ 0; pior, se Interpop usa cookie httpOnly (CLAUDE.md §4) o header `Authorization` nem é enviado → CDN merge anon+user. Hoje "seguro" só porque response é function-pure; qualquer regressão futura vaza cross-tier via CDN. **Mitigação**: `private` para autenticado / `public` para anônimo (via if no `_apply_cache_headers`). CWE-524.

**F2-B-03** — `settings/base.py:437-439` — `SEARCH_CURSOR_HMAC_SECRET` faz `default=SECRET_KEY` sem warn/fail em prod. Leak de SECRET_KEY permite forjar cursor (manipular `depth`, bypass A3 paginação profunda). **Mitigação**: `production.py` deve `raise ImproperlyConfigured` se HMAC secret == SECRET_KEY ou vazio. CWE-321.

### 🟡 WARNING

- **F2-W-01** `services.py:371-383` — `_explain_estimate` re-executa SQL como EXPLAIN no caminho quente (10-50ms planning de CTE). Cachear por `(q_norm, filtros)` 60s.
- **F2-W-02** `services.py:293-305` — `_article_to_result(article, score=score)` usa `article.published_at` do ORM, não da CTE — race condition pode dessincronizar com cursor (Inv #1 vulnerável). Passar `_pub` da CTE.
- **F2-W-03** `services.py:223,341,350,371` — `_query_postgres` e helpers Postgres com `# pragma: no cover`; sem CI Postgres, **0% real** sobre o núcleo. `test_uses_plainto_tsquery_not_to_tsquery` PULA em SQLite-dev → verde falso.
- **F2-W-04** `throttles.py:24-32` — `AnonRateThrottle` confia em X-Forwarded-For; confirmar `NUM_PROXIES` em production.py + documentar dependência CF-Connecting-IP/Nginx.
- **F2-W-05** `utils.py:44` (`\w` Python ASCII default) vs `serializers.py:31` (whitelist `À-ſ`) — divergência simétrica latente; extrair `ALLOWED_Q_CHARSET` para constante única.
- **F2-W-06** `cache.py:128-132` — `cache.clear()` em fallback apaga TODO cache (sessions, throttle DRF). Restringir a `DEBUG=True` ou raise.
- **F2-W-07** `migrations/0005_*.py:38-41` — `ALTER TABLE ... ENABLE ALWAYS TRIGGER` sem `IF EXISTS`/DO-block quebra idempotência das migrations 0001-0004.

### ⚪ Low

- **F2-L-01** `services.py:62-65` stopwords pt-BR hardcoded — drift latente com `portuguese.stop`.
- **F2-L-04** `cursors.py:67` `secret.encode('utf-8')` recomputado a cada `_sign` (microbench).
- **F2-L-05** `dto.py:101` `dict[str, Any]` — usar TypedDict.
- **F2-L-07** `signals.py:38` import direto de `apps.articles.models` — comment-lock contra ordem INSTALLED_APPS.
- **F2-L-08** `services.py:399` `getattr(user, 'username', '')` defensivo desnecessário.
- **F2-L-09** TTL Redis 300s vs `max-age=60` HTTP — discrepância deliberada (SWR), documentar.

---

## §5. Verificação achados Fase 1 (REVIEW-PHASE-1)

- **H-01** triggers ENABLE ALWAYS → ✅ **MITIGADO** por migration 0005 + `test_migrations_0005.py` (151 linhas).
- **M-01** search_log LGPD → ⏳ pendente, mas Fase 2 corretamente NÃO escreve em search_log; tarefa de Fase 4.
- **M-02, M-03, M-04** → ⏳ não tocados (escopo correto).
- **L-01..L-04** → ⏳ pendentes (não bloqueavam).
- **Q-NEW-2 (search_log onde)** → implicitamente decidido: adiar para Fase 4.

---

## §6. Cobertura testes — gaps

- ❌ Inv #10 score-decay (sem unit test mockando NOW).
- ⚠️ Inv #11 stems apenas shape, não expansão semântica.
- ❌ Inv #12 efetivo (só mock.called).
- ❌ Race CTE↔in_bulk (F2-W-02).
- ⚠️ Throttle 429 sob carga 3-camadas — `test_throttles.py` 63 linhas (presumido cobertura básica).
- ✅ Cursor (11 cenários), cache key isolation (cross-tier MISS), empty early-exit (0 DB queries), feature flag, headers, whitelist H-01, date-range, signals.

**Cobertura de invariantes ~87.5%**; cobertura de código real do `_query_postgres` = **0%** por design (pragma).

---

## §7. Open questions

1. **Q-PH2-1 (F2-B-01)**: confirmar via `SHOW statement_timeout` em PG real que o SET LOCAL não cruza TX. Teste de integração precede correção.
2. **Q-PH2-2 (F2-B-02)**: JWT do Interpop está em cookie httpOnly (CLAUDE.md §4) ou header? Se cookie, `Vary: Authorization` literalmente não tem efeito para autenticados → CDN merge tier. Se confirmar, achado vira 🔴.
3. **Q-PH2-3 (F2-W-01)**: medir custo real do EXPLAIN antes de remover/cachear?
4. **Q-PH2-4 (F2-L-09)**: discrepância TTL 300s/max-age 60s deliberada para SWR? Documentar.

---

## §8. Tasks novas BACKLOG

| ID       | Título                                                                                                | Prioridade                      |
| -------- | ----------------------------------------------------------------------------------------------------- | ------------------------------- |
| T30.2.B1 | `@transaction.atomic` em `_query_postgres` + SET LOCAL no início; test `SHOW statement_timeout=500ms` | 🔴 Immediate (PR-final blocker) |
| T30.2.B2 | Confirmar auth header vs cookie; Cache-Control private/public por tier                                | 🔴 Immediate (PR-final blocker) |
| T30.2.B3 | `production.py` raise `ImproperlyConfigured` se HMAC_SECRET == SECRET_KEY                             | 🔴 Immediate (PR-final blocker) |
| T30.2.W1 | Cachear `_explain_estimate` por (q_norm, filtros) 60s                                                 | 🟡 Medium                       |
| T30.2.W2 | Passar published_at da CTE para `_article_to_result` (anti-race)                                      | 🟡 Medium                       |
| T30.2.W3 | CI Postgres job para remover pragma:no cover                                                          | 🟡 Medium                       |
| T30.2.W4 | Confirmar NUM_PROXIES em production.py + doc XFF/CF                                                   | 🟡 Medium                       |
| T30.2.W5 | Extrair ALLOWED_Q_CHARSET para constante compartilhada                                                | 🟡 Medium                       |
| T30.2.W6 | Substituir `cache.clear()` fallback por raise em prod                                                 | 🟡 Medium                       |
| T30.2.W7 | Migration 0005 DO-block com tgname check (idempotência)                                               | 🟡 Medium                       |
| T30.2.T1 | Test Inv #10 score-decay (mock NOW)                                                                   | 🟡 Medium                       |
| T30.2.T2 | Test Inv #11 stems (`cantores → cantor`) Postgres                                                     | 🟡 Medium                       |
| T30.2.T3 | Test race CTE↔in_bulk                                                                                 | 🟡 Medium                       |
| T30.2.L1 | TypedDicts author/category                                                                            | ⚪ Low                          |
| T30.2.L2 | Comment-lock signals.py INSTALLED_APPS order                                                          | ⚪ Low                          |

**Total**: 15 (3 🔴 · 10 🟡 · 2 ⚪).

---

## §9. Recomendação ANTES de Fase 3

**Fase 3 pode começar em paralelo** com T30.2.B1/B2/B3 — endpoint contract (shape JSON) está estável e correto conforme ADR-023. Frontend não toca os 3 arquivos com bug.

**Quality gate adicional ANTES do PR final US30**:

- [ ] T30.2.B1/B2/B3 mergeados
- [ ] Cobertura de invariantes ≥90% (subir Inv #10 + Inv #11 semantic)
- [ ] Decisão Cache-Control public/private por tier registrada no DESIGN
- [ ] BACKLOG atualizado com as 15 tasks acima

---

## §10. Itens validados (anti-sycophancy justa)

1. **`utils.normalize_search_text` idempotência** (`utils.py:97-102`) — dedup com `seen: set` previne `f(f(x)) ≠ f(x)` ao re-expandir `k-pop kpop`. Excelente atenção ao detalhe.
2. **Cursor HMAC timing-safe** (`cursors.py:108`) — `hmac.compare_digest` honra L-04 SECURITY-REVIEW.
3. **Cache key inclui cursor** (`cache.py:87-93`) — granularidade por página, mas `canonical_query_string` separa "shape" para reuso futuro.
4. **`auth_tier` fail-fast** (`cache.py:81-86`) — ValueError em valor desconhecido mata H-04 antes de acontecer.
5. **CTE Postgres** (`services.py:232-269`) — implementação literal da spec algorithms §7: CTE `q` factor-out, `candidates` LIMIT 500, `scored` ROUND(6), tuple comparison, ORDER BY com 3 tiebreakers.
6. **`q.query IS DISTINCT FROM ''::tsquery`** (`services.py:243`) — belt-and-suspenders contra empty tsquery que escapou do early-exit Python.
7. **Side-fetch `in_bulk(field_name='id')`** (`services.py:294-298`) — anti N+1 idiomático preservando ordem do ranking.
8. **DTOs frozen + slots=True** — determinismo Inv #1 por construção, não por convenção.
9. **Throttle key estática global** (`throttles.py:64-71`) — comment claro do trade-off, ADR-036 maduro.
10. **`X-Cache: HIT/MISS`** (`views.py:97,126`) — observabilidade sem custo.
11. **Signals com `dispatch_uid`** (`signals.py:44,60`) — previne double-registration.
12. **Migration 0005 vendor-guard + reverse simétrico** — mantém tradição 0001-0004.
13. **`validate_q` com 3 códigos de erro distintos** (`serializers.py:61-83`) — API contract claro para cliente.
14. **`cache.clear()` autouse fixture** (`test_views.py:26-31`) — sem flakiness.

---

**Reviewer signature**: `gsd-code-reviewer` · Veredito **APROVADO COM RESSALVAS** · **GO** para Fase 3 frontend em paralelo · **NO-GO** PR final sem T30.2.B1/B2/B3.
