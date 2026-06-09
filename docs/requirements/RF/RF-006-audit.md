# RF-006 — Auditoria, observabilidade e telemetria operacional

> **Tipo**: Requisito Funcional
> **Prioridade**: 🟠 Alta (fundação de operação; bloqueio LGPD pré-go-live em §audit-log)
> **Status**: ✅ Realizado em código (Sprint 1, pré-busca) com débito estrutural documentado · 🔴 Hotfix LGPD obrigatório antes do go-live público (ver §audit-log → S-10)

---

## Enunciado de negócio (pt-BR, sem termo técnico)

> **Sistema mantém registro auditável de eventos sensíveis (login, ban, publicação, mudança de senha, decisão de moderação), com rastreabilidade end-to-end por identificador único de requisição, telemetria de erro em ferramenta externa com remoção de dados pessoais antes do envio, e endpoint público de verificação de saúde para monitor externo de disponibilidade.**

Este RF formaliza a quarteta operacional que sustenta investigação de incidente, resposta a vazamento, monitoramento ativo e auditoria de moderação. Sem ele, o sistema não tem como provar **quem fez o quê, quando, de onde** — pré-requisito para LGPD, política interna de moderação e SLA de disponibilidade.

---

### Subseção §audit-log

> Sistema grava, em tabela exclusivamente apendável, toda escrita HTTP autenticada (POST/PUT/PATCH/DELETE) com autor, ação executada, recurso afetado, status de resposta, endereço IP e identificador do navegador. Registros são imutáveis (sem UPDATE, sem DELETE pela aplicação) e consultáveis pelo administrador para investigação de incidente, fundamentação de decisão de moderação e cumprimento de pedido LGPD.

**Eventos cobertos pela escrita HTTP** (lista canônica, ampliada conforme novas rotas surjam):

- Login bem-sucedido, logout, tentativa de login falhada
- Banimento criado, pedido de banimento aberto/decidido (aprovado/rejeitado)
- Publicação de artigo
- Mudança de senha
- Comentário criado/editado/removido (via API)

**Restrição arquitetural conhecida** (DESIGN §8 — débito S-10): retenção **indefinida** e IP **cru**. É blocker LGPD Art. 16 (dado tratado por tempo necessário). Mitigação obrigatória **antes** do go-live público: cron semanal anonimiza IP após 90 dias, purge completo após 2 anos, ADR formal de retenção por tabela. Tracking: futura **F-62** (Sprint 5).

### Subseção §request-id

> Toda requisição HTTP recebe identificador único gerado pelo sistema (ou honra `X-Request-ID` enviado pelo cliente), propagado em todas as linhas de log do ciclo de vida do request e devolvido ao cliente no cabeçalho `X-Request-ID` da resposta. Suporte ao cliente referencia esse identificador no ticket para correlacionar logs em segundos, não em minutos.

### Subseção §sentry-error-tracking

> Sistema envia exceções não tratadas a serviço externo de telemetria (Sentry), com remoção automática de dados sensíveis (senha, token, e-mail, cookie, CPF, telefone, chave de API) antes do envio. Erros são correlacionáveis com versão exata do código deployado (commit SHA). Telemetria de healthcheck é descartada para não poluir o sinal.

### Subseção §security-headers

> Toda resposta HTTP carrega cabeçalhos defensivos contra ataques de browser: HSTS (forçar HTTPS), X-Frame-Options (proibir embed em iframe), X-Content-Type-Options (proibir sniffing de MIME), Referrer-Policy (limitar vazamento de URL para terceiros), Permissions-Policy (desabilitar câmera/microfone/geolocalização não solicitadas) e Content Security Policy (whitelist de origens permitidas para scripts/imagens).

**Restrição arquitetural conhecida** (DESIGN §8 — débito S-03): CSP roda em **Report-Only** indefinidamente (não bloqueia, só reporta). Combinado com `script-src 'unsafe-inline'` necessário pelo Django admin, é cerimônia sem proteção real contra stored-XSS. Flip para `Content-Security-Policy` enforced **carece de decisão arquitetural** (endpoint de report + 1 semana de baseline limpo + caminho realista para remover `'unsafe-inline'`).

### Subseção §health-check

> Sistema expõe endpoint público `GET /healthz/` (sem autenticação) que retorna 200 + payload JSON quando banco e cache respondem, 503 quando algum deles está degradado. Resposta inclui versão do código (commit SHA) deployado para confirmar qual deploy está vivo. Latência alvo ≤ 50ms p99 — endpoint é consumido por UptimeRobot a cada 1 minuto, nginx upstream check e smoke test do `deploy.sh` (que faz rollback automático se receber 503 após restart do gunicorn).

### Subseção §admin-metrics

> Administrador acessa, via dashboard interno autenticado, agregados operacionais do sistema: total de usuários ativos, assinantes de newsletter, artigos publicados, comentários visíveis, curtidas, com séries temporais por dia/semana/mês/ano, ranking de artigos por engajamento, e quebra por editoria. Dashboard recarrega quando admin desejar; resposta tolera 1-2s.

**Restrição arquitetural conhecida** (DESIGN §8 — débito D-AUD-02): endpoint hoje executa ~25 queries SQL **sem cache**, **sem rate-limit dedicado**, **sem `assertNumQueries` em teste**. Mitigação backlog (futura **F-60** já cobre Definition of Done atual; refactor formal candidato para Sprint 9+).

---

## Justificativa (por que este requisito existe)

Sem RF-006:

- **Não há resposta a incidente possível** — cliente reporta "alguém deletou meu comentário"; sem AuditLog, time não tem como provar/refutar.
- **LGPD vira ficção** — Art. 16 exige rastrear tratamento de dado pessoal; sem audit trail, DPO não tem o que mostrar à ANPD em fiscalização.
- **Moderação fica indefensável** — admin bane usuário; sem registro de quem aprovou + quando + por qual rota, decisão pode ser revogada juridicamente.
- **Downtime passa silenciosamente** — sem `/healthz/` consumido por monitor externo, gunicorn morre e ninguém percebe até próximo leitor reportar.
- **Investigação cross-módulo dispara hipóteses** — sem `request_id`, debugar erro em produção é ler 200 linhas de log esperando intuição.

Trade-off honesto: este requisito existe **antes** de Sprint 1 ter formalizado o backlog. Por isso é documentado **retroativamente** — o código já está em produção (`backend/apps/audit/`), os débitos estão **explicitamente listados** (não escondidos) e o caminho de saída está mapeado para Sprints futuras.

---

## Realizado por (rastreabilidade ↓)

| Epic                                                                                 | Feature(s)                                                                                   | Status                             |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ---------------------------------- |
| [EP-06 Administração do sistema](../../backlog/epics/EP-06-administracao-sistema.md) | [F-60 Observability + audit trail](../../backlog/features/F-60-observability-audit-trail.md) | ✅ Done — Sprint 1 (pré-busca)     |
| [EP-06 Administração do sistema](../../backlog/epics/EP-06-administracao-sistema.md) | F-61 Refactor `apps.audit` em 4 apps (observability + audit + admin_bff + security_headers)  | ⏳ Backlog Sprint 9+ (D-AUD-00)    |
| [EP-06 Administração do sistema](../../backlog/epics/EP-06-administracao-sistema.md) | F-62 AuditLog TTL + anonimização IP (LGPD blocker)                                           | 🔴 **Obrigatório Sprint 5** (S-10) |
| [EP-06 Administração do sistema](../../backlog/epics/EP-06-administracao-sistema.md) | F-63 Admin promote/demote role UI                                                            | ⏳ Backlog Sprint 9+               |

---

## Requisitos Não-Funcionais que limitam este RF

| RNF                                            | Limite imposto                                                                                                        |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [RNF-security](../RNF/RNF-security.md)         | Security headers obrigatórios; PII scrubbing em Sentry; AuditLog INSERT-only; CSP roadmap para `enforce`              |
| [RNF-availability](../RNF/RNF-availability.md) | `/healthz/` ≤ 50ms p99 sem auth; UptimeRobot detecta degradação em <1min; rollback automático em deploy.sh quando 503 |
| [RNF-lgpd](../RNF/RNF-lgpd.md)                 | AuditLog retenção ≤ 2 anos com anonimização de IP em 90d (hoje **indefinido** — hotfix obrigatório, S-10)             |
| [RNF-perf](../RNF/RNF-perf.md)                 | `AdminMetricsView` tolera 1-2s mas ~25 queries sem cache hoje é débito (D-AUD-02)                                     |

---

## Restrições e fora-de-escopo

- **Endpoint público de leitura de AuditLog**: fora de escopo. Investigação é feita pelo administrador via Django admin (`/admin/audit/auditlog/`) ou shell. Decisão consciente — AuditLog é insumo de incident response, não produto. Trade-off: se LGPD-DSAR exigir mostrar histórico ao próprio titular, esse gap reabre (decisão pendente em DESIGN §10 Q5).
- **Captura via signals Django**: rejeitada em favor de middleware HTTP-method-driven. Trade-off: mudanças via `manage.py shell`, management command ou fixture-load **não** aparecem em AuditLog (DESIGN §3.1).
- **Skip de `/admin/`**: AuditLogMiddleware ignora `/admin/` — mudanças via Django admin **não** aparecem em AuditLog custom; ficam em `django.contrib.admin.models.LogEntry` (formato divergente). Decisão pendente DESIGN §10 Q9 — gap LGPD-relevante.
- **2FA para staff**: separado deste RF. Backlog dedicado a definir (não cobrir aqui evita inflar escopo).
- **`target_repr` e `metadata` no AuditLog**: campos existem no schema mas **nunca** são populados na prática hoje (DESIGN §8 D-AUD-04). Decisão "implementar de fato vs. remover do schema" pendente — vinculada ao refactor de Sprint 9+.

---

## Decisões técnicas relacionadas (ADRs)

Detalhe completo em [`docs/specs/audit/DESIGN.md`](../../specs/audit/DESIGN.md). Destaques que afetam diretamente o enunciado deste RF (ADRs catalogadas em `docs/planning/Improvement-system.md`, gitignored — consultar com o owner):

- **A27** — Logging estruturado JSON com RequestContextFilter (formatter `json` em prod, `console` em dev)
- **A28** — Sentry init gating por `SENTRY_DSN` + scrub recursivo por chave antes do envio
- **A29** — `/healthz/` contract: sem auth, 2 checks (DB SELECT 1 + cache set/get), gate de deploy + UptimeRobot
- **A20** — Redis como cache compartilhado (libera débito D-AUD-06 sobre healthz de cache)
- **S-03 / S-09 §11.6** — Security headers (CSP + Permissions-Policy + HSTS) — flip de Report-Only para enforced é decisão pendente

---

## Histórico

| Data       | Evento                                                                                                                                  |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Sprint 1   | Implementação inicial dos 4 componentes (AuditLog + RequestID + Sentry + SecurityHeaders + healthz + AdminMetricsView) sem spec formal  |
| 2026-06-09 | DESIGN.md retroativo produzido (526 LOC) documentando 4 responsabilidades grudadas, débitos S-10/S-03/D-AUD-00..08, gaps GAP-AUD-01..04 |
| 2026-06-09 | RF-006 formalizado retroativamente; F-60 cataloga implementação atual; F-62 escalada como hotfix LGPD obrigatório pré-go-live           |
| Sprint 5   | **Previsto e obrigatório**: F-62 entrega TTL + anonimização IP no AuditLog (S-10)                                                       |
| Sprint 9+  | Refactor estrutural F-61 (split em 4 apps) com ADR prévio mandatório (D-AUD-00)                                                         |

---

## Cross-references

- [DESIGN do módulo](../../specs/audit/DESIGN.md) — 526 LOC documentando os 4 componentes, 9 invariantes, 8 débitos e 9 open questions
- [Personas e cenários](../personas-e-cenarios.md) — admin investigador, dev em incident response
- [F-60 Observability + audit trail](../../backlog/features/F-60-observability-audit-trail.md)
- [EP-06 Administração do sistema](../../backlog/epics/EP-06-administracao-sistema.md)
- [Architecture overview](../../architecture/overview.md)
- [CONCERNS §D-02 (top débito estrutural), §S-03 (CSP cerimônia), §S-10 (LGPD retenção)](../../specs/codebase/CONCERNS.md)

---

_RF-006 formalizado retroativamente em 2026-06-09. Substitui stub anterior. **Anti-sycophancy**: este RF documenta o estado real do código (incluindo débitos críticos), não defende o desenho atual. S-10 (LGPD AuditLog) é o **hotfix mais urgente do projeto** — bloqueia go-live público regulatoriamente. Skills aplicadas: `engenharia-de-requisitos`, `tlc-spec-driven`, `security-requirement-extraction`, `architecture-decision-records`._
