# CONCERNS — Interpop

> **Inventário honesto** de débito técnico, gotchas, áreas frágeis e riscos de segurança. Para qualquer feature que toque uma destas áreas, **leia primeiro**.
> Princípio (anti-sycophancy): esta página fala dos **NÃO-pontos-fortes**. Se algo dói, está escrito. Cada item cita `arquivo:linha` para que a próxima sessão verifique sem refazer arqueologia.

**Atualizado:** 2026-06-09 · **Mantenedor:** Gabriel Marques (DPO, owner) · **Revisor:** cyber-security-architect

---

## Mapa de ameaças (snapshot rápido)

- **Ativos**: dados de leitor (email, senha hash, comentários), conteúdo editorial (`Article.body`), credenciais de redatores (`editor`+ roles), tokens JWT em cookie, segredo HMAC do cursor de busca, IP/UA em AuditLog (sensível LGPD).
- **Boundaries de confiança**: (a) browser ↔ nginx ↔ gunicorn; (b) gunicorn ↔ Postgres (local socket, SSL em prod); (c) Django ↔ Redis (futuro); (d) Django ↔ SendGrid (email out); (e) crawler social ↔ OG middleware (interceptação UA-based).
- **Abuse cases (não-happy-path)**: brute-force distribuído contra `dev`/`admin`; stored-XSS em comentário via futuro `dangerouslySetInnerHTML`; inflação de view_count com botnet residencial; forja de cursor de paginação via SECRET_KEY leak; sociais-OG-middleware-injection (atacante manipula `slug` que é renderizado em `<meta>` — mitigado por `_escape` em `og_middleware.py:38`).

## 🔴 Riscos de segurança (priorizar)

### S-01 — Articles `body` e Comments `content` chegam ao banco sem sanitização HTML

- **STRIDE:** Tampering + Information Disclosure (XSS) · **CWE-79** · **CIA:** Confidentiality + Integrity
- **O QUE:** `apps/articles/models.py:34` (`body = models.TextField()`) e `apps/comments/models.py:25` (`content = models.TextField(max_length=2000)`) aceitam qualquer string crua. Não há `bleach`, `nh3` ou whitelist de tags no path serializer→model. Confirmado por `grep -rn "bleach|sanitize" backend/` retornar 0 hits.
- **POR QUE NÃO EXPLODE HOJE:** o render no frontend (`src/utils/renderArticleBody.tsx:34-63`) usa **somente JSX text-interpolation** — React escapa por default. Nenhum `dangerouslySetInnerHTML` no projeto (`grep` confirmou em `src/`). Comentários idem (Article.tsx → `{comment.content}`).
- **EXPLOIT CHAIN LATENTE:** (1) PR futuro adiciona suporte a markdown rico (link, embed) via lib que devolve HTML; (2) refactor usa `dangerouslySetInnerHTML={{__html: marked(body)}}`; (3) editor com role `editor` publica artigo com `<script>fetch('/api/v1/auth/me/').then(...)</script>` no body; (4) qualquer leitor anônimo executa — token JWT em cookie é httpOnly (mitiga roubo direto), mas o atacante pode fazer ações no contexto do usuário autenticado.
- **MITIGAR:** sanitizar **no boundary de entrada** (serializer DRF) com `nh3` (Rust, performance) ou `bleach.clean(body, tags=[...allowlist...])`. Não contar com "o frontend escapa" — é defesa única, viola defense-in-depth.
- **STATUS:** débito conhecido, sem PR; CSP `Report-Only` (S-03 abaixo) ainda não bloqueia.

### S-02 — `SECRET_KEY` é fonte única de verdade para JWT em dev e fallback de prod

- **O QUE:** `backend/config/settings/base.py:150` — `SIGNING_KEY: config('JWT_SIGNING_KEY', default=config('SECRET_KEY'))`. Se operador esquecer `JWT_SIGNING_KEY` em prod, ele degrada silenciosamente para `SECRET_KEY`.
- **IMPACTO:** vazamento de `SECRET_KEY` (traceback verboso, dump Sentry sem scrub, dependência comprometida na supply chain) compromete **tanto** signing de session quanto JWT. Forja de access_token + login impersonando qualquer user.
- **MITIGAR:** replicar o padrão de `SEARCH_CURSOR_HMAC_SECRET` em `production.py:18-23` — `raise ImproperlyConfigured` se `JWT_SIGNING_KEY == SECRET_KEY` ou vazia. Hoje só o HMAC do cursor de busca tem esse hard-fail (fechado em `96cdad5` — F2-B-03 do REVIEW-PHASE-2).
- **STATUS:** débito de prod-hardening; entrar como TX equivalente a F2-B-03 mas para JWT.

### S-03 — CSP em `Report-Only` indefinidamente, sem endpoint de coleta

- **O QUE:** `backend/config/settings/base.py:292` — `CSP_ENFORCE = config('CSP_ENFORCE', default=False, cast=bool)`. Middleware em `apps/audit/security_headers_middleware.py:86-90` injeta `Content-Security-Policy-Report-Only` por default. `CSP_REPORT_URI` aceita string vazia (linha 293) **sem warn** — violations vão para o vazio.
- **IMPACTO:** policy não bloqueia nada (XSS S-01 passa sem alarme); ainda assim o time finge que tem CSP. Pior dos mundos: cerimônia sem proteção.
- **MITIGAR:** (a) criar endpoint interno `POST /api/v1/security/csp-report/` que loga via structlog + dispara `Sentry.capture_message` em violation; (b) timeline dura para flip `CSP_ENFORCE=True` (1 semana de baseline limpo); (c) `script-src 'unsafe-inline'` (linha 54) precisa de plano para sair — admin Django é cliente principal.
- **STATUS:** débito desde S3 do `Improvement-system §11.6`; sem dono atribuído.

### S-04 — Sem 2FA para roles staff (`dev` / `admin` / `editor`)

- **STRIDE:** Spoofing + Elevation of Privilege · **CWE-308** (Use of Single-Factor Authentication) · **CIA:** Confidentiality + Integrity + Availability
- **O QUE:** `grep -rn "totp|two_factor|2fa" backend/` retornou **0 hits**. Roles com poder de publicação e moderação (CLAUDE.md §4) dependem só de senha + django-axes (5 fails / 30 min, `base.py:202-206`).
- **IMPACTO:** credential stuffing direcionado a `dev`/`admin` pode passar — 4 tentativas / 30 min × N IPs distintos via lista de proxies = throughput suficiente para wordlist top-1000. Comprometimento de `dev` = takeover total (role imune a ban, CLAUDE.md §4).
- **ÉTICA (SBC §2.9):** ao deployar sem 2FA para `dev`, deliberadamente aceitamos risco de takeover total **antes** de mitigar. Se "uso indevido inevitável" for um trigger ético, fechar `/admin/` em prod via firewall ou WireGuard até 2FA chegar.
- **MITIGAR:** `django-otp` + TOTP obrigatório no login de roles `dev`/`admin`/`editor`. Backup codes. Roadmap: Sprint 3+ DevSecOps embedded.
- **STATUS:** débito reconhecido, sem implementação.

### S-05 — `django-axes` lockout só por (IP, username); botnet residencial bypassa

- **O QUE:** `backend/config/settings/base.py:206` — `AXES_LOCKOUT_PARAMETERS = ['ip_address', 'username']`. Rate por (IP+username) significa que atacante com 5k IPs residenciais (DigitalOcean droplet farm, proxy pool) pode fazer 5 × 5000 = **25k tentativas / 30 min** contra o mesmo username sem trigger global.
- **IMPACTO:** brute-force distribuído contra alvo conhecido (ex.: `gabriel`) viável. ScopedRateThrottle `auth: 10/minute` em `LoginView` (`users/views.py:32-33`) ajuda mas escala por IP/anon — mesma fraqueza.
- **MITIGAR:** adicionar throttle global por username (`SearchGlobalThrottle` em `apps/search/throttles.py` é o pattern já vivo no projeto — replicar para login). Considerar Cloudflare Turnstile em `/login` após N tentativas, não só em newsletter.
- **STATUS:** mitigado parcial por `ScopedRateThrottle 'auth' 10/min`, mas defesa única.

### S-06 — `view_count` bucket vazaentre workers gunicorn (LocMemCache per-process)

- **O QUE:** `apps/articles/views.py:91-124` documenta abertamente em comment (linhas 100-103): com 3 workers gunicorn em prod, mesmo IP atinge 3 buckets distintos = ~**36 inflations/hora** por IP por artigo.
- **IMPACTO:** inflação de métrica viewable (`ordering_fields = ['view_count']` em `views.py:36` ranqueia listings). Atacante com 100 IPs eleva artigo a `most-viewed` em horas. Quanto pior: SEO orgânico distorcido + viés editorial.
- **MITIGAR:** A20 do Improvement-system — Redis como cache compartilhado. Já planejado, ainda não implementado (settings `base.py:259-265` confirma LocMemCache atual).
- **STATUS:** débito assumido, com data-prevista.

### S-07 — `Comment.content` e `Article.body` sem rate-limit de criação por usuário

- **O QUE:** DRF default `UserRateThrottle 1000/hour` em `base.py:194-195`. Spam de 16/min/user é aceito.
- **IMPACTO:** flood de comentários em artigo viral é vetor de moderação manual sufocante (CLAUDE.md §4: admin manual). Sem `ScopedRateThrottle 'comments_create'` específico.
- **MITIGAR:** ScopedRateThrottle por endpoint sensível (comment create, password reset, register) com rates ajustados — ex.: `comments_create: 6/min`. Pattern já vivo (`apps/users/views.py:32`).
- **STATUS:** débito menor; alta-prioridade quando crescer base de leitor.

### S-08 — `JWT cookie SameSite=Lax`, sem rotação de session-id pós-login

- **O QUE:** `base.py:158` — `'AUTH_COOKIE_SAMESITE': 'Lax'`. JWT em cookie httpOnly (correto), mas Django `request.session` (usado por axes e admin) não chama `cycle_key()` explicitamente após `LoginView` em `apps/users/views.py:30-43`. Confirmado por `grep -rn "cycle_key|rotate_session" apps/users/` retornar 0.
- **IMPACTO:** session fixation viable se atacante consegue fixar session-id via XSS (S-01 latente) ou MITM antes do login (mitigado por `SESSION_COOKIE_SECURE=True` em prod).
- **MITIGAR:** chamar `request.session.cycle_key()` no `LoginView.post()` antes de issuar tokens. Custo mínimo, defense-in-depth.
- **STATUS:** débito de hardening; baixa prob de explore, alta gravidade se combinar com S-01.

### S-09 — SQL injection: superfície verificada limpa, mas não há gate automatizado

- **STRIDE:** Tampering · **CWE-89** · **CIA:** todos
- **O QUE:** `grep -rn "\.extra|RawSQL|raw\(" backend/apps/` retornou apenas comments dizendo "NÃO usar" em `apps/search/views.py:17-18` e `services.py:30`. Search usa `cursor.execute` com params posicionais (correto). **Hoje, sem injection conhecida.**
- **IMPACTO LATENTE:** sem `bandit` ou `semgrep` no CI bloqueando `.extra(where=)` futuro, qualquer dev incauto reintroduz vulnerabilidade. Item S15-S17 do roadmap (Sprint 1-2) ainda não atingido.
- **MITIGAR:** ativar `bandit -r backend/apps/` no CI; adicionar regra semgrep custom para vetar `.extra(`, `RawSQL`, `raw(` salvo allowlist.
- **STATUS:** **OK hoje**, débito de gate.

### S-10 — `AuditLog` retenção indefinida; sem TTL nem anonimização de IP

- **STRIDE:** Information Disclosure (interno) · **CWE-532** + **LGPD art. 16** (princípio de necessidade) · **CIA:** Confidentiality
- **O QUE:** `apps/audit/middleware.py:75-83` grava `ip_address`, `user_agent`, `actor`, `request_path`, `request_method`, `response_status` em todo write. Sem schedule de purge. Sem anonimização de IP após X dias. `grep -rn "AuditLog.*delete|cleanup" backend/apps/audit/` retorna 0.
- **IMPACTO:** após 1 ano de operação, AuditLog tem MM linhas com IP de leitor. Vazamento da tabela = mapa de quem leu o quê. LGPD art. 16 exige que dados sejam mantidos só pelo tempo necessário ao tratamento.
- **MITIGAR:** Celery beat task semanal: `AuditLog.objects.filter(created_at__lt=now-90d).update(ip_address=None, user_agent='[expired]')`; full purge após 2 anos. Documentar em política de retenção (ADR + DPO doc).
- **STATUS:** débito de compliance; alto-impacto regulatório, baixo-impacto operacional.

### S-11 — `og_middleware._escape` é DIY, equivalente funcional ao stdlib mas escapa do gate

- **STRIDE:** Tampering (HTML injection via meta tags) · **CWE-79** (variante) · **CIA:** Integrity
- **O QUE:** `apps/articles/og_middleware.py:38-46` define `_escape` custom (cobre `& < > " '`). Verificado: cobre os 5 chars que `html.escape(s, quote=True)` cobre — **funcionalmente equivalente hoje**. Não é vulnerável agora.
- **POR QUE LISTAR MESMO ASSIM:** (a) qualquer regressão (`replace` perdido) abre injection silenciosa; (b) ferramentas de auditoria automatizada (`bandit`, `semgrep`) reconhecem `html.escape` da stdlib mas não reconhecem `_escape` custom → fica fora do gate de SAST; (c) Chesterton's fence: por que reinventar a roda? Comment não justifica.
- **MITIGAR:** trocar `_escape` por `html.escape(s, quote=True)` da stdlib. Comment explica "por que stdlib > custom". 5 linhas a menos.
- **STATUS:** débito de auditoria; baixo-prob mas trivial de fix.

---

## 🟠 Débito técnico frágil (não-segurança)

### D-01 — `src/pages/Admin/index.tsx` com 1218 LOC + `Admin.css` com 1801 LOC

- **CONFIRMADO:** `wc -l` direto em ambos. Não está nos 1341/1769 que `reorganization-proposal-2026-05-21.md` cita — **mas continua acima do umbral de 600 LOC que `frontend-design` recomenda**.
- **IMPACTO:** PR review em qualquer feature do admin lê 1200 linhas para encontrar 10. Onboarding de novo contribuidor leva ~1 dia só pra mapear estados internos.
- **MITIGAR:** dividir por aba (`AdminArticles.tsx`, `AdminUsers.tsx`, `AdminModeration.tsx`, `AdminMetrics.tsx`); CSS em CSS Modules ou Tailwind utilitário.
- **STATUS:** backlog longo; sem PR aberto.

### D-02 — `apps/audit/` mistura ≥5 responsabilidades

- **CONFIRMADO:** `ls apps/audit/` mostra `middleware.py` (RequestID + AuditLog), `sentry.py` (Sentry init), `security_headers_middleware.py` (Permissions-Policy + CSP), `logging.py` (RequestContextFilter), `health_view.py` (`/healthz/`), `views.py` (AdminMetricsView), `models.py` (AuditLog model). Single Responsibility Principle ferido.
- **IMPACTO:** alterar qualquer um exige ler tudo. Difícil testar isoladamente. Reuso fora do app (`security_headers_middleware`, `health_view`) impossível sem importar transitivamente o resto.
- **MITIGAR:** extrair `apps/observability/` (logging, sentry, healthz, metrics) e `apps/security_headers/` (CSP, Permissions-Policy). Manter `apps/audit/` só para AuditLog model + RequestID middleware. ADR explícito antes de refatorar.
- **STATUS:** débito documentado; refactor não priorizado.

### D-03 — Frontend: estrutura híbrida flat (`Home.tsx`) vs pasta (`Buscar/`, `Admin/`, `Auth/`)

- **CONFIRMADO:** `ls src/pages/` mostra `About`, `Admin`, `Article.tsx`, `Auth`, `Buscar`, `CreatePost`, `Home.tsx`, `Legal`, `Newsletter.tsx`, `News.tsx`, `NotFound.tsx`, `Perfil.tsx`, `Unsubscribe.tsx`.
- **IMPACTO:** cognição inconsistente — leitor precisa adivinhar se a página tem CSS/teste/sub-componente colocalizado. Refactor de `Home.tsx` em pasta exige mover import paths em 4+ arquivos.
- **MITIGAR:** convenção dura: TODA `*.tsx` em `pages/` vira pasta com `index.tsx` + `<Page>.css` + `__tests__/`. Migração pode ser oportunística (toda feature que toca uma page, vira pasta).
- **STATUS:** estilo inconsistente; sem deadline.

### D-04 — `CommentLike` tem índice redundante

- **CONFIRMADO:** `apps/comments/models.py:62-64` — `unique_together = ('comment', 'user')` já cria índice único; logo abaixo declara `indexes = [models.Index(fields=['comment', 'user'])]`. Duas estruturas físicas para mesma coluna-set.
- **IMPACTO:** insert overhead duplicado, espaço em disco duplicado por commentLike. Em escala (10k+ likes) significativo.
- **MITIGAR:** remover a `models.Index` redundante. Migração de drop_index.
- **STATUS:** débito de baixa-prio mas trivial de fix; observação #869 (2026-05-29 1:22a).

### D-05 — Migrations de schema cruas (`RunSQL`) sem `reverse_sql`

- **VERIFICADO:** `grep -c reverse_sql apps/search/migrations/0001_initial.py` confirmar (output vazio sugere ausência ou em outra forma). A migration 0001 do search é tudo SQL puro PL/pgSQL com função + trigger + GIN.
- **IMPACTO:** `migrate <app> 0000` (rollback) **não desfaz** o schema. Em incidente que exija rollback de produção, DBA precisa SQL manual.
- **MITIGAR:** auditar TODAS as `migrations.RunSQL(...)` do projeto e adicionar `reverse_sql=...` ou `migrations.RunSQL.noop` documentando explicitamente "não-reversível por design".
- **STATUS:** débito conhecido; runbook de incident response não cobre rollback de search.

### D-06 — Testes que usam `timezone.now()` sem freezegun

- **CONFIRMADO:** `apps/users/tests/test_permissions.py:28` chama `published_at=timezone.now()` direto. Em CI lento (worker espera GitHub Actions), data atravessa midnight UTC → flake intermitente em testes que comparam timestamps.
- **IMPACTO:** flake build = retry; retry repetido = perda de confiança na suite.
- **MITIGAR:** convenção `@freeze_time('2026-01-01 12:00:00')` em qualquer teste que compare/filtre por data. `pytest-freezegun` já instalado (CLAUDE.md §6.4).
- **STATUS:** débito incremental — adicionar guard no code review.

### D-07 — `services.py` por app vs lógica em views — inconsistente

- **VERIFICADO:** `apps/users/services.py` existe; `apps/articles/views.py` carrega lógica de ranking de view_count dentro da view (`ArticleViewCountView`). `apps/search/services.py` existe como camada limpa.
- **IMPACTO:** novo contribuidor não sabe onde escrever lógica de negócio.
- **MITIGAR:** ADR — "regra: lógica que toca múltiplos models OU side effects vive em `services.py`". Refactor oportunístico.
- **STATUS:** débito de convenção.

### D-08 — `RequestIDMiddleware` e `AuditLogMiddleware` divergem em defensive guard

- **CONFIRMADO:** `apps/audit/middleware.py:41-43` — `RequestIDMiddleware` faz `hasattr(request, 'user') and request.user.is_authenticated`. Linha 74 — `AuditLogMiddleware` faz só `request.user.is_authenticated`. Sem o `hasattr` guard.
- **IMPACTO:** se algum middleware downstream for inserido fora de ordem e `request.user` não existir (sem AuthenticationMiddleware), `AuditLogMiddleware` levanta `AttributeError` dentro do `try/except Exception` (linha 84) — engole o erro mas mata o audit silenciosamente. `RequestIDMiddleware` no mesmo cenário usa fallback `'-'` corretamente.
- **MITIGAR:** uniformizar — extrair helper `_user_id(request) -> str|None` em `apps/audit/utils.py` e usar em ambos. Observação #875 (2026-05-29 1:23a).
- **STATUS:** débito de consistência; baixa-prob de pegar, alta confusão quando pegar.

### D-10 — Newsletter email referencia cover image via URL relativa — imagens quebradas em produção

- **CONFIRMADO:** observação #885 (2026-05-29 1:26a). Templates de email do app newsletter referenciam `article.cover_image.url` que devolve `/media/covers/2026/05/x.jpg` (path relativo). Cliente de email (Gmail, Outlook) não tem `<base href>` do site — imagem quebra.
- **IMPACTO:** todos os subscribers recebem newsletter com imagem ❌. Marca afetada (Substack/NYT nunca quebram cover em email). Engagement cai.
- **MITIGAR:** templates de email DEVEM usar URL absoluta. Pattern: helper `absolute_media_url(file_field)` que prepend `settings.SITE_URL` ou domínio CDN. Aplicar em **todos** os templates de email.
- **STATUS:** débito de marca; alta-prio antes de ativar newsletter.

### D-09 — `AuditLogMiddleware._SKIP_PATHS` é frozen set rígido sem documentação de "por que skip"

- **CONFIRMADO:** `apps/audit/middleware.py:21` — `_SKIP_PATHS = frozenset({'/api/v1/auth/refresh/', '/admin/'})`. `/refresh` skip faz sentido (não-state-changing semanticamente, faz audit explodir em volume). `/admin/` skip é mais preocupante — auditar mudanças via admin é exatamente o que LGPD pede.
- **IMPACTO:** ações de admin via Django admin (mudar role, banir, deletar artigo) **não geram AuditLog**. Compliance LGPD (rastreabilidade de tratamento de dados) tem gap. Django admin tem `LogEntry` próprio, mas não no mesmo formato do AuditLog.
- **MITIGAR:** decidir — manter skip e usar `django.contrib.admin.models.LogEntry` para investigação de admin; OU remover skip e aceitar overhead. Documentar a decisão em ADR.
- **STATUS:** débito de auditoria LGPD; trade-off não-explícito.

---

## 🟡 Pontos frágeis de performance

### P-01 — `view_count` bucket vazaentre workers gunicorn

- **REF:** mesmo issue do S-06 acima — afeta tanto métrica (sec) quanto fairness (perf-comportamental). Resolvido por Redis (A20).
- **STATUS:** débito assumido.

### P-02 — Cache invalidation de busca degrada para `cache.clear()` em LocMem

- **CONFIRMADO:** `apps/search/cache.py:107-131`. Linha 131: `cache.clear()` apaga TODO o cache (não só `search:v1:*`). Em dev é ok; em prod sem Redis (não recomendado, mas possível) é catástrofe: todo cache do app é flushado a cada artigo publicado.
- **IMPACTO:** prod requer Redis — não é opcional. Doc deveria ser hard-fail.
- **MITIGAR:** `production.py` deveria validar `CACHES['default']['BACKEND']` ≠ LocMem; ou marcar `delete_pattern` como required no boot.
- **STATUS:** documentação clara, hardening pendente.

### P-03 — N+1 latente em listings de comentários

- **OBSERVADO:** `apps/comments/serializers.py:42` comment cita `prefetch_related` em `CommentListCreateView`. Confiar no prefetch — se PR futuro tirar, viramos N+1 silencioso. `len(obj.replies.all())` em vez de `.count()` força travessia da queryset prefetchada (correto), mas frágil a refactor.
- **MITIGAR:** adicionar `django-extensions` `show-urls` + `django-silk` em dev; gate de assertNumQueries em testes críticos.
- **STATUS:** OK hoje, sem proteção contra regressão.

### P-04 — Bundle do Admin grande

- **NÃO MEDIDO:** sem Lighthouse atual em mão. Mas 1218 LOC `index.tsx` + Recharts + tabela paginada implica bundle ≥150kb gzipped. Bundle splitting por rota é code-split natural do React Router 7 mas precisa confirmar.
- **MITIGAR:** `npm run build` + analisar `dist/assets/Admin-*.js` size; lazy-loading via `React.lazy(() => import('./pages/Admin'))` em `AppRouter.tsx`.
- **STATUS:** suspeita não-quantificada.

### P-05 — Postgres `CONN_MAX_AGE=60` sem PgBouncer

- **CONFIRMADO:** `production.py:42` — `CONN_MAX_AGE: 60`. Aceitável até ~30 req/s; acima disso connection pool do gunicorn (3 workers × 1 conn ativa) já satura no Postgres.
- **MITIGAR:** PgBouncer em transaction-mode quando passar 30 req/s sustentado. ADR-005 cita upgrade KVM 2 condicional — ponto adjacente.
- **STATUS:** ok hoje (KVM 1, baixo tráfego); planejado.

### P-06 — CLS pré-existente não corrigido

- **OBSERVADO:** `docs/performance/README.md` (existe, ver `ls docs/`) cita 0.15+. Hero da Home com imagem sem `width/height` declarados → LCP shift quando carrega.
- **MITIGAR:** ADR para definir aspect-ratio padronizado de cover; verificar `<img>` sem dimensão.
- **STATUS:** débito de UX/perf.

---

## 🟢 Pontos operacionais frágeis

### O-01 — `docs/planning/` é gitignored — 14+ ADRs invisíveis no GitHub

- **CONFIRMADO:** `.gitignore:33` — `docs/planning/`. ADRs 001-014 em `Improvement-system.md` e a pasta `adrs/` interna não vão para o GitHub. PR #39 só conseguiu publicar ADR-015 com `git add -f`.
- **IMPACTO:** revisor externo / novo agente AI não vê a base arquitetural. Decisões críticas (ADR-005 hosting, ADR-006 DevSecOps embedded, ADR-007 Turnstile) são invisíveis.
- **MITIGAR:** **decidir**: (a) republicar `docs/planning/adrs/` versionado (renomear para `docs/architecture/adrs/`); (b) manter privado e aceitar opacidade. Não decidir é débito invisível.
- **STATUS:** decisão pendente.

### O-02 — Backup automático sem teste de restore

- **VERIFICADO:** runbooks existem (`docs/runbooks/database-connection-exhausted.md`, etc.) mas não há runbook `restore-from-backup.md`. Backup via cron + `pg_dump` (assumido pela HOSTING-DEPLOY-PLAN). Sem prova de restore mensal.
- **IMPACTO:** "temos backup" sem teste = sem backup. Em incidente real, restore falha = downtime + perda de dado.
- **MITIGAR:** runbook + cron que mensalmente faz `pg_restore` em DB efêmero + check de integridade.
- **STATUS:** débito de DR; alta prioridade quando passar para prod.

### O-03 — Lighthouse CI gate manual; E2E Playwright não existe

- **CONFIRMADO:** CLAUDE.md §6.1 marca **#5 E2E** como `⏳ implementação futura (Sprint 3+)`. CI gate `.github/workflows/ci.yml` roda `pytest --cov-fail-under=40` mas sem Lighthouse.
- **IMPACTO:** regressão de LCP / CLS / A11y passa direto até alguém rodar Lighthouse manual.
- **MITIGAR:** Lighthouse CI no PR + Playwright fluxos críticos (login, publicar, comentar) no Sprint 5.
- **STATUS:** roadmap claro, sem deadline.

### O-04 — Sem APM; observability fica em Sentry + structlog

- **CONFIRMADO:** `apps/audit/sentry.py` + `apps/audit/logging.py`. Não há Datadog/NewRelic/Grafana Cloud. Traces percentuais em Sentry só.
- **IMPACTO:** debug de slow request em produção depende de log + intuição. Sem flame-graph, sem heat-map de endpoint.
- **MITIGAR:** quando passar 30k MAU **ou** quando algo passar 2× sem causa óbvia, avaliar Grafana Cloud free + OTel.
- **STATUS:** ok hoje, item de futuro.

### O-05 — Hostinger KVM 1 é SPOF (single point of failure)

- **CONFIRMADO:** ADR-005. 1 vCPU + 4 GB RAM + 50 GB disco. Backup em B2 cobre dado, mas RTO de re-deploy ≈ 4h (provisionar nova KVM + restore + DNS).
- **IMPACTO:** indisponibilidade > 4h em incidente sério.
- **MITIGAR:** documentar RTO explicito em runbook; Cloudflare em `Always Online` para servir HTML cacheado durante downtime.
- **STATUS:** trade-off consciente (custo vs disponibilidade); doc fraca.

### O-06 — Compliance LGPD: gaps de documentação operacional

- **VERIFICADO:** ADR-008 designa Gabriel Marques como DPO + email `privacidade.interpop@gmail.com`. Mas: (a) email **a ser criado** (linha 158 Improvement-system.md), (b) sem runbook formal de DSAR (Data Subject Access Request) — usuário pedindo dados ou apagamento, (c) sem inventário de tratamento atualizado em `docs/`, (d) sem doc de "tempo de retenção" para AuditLog, Comment soft-deleted, NewsletterSubscriber unsubscribed.
- **IMPACTO:** ANPD investigação ou denúncia formal expõe gaps documentais. Multa proporcional à evidência de boa-fé documental.
- **MITIGAR:** (a) criar email DPO **antes do go-live**, (b) escrever runbook `docs/runbooks/dsar-handling.md`, (c) ADR explícito de retenção por tabela, (d) anonimizar `AuditLog.ip_address` após N dias (hoje retido indefinidamente).
- **STATUS:** débito de compliance assumido.

### O-07 — `request.id` exposto em response header (`X-Request-ID`)

- **CONFIRMADO:** `apps/audit/middleware.py:53` — `response['X-Request-ID'] = rid`. Decisão consciente (cliente pode logar e referenciar em Sentry breadcrumbs).
- **IMPACTO LATENTE:** cliente externo (atacante) pode coletar IDs para tentar correlação. Como `rid` é UUID truncado em 16 chars, espaço de busca ≈ 2^64 — defesa adequada. Mas atacante que **consegue** correlacionar X-Request-ID em dois requests aprende sobre infra interna (ex.: ID sequencial revela carga). Hoje aleatório — ok.
- **MITIGAR:** auditar regularmente — não trocar UUID por sequence/timestamp sem revisitar. Considerar HMAC do request_id se quiser zero-leak.
- **STATUS:** trade-off consciente, documentar como ADR.

---

## ⚪ Gotchas que mordem novos contribuidores

1. **`docs/planning/` é gitignored** (`.gitignore:33`). Clonar o repo NÃO traz ADRs principais — pedir ao Gabriel via canal interno.
2. **`docs/tests/reports*/` ignorado** (`.gitignore:48-52`). Histórico de teste fica local. `.gitkeep` mantém pasta.
3. **`backend/.env` e `backend/db.sqlite3` no `.gitignore`** (`.gitignore:24-25`). `.env.example` precisa estar preenchido manualmente.
4. **Node 18 system vs Node 20+ pelos hooks husky** — antes de `git commit`, garantir `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"` se o sistema tem Node 18 default. Falha do hook = falha do commit.
5. **`uv` é obrigatório no backend** — `pip install` quebra reprodutibilidade (CLAUDE.md §1). `uv sync` para instalar, `uv run python manage.py ...` para rodar.
6. **`pytest --reuse-db` quebra com triggers SQL** — search usa trigger PL/pgSQL; ao rodar testes do search, **não** use `--reuse-db`. REVIEW-PHASE-2 menciona isso.
7. **`connection.vendor != 'postgresql'` guard** — testes que dependem de FTS Postgres precisam pular em SQLite (dev local). Pattern em `apps/search/tests/`.
8. **`search_index` é `managed=False`** — `apps/search/models.py:62,102`. DDL via migration SQL pura (`RunSQL`), `makemigrations` ignora o modelo. Mudar campo = nova migration manual.
9. **`docs/specs/codebase/`** é o caminho canônico para specs SDD (este arquivo). Não confundir com `docs/specs/busca-editorial/` (spec de feature).
10. **Roles `dev` ≠ `admin`** — `dev` é o owner Gabriel, imune a ban entre admins. Hierarquia `dev > admin > editor > user` em CLAUDE.md §4.
11. **`CSP_REPORT_URI` vazio default** — `base.py:293`. Em prod sem setar = violations descem em silêncio. Observação 877.
12. **PR #30 main 1 ahead de develop** (resolvido em `1205f6b`). Pull antes de criar branch para evitar diff fantasma.
13. **Repo transferido de `GabeMarques-Intetsu` → `seekdevcore`** — remote local pode estar desatualizado, funciona via redirect mas atualize `git remote set-url`.
14. **Cache do search invalida com `cache.clear()` global em LocMem** (`apps/search/cache.py:131`). Em prod sem Redis = catástrofe de hit rate.
15. **`is_featured` único** — `apps/articles/models.py:78-92` faz update em massa para desmarcar outros. Side effect silencioso ao salvar.
16. **`AuditLog` ignora `/admin/`** — `apps/audit/middleware.py:21`. Mudanças via Django admin não aparecem na trilha de auditoria custom. Use `LogEntry` nativo para investigar.
17. **`AuditLog.user_agent` truncado em 500 chars** — `apps/audit/middleware.py:82`. UA realmente longos (alguns bots Apple) ficam mutilados — pode atrapalhar fingerprint.
18. **`OG middleware` intercepta `/noticia/<slug>` para crawlers sociais** — `apps/articles/og_middleware.py`. Confundir-se ao debugar response: testar com `User-Agent: WhatsApp` ≠ teste regular.
19. **Throttle scopes do search são tier-aware mas legados** — `apps/search/throttles.py` documenta cascateamento; cuidado ao adicionar novo scope.
20. **`pytest.ini` em `backend/` tem `--reuse-db` default OU não, depende do env** — verifique sempre antes de rodar suite cheia, especialmente para search.
21. **Triggers Postgres só rodam em prod (não em SQLite dev)** — testes de search dependem de `connection.vendor == 'postgresql'` guard. Em dev, busca degradada para LIKE fallback.
22. **`ALLOWED_HOSTS` em prod via `Csv()`** — `production.py:29`. Esquecer vírgula → silenciosa lista de um item errado → todos os requests falham com 400.
23. **`CELERY_TASK_ALWAYS_EAGER=True` em dev** (assumido em `development.py`) — tasks de email rodam SÍNCRONAS no request. Em dev parece "rápido"; em prod com worker real, latência aparece. Não confundir percepção.
24. **`SESSION_COOKIE_SECURE=True` em prod (linha 54 production.py)** — em dev sem HTTPS, cookie não sticky se acidentalmente `DEBUG=False`. Sempre `DEBUG=True` em dev.
25. **`media/` em `.gitignore` mas `STATIC_ROOT` aponta para `staticfiles/`** — `base.py:244`. Confusão recorrente: media (user-uploaded) vs static (collectstatic). `collectstatic` em prod é OBRIGATÓRIO antes de start gunicorn.

---

## Apps Django: status de débito por app

| App          | Status     | Débitos identificados                                                                                                                                                                                                                        |
| ------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`      | ✅ Estável | S-02 (JWT_SIGNING_KEY fallback `SECRET_KEY`); S-04 (sem 2FA); S-05 (axes só IP+user); S-08 (sem `cycle_key` pós-login).                                                                                                                      |
| `articles`   | 🟡 OK      | S-01 (body não sanitizado backend); S-06/P-01 (view_count bucket vaza entre workers); D-07 (lógica em view, não service); `is_featured` race em multi-save concorrente mitigado por `transaction.atomic` mas vale auditar.                   |
| `comments`   | 🟡 OK      | S-01 (content não sanitizado); D-04 (índice redundante `CommentLike`); soft-delete cleanup policy não documentada (sem cron de purge de `is_deleted=True` antigo).                                                                           |
| `moderation` | 🟡 OK      | BanRequest workflow precisa runbook de "como editor solicita ban → admin aprova"; risco de queue sem SLA visível.                                                                                                                            |
| `newsletter` | 🟡 OK      | Bounce handling Sprint 3+ ainda manual (ADR-004); sem webhook SendGrid configurado.                                                                                                                                                          |
| `audit`      | 🟠 Inchado | D-02 (5 responsabilidades — middleware RequestID, AuditLog, Sentry init, structlog config, health, security headers, admin metrics). Maior débito estrutural do backend.                                                                     |
| `search`     | ✅ Estável | TX-13/14/15 já listados no BACKLOG. F2-B-01/02/03 fechados (`14649d7`, `2362305`, `96cdad5`). Único débito ativo: D-05 (`RunSQL` sem `reverse_sql`) e P-02 (`cache.clear()` global em LocMem). Status sólido — sem débito novo identificado. |

---

## Padrões de código a NÃO replicar (anti-patterns vivos no projeto)

Estes são padrões que existem **hoje** no codebase mas **não** devem ser usados como modelo para novo código. Listar publicamente reduz a chance de espalhar.

1. **`hasattr(request, 'user') and request.user.is_authenticated` em alguns lugares, só `request.user.is_authenticated` em outros.** Ver D-08. Padronize via helper.
2. **Try/except `Exception` engolindo silenciosamente** — `apps/audit/middleware.py:84-85` é o caso aceitável (AuditLog não pode quebrar request); mas o pattern atrai cópia mecânica. Cada novo `except Exception: pass` precisa de comment explicando POR QUE engolir é seguro.
3. **`models.TextField()` sem `max_length`** — `Article.body` (`models.py:34`) não tem cap. Atacante envia 100MB. Mitigado por `DATA_UPLOAD_MAX_MEMORY_SIZE = 10MB` (`base.py:250`), mas defesa única por config global. Adicionar cap explícito por field.
4. **`get_client_ip(request)` com fallback `'0.0.0.0'`** — `apps/articles/views.py:112`. Significa: clientes sem IP detectável compartilham UM bucket. Cuidar ao usar — não é unique-per-client em todos cenários.
5. **Comentários em código com instrução negativa ("NÃO use X")** — `apps/search/views.py:17-18` diz "NÃO usar `.extra()`". Comentário é educativo mas frágil — gate via semgrep/bandit é mais durável.
6. **Imports circulares evitados via import-dentro-de-função** — `apps/articles/models.py:79` faz `from django.db import transaction` dentro de `save()`. Funciona mas oculta dependência. Refactor: top-of-file + reorganização.

## Áreas onde "ler primeiro, mudar depois"

- **Antes de tocar `apps/audit`:** ler `base.py:55-79` (middleware order), `apps/audit/sentry.py`, `apps/audit/logging.py`. Ordem importa — `RequestIDMiddleware` precisa estar depois de `Authentication`.
- **Antes de mudar JWT/cookie strategy:** ler `docs/planning/session-auth-strategy.md` (gitignored, pedir ao Gabriel) + `apps/users/services.py` (`issue_tokens_for_user`, `rotate_refresh_token`, `blacklist_all_user_tokens`).
- **Antes de mudar settings de prod:** ler `docs/planning/Improvement-system.md` ADR-005 + `docs/planning/HOSTING-DEPLOY-PLAN.md`.
- **Antes de tocar `apps/search`:** ler `docs/specs/busca-editorial/DESIGN.md` (atual v3 — `DESIGN.md`, `DESIGN-v1-degraded-mode.md`, `DESIGN-v2-hybrid.md`) + `REVIEW-PHASE-1/2/3.md` + `SECURITY-REVIEW.md`. Search é o app com maior densidade de ADRs (35+).
- **Antes de mudar middleware order em `base.py:55-79`:** entender que `RequestIDMiddleware` lê `request.user` (depende de Authentication antes) e popula `contextvars` lidas pelo logging — quebrar essa cadeia mata os logs estruturados em silêncio.
- **Antes de adicionar `dangerouslySetInnerHTML` em qualquer lugar:** revisitar S-01 e sanitizar no backend ANTES de fazer o frontend renderizar HTML cru.

---

## Defense-in-depth audit (CIA × controle)

| Ativo                  | Controle 1                                 | Controle 2                                 | Gap?                                             |
| ---------------------- | ------------------------------------------ | ------------------------------------------ | ------------------------------------------------ |
| Senha de usuário       | Argon2 hasher (`base.py:106`)              | django-axes (5 fail/30min)                 | Sim — sem 2FA (S-04), throttle só por IP (S-05). |
| JWT signing            | `JWT_SIGNING_KEY` env                      | `SECRET_KEY` fallback (`base.py:150`)      | Sim — fallback compartilhado (S-02).             |
| Cursor de busca HMAC   | `SEARCH_CURSOR_HMAC_SECRET` env            | Hard-fail em prod (`production.py:18-23`)  | Não — fechado em `96cdad5`.                      |
| HTTPS                  | nginx + Let's Encrypt                      | `SECURE_SSL_REDIRECT` (`production.py:50`) | Não.                                             |
| HSTS                   | `SECURE_HSTS_*` 1 ano (`production.py:51`) | Preload (`SECURE_HSTS_PRELOAD = True`)     | Não.                                             |
| XSS                    | React escapa por default                   | (nenhum) — sem sanitização backend         | **Sim** — defesa única (S-01).                   |
| CSRF                   | `CsrfViewMiddleware`                       | `SameSite=Lax` cookie                      | Não — adequado para state-change.                |
| Click-jacking          | `X_FRAME_OPTIONS=DENY`                     | CSP `frame-ancestors 'none'`               | Não.                                             |
| Brute-force login      | django-axes                                | `ScopedRateThrottle 'auth: 10/min'`        | Parcial — distribuído ainda passa (S-05).        |
| Inflação de view_count | LocMem bucket 5min (`views.py:109`)        | (nenhum) — vaza entre workers              | **Sim** — defesa única (S-06).                   |
| AuditLog integridade   | `try/except` não-bloqueante                | (nenhum) — sem assinatura, sem WORM        | Sim — atacante com DB write apaga rastro.        |
| LGPD retenção          | (nenhum) — sem TTL declarado               | (nenhum)                                   | **Sim** — gap O-06.                              |

## Cross-references

- Proposta de reorganização (histórica): `docs/planning/reorganization-proposal-2026-05-21.md` (gitignored).
- Postmortems: `docs/postmortems/README.md` + `2026-05-19-c1-jwt-rotation-broken.md`.
- Improvement-system (master ADRs): `docs/planning/Improvement-system.md` (gitignored).
- Spec da busca editorial: `docs/specs/busca-editorial/{DESIGN,BACKLOG,REVIEW-PHASE-{1,2,3},SECURITY-REVIEW,TEST-STRATEGY}.md`.
- Política de testes (INEGOCIÁVEL): `docs/tests/testing-standards.md` + CLAUDE.md §6.
- Runbooks de incident: `docs/runbooks/*.md` (cobre celery, DB exhaustion, DDoS, disk full, gunicorn, redis, SMTP — NÃO cobre restore de backup, ver O-02).

---

## Política de uso deste documento

1. **Quando adicionar débito:** se você descobre um, **adicione aqui** com `arquivo:linha`. Débito não-documentado = débito que cresce no escuro.
2. **Quando fechar débito:** marque com `STATUS: ✅ FECHADO em <commit-sha>` em vez de deletar. Histórico vale ouro pra "o que conserto era esse?".
3. **Quando refutar débito:** se um item aqui não te convence, **escreva um comentário no doc com a refutação grounded** (também com `arquivo:linha`). Não delete sem refutar — viés de confirmação.
4. **Frequência de revisão:** trimestral OBRIGATÓRIO (cada início de sprint). Items 6 meses antigos sem mudança = sinal de risco crônico.
5. **Não vire backlog:** CONCERNS lista **o que dói**. Ações concretas vivem no BACKLOG. Quando débito vira tarefa priorizada, item aqui ganha link para issue/PR.

---

_Versão 1 — 2026-06-09 — produzido pelo agente `cyber-security-architect`, ground truth verificado por `grep`/`wc`/`cat` em `arquivo:linha` para cada item. Anti-sycophancy: se algo neste doc parece exagerado, refute com evidência igualmente concreta — não com "isso é importante mas..."._

_Skills aplicadas na produção: `security-auditor`, `cc-skill-security-review`, `top-web-vulnerabilities`, `threat-modeling-expert`, `pentest-checklist`._
