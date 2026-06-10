# RF-004 — Newsletter editorial

> **Tipo**: Requisito Funcional
> **Prioridade**: 🟠 Alta
> **Status**: ✅ Realizado em código (Sprint 2-3) · 📝 documentação retroativa concluída em 2026-06-09

---

## Enunciado de negócio (pt-BR)

> **Sistema permite que leitor (autenticado ou anônimo via email) se cadastre para receber newsletter editorial via email, receba notificação para cada novo artigo publicado, e se descadastre via link único em qualquer email recebido.**

A newsletter é a **única feature do Interpop que faz fan-out de email baseado em estado de domínio** (`Article.status`). É também o único canal de retenção fora da home — leitor que opt-in vira leitor recorrente sem depender de SEO ou redes sociais.

### Subseção §subscribe

> Leitor digita apenas o email em formulário público (footer, modal). Sistema valida formato + normaliza (lower+strip), grava em `newsletter_subscribers` com `is_active=True` e dispara welcome email assíncrono. Cadastro NÃO exige conta no site — leitor anônimo é cidadão de primeira classe na newsletter.

### Subseção §welcome

> Após inscrição bem-sucedida, sistema envia 1 email de boas-vindas confirmando a inscrição e contendo o link único de descadastro (token UUID). Envio é assíncrono via Celery (`send_welcome_email`) — falha SMTP não trava o subscribe nem aparece pra leitor.

### Subseção §per-article-notification

> Quando editor/admin publica um artigo (`Article.status` muda para `published`), sistema notifica **todos os subscribers ativos** com email contendo título + excerpt + cover + link canônico do artigo. Notificação dispara apenas na **transição** draft→published (editar artigo já publicado **não** refaz fan-out — bug histórico documentado).

### Subseção §unsubscribe-1-click

> Todo email contém link único `${SITE_URL}/newsletter/cancelar/<token>` com UUID de 122 bits entrópicos. Clicar carrega página FE que faz POST `/api/v1/newsletter/unsubscribe/` com o token no body. Sistema marca `is_active=False`, preserva o `unsubscribe_token` (re-subscribe futuro reaproveita), retorna confirmação amigável. Double-unsubscribe (clicar 2x) retorna 400 com mensagem legível, nunca 500.

---

## Justificativa (por que este requisito existe)

Interpop é leitura longa. Tráfego depende de:

1. Leitores diretos que voltam à home → frágil, depende de hábito
2. SEO → médio prazo, depende de autoridade de domínio
3. Redes sociais → alta variância, depende de algoritmo de terceiros
4. **Newsletter** → único canal **owned**, 1ª-party, sem intermediário

Sem newsletter, cada publicação só atinge quem já estava lendo naquele dia. Com newsletter, cada publicação atinge **toda a lista ativa** num push deliberado.

**Implicação de produto**: newsletter é base de retenção e de medição editorial. Quando segmentação por editoria existir (GAP futuro, Sprint 8), também vira base de monetização (sponsor por editoria).

---

## Realizado por (rastreabilidade ↓)

| Epic                                                                                  | Feature(s)                                                                       | Status                                                  |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [EP-04 Newsletter e comunicação](../../backlog/epics/EP-04-newsletter-comunicacao.md) | [F-40 Newsletter editorial](../../backlog/features/F-40-newsletter-editorial.md) | ✅ Done (Sprint 2-3, retroativo documentado 2026-06-09) |
| [EP-04 Newsletter e comunicação](../../backlog/epics/EP-04-newsletter-comunicacao.md) | F-41 Bounce handling + open rate                                                 | ⏳ Sprint 8                                             |
| [EP-04 Newsletter e comunicação](../../backlog/epics/EP-04-newsletter-comunicacao.md) | F-42 Segmentação por editoria                                                    | ⏳ Sprint 8                                             |
| [EP-04 Newsletter e comunicação](../../backlog/epics/EP-04-newsletter-comunicacao.md) | F-43 A/B subject lines                                                           | ⏳ Sprint 8+                                            |

---

## Restrições e fora-de-escopo

| Item                                                                 | Status                                                                                                                                 |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Bounce handling automatizado**                                     | ❌ Não existe — hard-bounce reentra em toda publicação, degrada reputação SMTP. Backlog F-41 Sprint 8. Bloqueado por INT-1 (SendGrid). |
| **Open rate tracking via pixel**                                     | ❌ Não existe — sem pixel, sem UTM padronizado. Backlog F-41 Sprint 8 **com opt-in LGPD granular** obrigatório (L-01).                 |
| **Segmentação por editoria**                                         | ❌ Não existe — toda publicação cai para 100% da lista ativa. Backlog F-42 Sprint 8.                                                   |
| **A/B subject lines**                                                | ❌ Não existe — sem instrumentação de campanha. Backlog F-43 Sprint 8+.                                                                |
| **Frequency control** (digest semanal, opt-in diário/semanal/mensal) | ❌ Não existe — único modo é "1 email por artigo publicado". Backlog longo prazo.                                                      |
| **`unsubscribed_at` timestamp**                                      | ❌ Não existe — cancelamento muda só `is_active`. Métricas churn impossíveis. Débito L-02.                                             |
| **Proof de consentimento granular** (LGPD)                           | ❌ Apenas `subscribed_at` registrado — sem IP, sem `consent_version`, sem texto exato. Débito L-01.                                    |
| **`List-Unsubscribe-Post` RFC 8058**                                 | ❌ Header ausente — Gmail/Outlook não mostram botão nativo de cancelar. Débito GAP-3.                                                  |
| **Idioma**                                                           | Só português brasileiro. Templates `welcome.{html,txt}` e `article_notification.{html,txt}` em pt-BR exclusivamente.                   |
| **Personalização**                                                   | Conteúdo do email é fixo — não considera histórico do leitor. Fora de escopo.                                                          |
| **Salvar buscas / alertas custom**                                   | Fora de escopo (relação com F-31/F-32 da busca editorial é zero).                                                                      |

---

## RNFs aplicáveis

- [RNF-security](../RNF/RNF-security.md) — throttle de subscribe; token UUID não-enumerável; CSRF AllowAny justificado
- [RNF-lgpd](../RNF/RNF-lgpd.md) — opt-in explícito; direito ao esquecimento via unsubscribe; débitos L-01/L-02 priorizados
- [RNF-availability](../RNF/RNF-availability.md) — fan-out via Celery worker; SMTP falha não trava endpoint; Gmail SMTP teto 500/dia
- [RNF-a11y](../RNF/RNF-a11y.md) — templates HTML inline-CSS com alt em imagens; texto puro em multipart fallback

---

## Decisões técnicas relacionadas (ADRs)

- **ADR-001** — Celery em vez de ThreadPoolExecutor (justifica `send_welcome_email` + `send_article_notification` assíncronos)
- **ADR-004** — SendGrid declarado como provider transacional ⚠️ **NÃO implementado** — produção usa Gmail SMTP (`smtp.gmail.com`, app password). Migração SendGrid é troca de 3 env vars sem código (INTEGRATIONS.md §SendGrid).
- **ADR-009** — Gate Celery + retry policy: `autoretry_for=(Exception,)` + backoff exponencial até 300s
- **ADR-010** — Prefixo `/api/v1/` em todos os endpoints

---

## Bugs invisíveis conhecidos (hotfix candidatos)

> **Estes 2 bugs quebram funcionalidade silenciosamente — NÃO aparecem no test suite atual e merecem hotfix antes de qualquer feature de Sprint 8.**

| Bug   | O quê                                                    | Onde                                                       | Impacto                                                                                                                                           | Fix                                                                                                          |
| ----- | -------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| BUG-1 | `article.cover_image.url` é **URL relativa** no template | `templates/newsletter/emails/article_notification.html:31` | Clientes de email NÃO resolvem contra `SITE_URL` — **todos os subscribers** recebem placeholder broken-image em toda notificação                  | Passar `absolute_url` no contexto da task OU settear `MEDIA_URL` absoluta em `production.py`                 |
| BUG-2 | `send_welcome` faz `except Exception: return False`      | `apps/newsletter/services.py:58`                           | **Mata** o `autoretry_for=(Exception,)` da Celery task (`tasks.py:53`). Falhas SMTP nunca dão retry; subscriber não recebe welcome e ninguém sabe | Remover try/except — deixar service propagar; UI já lida com 200 mesmo se SMTP falhar (welcome é assíncrono) |

---

## Histórico

| Data       | Evento                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Sprint 2   | Inscrição + welcome + endpoints REST implementados                                                                              |
| Sprint 3   | Notificação por artigo publicado + signal cross-app reverso em `apps.articles.signals` (fix do bug C2 — double-email histórico) |
| 2026-05-29 | Observação BUG-1 (cover URL relativa em emails) documentada                                                                     |
| 2026-06-09 | Observação BUG-2 (`send_welcome` swallow mata retry da task) confirmada via análise comparativa task↔service                    |
| 2026-06-09 | RF-004 preenchido retroativamente (chore/docs-reorg PR #39)                                                                     |

---

## Cross-references

- [DESIGN técnico completo do módulo](../../specs/newsletter/DESIGN.md) — 9 seções incluindo invariantes, débitos, runbook
- [Personas e cenários](../personas-e-cenarios.md) — leitor anônimo + autenticado
- [EP-04 (backlog)](../../backlog/epics/EP-04-newsletter-comunicacao.md)
- [F-40 Newsletter editorial (feature)](../../backlog/features/F-40-newsletter-editorial.md)
- [INTEGRATIONS.md §SendGrid](../../specs/codebase/INTEGRATIONS.md) — config real vs declarada
- [CONCERNS.md](../../specs/codebase/CONCERNS.md) — débitos INT-1, L-01, L-02, GAP-1/3/4/5
