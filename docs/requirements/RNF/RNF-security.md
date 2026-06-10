# RNF-security — Segurança

> **Tipo**: Requisito Não-Funcional (transversal)
> **Prioridade**: 🔴 Imediato (release gate hard)
> **Status**: ✅ Baseline atendido + 🚧 hardening contínuo

---

## Enunciado

Sistema protege dados de leitor (autenticado e anônimo), integridade do conteúdo editorial e disponibilidade do serviço contra atacantes externos (OWASP Top 10), abuso por usuário válido (rate limit, scraping), e erros de configuração (princípio do menor privilégio + defesa em profundidade).

### Princípios não-negociáveis

1. **DevSecOps embedded** — segurança em todo Sprint, não Sprint dedicado ([ADR-006](../../planning/adrs/ADR-006-devsecops-embedded.md))
2. **Defesa em camadas** — Cloudflare WAF → Nginx headers → Django middleware → DRF perms → ORM parametrizado → Postgres role
3. **Fail closed** — produção falha se config crítico estiver ausente (HMAC secret, ALLOWED_HOSTS, SECRET_KEY)
4. **Auditoria obrigatória** — todo evento sensível em `AuditLog` (login, ban, publish, password change)

### Camadas mínimas (estado atual)

| Camada                                                                      | Status                                                                                              |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **TLS** end-to-end (Let's Encrypt + Cloudflare)                             | ✅                                                                                                  |
| **HSTS** + preload (1 ano)                                                  | ✅                                                                                                  |
| **CSP** Report-Only baseline (flip enforced via env)                        | 🟡 baseline ativo                                                                                   |
| **JWT** em cookie httpOnly + SameSite=Lax + Secure                          | ✅                                                                                                  |
| **Rotação silenciosa** + blacklist após rotação                             | ✅                                                                                                  |
| **Brute-force** — django-axes (5 fails / 30min)                             | ✅                                                                                                  |
| **Throttle DRF** por endpoint, anon + user + global                         | ✅ (busca: 30/60/500/min)                                                                           |
| **Anti-bot** — Cloudflare Turnstile em endpoints sensíveis                  | ⏳ Sprint 5 ([ADR-007](../../planning/adrs/ADR-007-cloudflare-turnstile.md))                        |
| **SAST** — bandit (Python) + semgrep (multi-lang) em CI                     | ✅                                                                                                  |
| **Deps audit** — pip-audit + npm audit em CI                                | ✅ (zero vulnerabilities atual)                                                                     |
| **Secret scan** — gitleaks em CI + pre-commit                               | ✅                                                                                                  |
| **Cursor HMAC** — chave em env, hard-fail em prod se igual a SECRET_KEY     | ✅ ([ADR-035+](../../specs/busca-editorial/adrs/ADR-037-cache-key-sha256-auth-tier-vary-header.md)) |
| **XSS** — refs (não dangerouslySetInnerHTML), bleach sanitize body          | ✅                                                                                                  |
| **SQL injection** — DRF serializers + parametrized cursors (sem `.extra()`) | ✅                                                                                                  |
| **CSRF** — Django middleware + SameSite=Lax cookies                         | ✅                                                                                                  |

---

## Realizado por (rastreabilidade ↓)

| Epic / Feature                                                         | Como atende                                                                                     |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Plataforma base (todos Epics)                                          | TLS, HSTS, JWT cookie, django-axes, headers HTTP                                                |
| [EP-10 Busca → F-30](../../backlog/features/F-30-busca-texto-livre.md) | CA10 (XSS escape no highlight), CA13 (cursor inválido = 400), CA15 (cache isolation cross-tier) |
| Todos Epics futuros                                                    | DEVEM passar SAST + deps audit + secret scan + manual review                                    |

---

## OWASP Top 10 — status

| OWASP 2021                           | Status | Como mitigado                                                                                                         |
| ------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------- |
| A01 Broken Access Control            | ✅     | Roles dev/admin/editor/user + DRF permissions canônicas                                                               |
| A02 Cryptographic Failures           | ✅     | TLS 1.3, HSTS preload, JWT HS256 com SECRET_KEY rotacionável, HMAC cursor                                             |
| A03 Injection                        | ✅     | Parametrized queries (sem `.extra()`/`RawSQL()`), bleach em body                                                      |
| A04 Insecure Design                  | 🟡     | Threat model existe ([Improvement-system.md §5.5](../../planning/Improvement-system.md)); precisa revisão a cada Epic |
| A05 Security Misconfiguration        | ✅     | Settings split + decouple + hard-fail em prod                                                                         |
| A06 Vulnerable Components            | ✅     | dependabot + pip-audit + npm audit weekly                                                                             |
| A07 Identification & Auth Failures   | ✅     | django-axes + JWT rotação + blacklist + password reset com token expirável                                            |
| A08 Software/Data Integrity Failures | 🟡     | CI signed commits ativo; semgrep custom rules pendentes (ADR-038 Sprint 5)                                            |
| A09 Security Logging & Monitoring    | ✅     | structlog JSON + Sentry + AuditLog + /healthz/ + UptimeRobot                                                          |
| A10 SSRF                             | ✅     | Sem requests externos a partir de input do usuário (OG crawler ≠ user-controlled)                                     |

---

## Cross-references

- ADRs de security: [ADR-006 DevSecOps](../../planning/adrs/ADR-006-devsecops-embedded.md), [ADR-007 Turnstile](../../planning/adrs/ADR-007-cloudflare-turnstile.md), [ADR-008 DPO](../../planning/adrs/ADR-008-dpo-designado.md)
- ADRs de security da busca: [ADR-035 a ADR-039](../../specs/busca-editorial/adrs/INDEX.md)
- Review formal: [SECURITY-REVIEW.md busca](../../specs/busca-editorial/SECURITY-REVIEW.md)
- Threat model do projeto: [Improvement-system.md §5.5](../../planning/Improvement-system.md)
