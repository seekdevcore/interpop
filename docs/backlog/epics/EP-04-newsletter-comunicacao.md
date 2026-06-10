# EP-04 — Newsletter e comunicação

> **Tipo**: Epic
> **Status**: 🟡 Em produção (F-40 ✅ Done · F-41/F-42/F-43 ⏳ Sprint 8+)
> **Prioridade global**: 🟠 Alta
> **Owner**: Gabriel Marques
> **Criado em**: Sprint 2 (implementação) · **Documentação retroativa**: 2026-06-09

---

## Visão de produto

Newsletter editorial é o **único canal owned** do Interpop — única forma de alcançar leitor sem depender de SEO, algoritmo de rede social ou retorno espontâneo. Cobre 4 momentos:

1. **Captura de opt-in público** (footer + modal): leitor digita email, pronto. Sem cadastro de conta, sem captcha, sem fricção.
2. **Confirmação imediata** via welcome email transacional contendo link de descadastro (LGPD compliance desde o 1º contato).
3. **Notificação por artigo publicado** com fan-out para 100% da lista ativa via Celery worker — nunca trava o publish.
4. **Cancelamento 1-clique** via token UUID estável (preservado entre cancel/re-subscribe).

A newsletter é a única feature que faz **fan-out de email baseado em estado de domínio** (`Article.status`). O resto do tráfego transacional (password reset, ban notify) é 1:1 por evento.

### KPIs alvo (quando F-41 instrumentação existir)

| Métrica           | Alvo            | Bloqueio atual                                               |
| ----------------- | --------------- | ------------------------------------------------------------ |
| Open rate         | ≥ 35%           | Sem pixel/UTM hoje (F-41 Sprint 8 + opt-in LGPD obrigatório) |
| Click-through     | ≥ 8%            | Sem UTM padronizado (F-41)                                   |
| Churn ≤ 30d       | ≤ 5%            | Sem `unsubscribed_at` carimbado (L-02)                       |
| Reputação SMTP    | ≥ 95% delivered | Sem bounce handling (GAP-1 + bloqueio INT-1 SendGrid)        |
| Crescimento lista | +15% MoM        | Métrica ativa (subscribed_at suficiente — funciona hoje)     |

---

## Requisitos realizados (rastreabilidade ↑)

| ID                                                             | Requisito                                                                                                   | Tipo            |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------- |
| [RF-004](../../requirements/RF/RF-004-newsletter.md)           | Sistema permite que leitor se cadastre, receba notificação por artigo, e se descadastre via link único      | Funcional       |
| [RNF-security](../../requirements/RNF/RNF-security.md)         | Throttle anon no subscribe; token UUID 122 bits; CSRF AllowAny justificado pelo design 1-clique             | Segurança       |
| [RNF-lgpd](../../requirements/RNF/RNF-lgpd.md)                 | Opt-in explícito; descadastro acessível em todo email; direito ao esquecimento via unsubscribe              | LGPD            |
| [RNF-availability](../../requirements/RNF/RNF-availability.md) | Celery worker absorve falha SMTP; subscribe response sempre 200 mesmo se welcome falhar; teto Gmail 500/dia | Disponibilidade |
| [RNF-a11y](../../requirements/RNF/RNF-a11y.md)                 | Templates HTML inline-CSS Outlook-safe; multipart com texto puro; alt em imagens                            | Acessibilidade  |

---

## Features sob este Epic (rastreabilidade ↓)

| ID       | Nome                                                         | Sprint | Status                                        | Arquivo                                          |
| -------- | ------------------------------------------------------------ | ------ | --------------------------------------------- | ------------------------------------------------ |
| **F-40** | **Newsletter editorial** (este PR — documentação retroativa) | 2-3    | ✅ Done (em produção desde Sprint 3)          | [F-40](../features/F-40-newsletter-editorial.md) |
| F-41     | Bounce handling + open rate tracking                         | 8      | ⏳ Pending — bloqueada por INT-1 (SendGrid)   | _(a criar quando Sprint 8 iniciar)_              |
| F-42     | Segmentação por editoria                                     | 8      | ⏳ Pending                                    | _(a criar quando Sprint 8 iniciar)_              |
| F-43     | A/B subject lines                                            | 8+     | ⏳ Pending — depende de F-41 (instrumentação) | _(a criar quando Sprint 8+ iniciar)_             |

### Hotfix candidatos pre-Sprint 8 (descobertos em DESIGN retroativo 2026-06-09)

> Estes 2 bugs invisíveis quebram funcionalidade silenciosamente. **Recomendado entrar antes de F-41/F-42/F-43.**

| ID       | O quê                                                                                                       | Severidade | Tracking   |
| -------- | ----------------------------------------------------------------------------------------------------------- | ---------- | ---------- |
| HOTFIX-1 | `cover_image.url` relativa em `article_notification.html:31` quebra imagens em **todos** os emails sentidos | 🔴         | F-40 BUG-1 |
| HOTFIX-2 | `send_welcome` `except Exception: return False` mata `autoretry_for` da Celery task                         | 🔴         | F-40 BUG-2 |

---

## ADRs relacionadas (decisões locked-in)

- **ADR-001** — Celery em vez de ThreadPoolExecutor para envio assíncrono
- **ADR-004** — SendGrid como provider transacional (⚠️ **declarada, não implementada** — produção usa Gmail SMTP; INT-1)
- **ADR-009** — Gate Celery + retry policy padrão (`autoretry_for=(Exception,)` + backoff)
- **ADR-010** — Prefixo `/api/v1/` em todos endpoints

---

## Sprints envolvidas

| Sprint    | Escopo                                                                                                | Status       |
| --------- | ----------------------------------------------------------------------------------------------------- | ------------ |
| Sprint 2  | Modelo `NewsletterSubscriber` + endpoints subscribe/unsubscribe + welcome email                       | ✅ entregue  |
| Sprint 3  | Signal cross-app em `articles.signals` + task `send_article_notification` + fix bug C2 (double-email) | ✅ entregue  |
| Sprint 8  | F-41 (bounce + open rate) + F-42 (segmentação) — depende de migração SendGrid + opt-in LGPD granular  | ⏳ planejado |
| Sprint 8+ | F-43 A/B subject lines — depende de F-41                                                              | ⏳ planejado |

---

## Histórico de mudanças

| Data       | Evento                                                                                                                        |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Sprint 2   | Inscrição + welcome + endpoints REST implementados (`models.py`, `views.py`, `serializers.py`, `tasks.py:send_welcome_email`) |
| Sprint 3   | Notificação por artigo publicado via signal cross-app reverso em `apps.articles.signals.py:42-64` (fix bug C2 histórico)      |
| 2026-05-29 | BUG-1 observado: `cover_image.url` relativa em `article_notification.html:31` quebra imagens em emails enviados               |
| 2026-06-09 | BUG-2 confirmado: `send_welcome` `except Exception` em `services.py:58` mata `autoretry_for` da Celery task                   |
| 2026-06-09 | DESIGN.md retroativo publicado em `docs/specs/newsletter/DESIGN.md` (9 seções + invariantes + débitos + runbook)              |
| 2026-06-09 | EP-04 + F-40 + RF-004 preenchidos retroativamente (chore/docs-reorg PR #39)                                                   |

---

## Cross-references

- [DESIGN técnico completo](../../specs/newsletter/DESIGN.md) — fonte de verdade arquitetural
- [RF-004 Newsletter editorial](../../requirements/RF/RF-004-newsletter.md) — requisito de negócio
- [F-40 Newsletter editorial](../features/F-40-newsletter-editorial.md) — única Feature entregue até aqui
- [INTEGRATIONS.md §SendGrid](../../specs/codebase/INTEGRATIONS.md) — config real vs declarada (INT-1)
- [CONCERNS.md](../../specs/codebase/CONCERNS.md) — débitos INT-1, L-01/L-02, GAP-1/3/4/5
- [Improvement-system.md](../../planning/Improvement-system.md) — backlog mestre pré-reorg

---

_Última atualização: 2026-06-09. Próxima ação: agendar 2 hotfixes (BUG-1/BUG-2) antes de abrir Sprint 8 com F-41._
