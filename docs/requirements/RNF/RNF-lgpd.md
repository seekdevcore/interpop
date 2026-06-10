# RNF-lgpd — Conformidade LGPD

> **Tipo**: Requisito Não-Funcional (transversal regulatório)
> **Prioridade**: 🔴 Imediato (regulatório — risco legal)
> **Status**: ✅ Baseline + 🚧 pseudonimização forte Sprint 5

---

## Enunciado

Sistema trata dados pessoais de leitores conforme **LGPD Lei 13.709/2018** e diretrizes da ANPD, com:

- Base legal documentada para cada tratamento
- Minimização (não coletar o que não precisa)
- Retention explícita (deletar quando não precisar mais)
- Pseudonimização sempre que possível (hash + bucket + truncate)
- Direitos do titular implementados (acesso, correção, eliminação, portabilidade)
- DPO designado e contato público
- Trilha de auditoria

### Bases legais usadas

| Tratamento         | Base legal LGPD                  | Justificativa                                        |
| ------------------ | -------------------------------- | ---------------------------------------------------- |
| Cadastro de leitor | Art. 7º V (execução de contrato) | Sem cadastro não há comentário/curtida               |
| Newsletter         | Art. 7º I (consentimento)        | Opt-in explícito + unsubscribe 1-click               |
| AuditLog           | Art. 7º II (cumprimento legal)   | Provas de moderação + segurança                      |
| Search log         | Art. 7º IX (legítimo interesse)  | Analytics agregado + abuso/spam — **pseudonimizado** |
| Cookies essenciais | Art. 7º V (execução de contrato) | JWT cookie = sessão                                  |
| Cookies analíticos | Art. 7º I (consentimento)        | Banner LGPD (futuro Sprint)                          |

### Direitos do titular (implementação)

| Direito (Art. 18)                  | Como cumprimos                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Acesso                             | Endpoint `GET /api/v1/users/me/data/` (futuro Sprint)                                                              |
| Correção                           | Edit profile UI (existe)                                                                                           |
| Eliminação                         | DELETE account flow (futuro Sprint) com purga de comentários + perfil; auditoria mantida por base legal Art. 7º II |
| Portabilidade                      | Export JSON (futuro Sprint)                                                                                        |
| Informação sobre uso compartilhado | Não compartilhamos com terceiros exceto Sentry/SendGrid (DPA assinados)                                            |
| Revogação de consentimento         | Unsubscribe 1-click via token URL                                                                                  |

### Retention policy

| Dado                         | Retention              | Justificativa                                                                                                      |
| ---------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Comentários ativos           | Permanente             | Conteúdo editorial relacionado                                                                                     |
| Comentários soft-deleted     | 30 dias depois purga   | Permitir undo + auditoria                                                                                          |
| Search log                   | **7 dias**             | Detecção de abuso curto-prazo; query NUNCA persistida plain (hash 16 chars + IP /16 ou /24 truncado + bucket 5min) |
| AuditLog                     | 5 anos                 | Conformidade regulatória                                                                                           |
| Sessões JWT (refresh tokens) | 30 dias                | Janela de "lembrar-me"                                                                                             |
| Backups                      | 30 dias (rolling)      | Recovery operacional                                                                                               |
| Sentry events                | 90 dias (default tier) | Debug pós-incident                                                                                                 |

---

## Realizado por (rastreabilidade ↓)

| Epic / Feature                                                         | Como atende                                                                                                                                                       |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plataforma base                                                        | DPO designado ([ADR-008](../../planning/adrs/ADR-008-dpo-designado.md)) — Gabriel Marques · `privacidade.interpop@gmail.com`                                      |
| [EP-10 Busca → F-30](../../backlog/features/F-30-busca-texto-livre.md) | CA14 (search_log retention 7d, query plain nunca persistida)                                                                                                      |
| **Pseudonimização forte do search_log**                                | ⏳ Sprint 5 — [ADR-035](../../specs/busca-editorial/adrs/ADR-035-pseudonimizacao-forte-search-log.md) detalha HMAC-pepper rotativo + bucket 5min + IP /16 ou drop |

---

## Estado atual

- ✅ DPO designado e contato documentado
- ✅ search_log com hash 16 chars (vs query plain)
- 🟡 IP do search_log truncado para /24 (T30.4.X1 Sprint 5 endurece para /16 + HMAC pepper rotativo)
- ⏳ Cron retention 7d ainda manual; precisa Celery beat task Sprint 5
- ⏳ DELETE account flow não implementado (backlog longo)
- ⏳ Banner de consentimento cookies analíticos (sem Google Analytics ainda — N/A no momento)

---

## Cross-references

- ADR DPO: [ADR-008](../../planning/adrs/ADR-008-dpo-designado.md)
- ADR Turnstile (sem cookie, não dispara banner): [ADR-007](../../planning/adrs/ADR-007-cloudflare-turnstile.md)
- ADR pseudonimização busca: [ADR-035](../../specs/busca-editorial/adrs/ADR-035-pseudonimizacao-forte-search-log.md)
- Política de tratamento: a publicar em `/sobre/privacidade` (rota existe, conteúdo TODO)
