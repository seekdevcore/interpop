# Glossário de domínio — Interpop

> Vocabulário canônico do produto. Toda US, CA, ADR e doc operacional **deve** usar estes termos consistentemente.

---

## A

- **Artigo** — Unidade editorial publicada por editor/admin. Tem título, excerpt, body (texto puro — [ADR-014](../planning/adrs/ADR-014-article-body-texto-puro.md)), autor, editoria, cover_url, status, published_at.
- **Audit log** — Registro imutável de eventos sensíveis (login, ban, publish, password change). Vive em `apps.audit`.
- **Autor** — Mesma pessoa que **Redator** ou **Editor**. Termo "autor" preferido em UX pública; "editor" usado no admin.

## B

- **Body** — Corpo do artigo (texto editorial longo). Texto puro hoje ([ADR-014](../planning/adrs/ADR-014-article-body-texto-puro.md)); JSONField estruturado em backlog.
- **BanRequest** — Pedido formal de ban aberto por editor; aprovado/rejeitado por admin. NUNCA aplicado direto pelo editor.

## C

- **Categoria / Editoria** — Sinônimos. Classificação editorial (Música, Moda, Cinema, Literatura, Cultura Digital). 5 fixas pré-cadastradas no MVP ([ADR-002](../planning/adrs/ADR-002-tags-pre-cadastradas.md)).
- **CA (Critério de Aceitação)** — Condição testável em booleano para aceitar uma Feature. `CA01..CANN` dentro do arquivo de Feature.
- **Comment** — Comentário em artigo. Suporta replies (parent_id), likes, soft-delete.
- **Cover** — Imagem de capa do artigo. URL armazenada em `Article.cover_url`. Servido pelo nginx local (curto prazo) ou Supabase Storage futuro ([Sprint 6](sprints/sprint-6-supabase-evaluation.md)).

## D

- **Done** — Status terminal de Epic/Feature/US/Task. Definido em [README §Definition of Done](README.md#definition-of-done-de-feature).
- **DPO (Data Protection Officer)** — Gabriel Marques · contato `privacidade.interpop@gmail.com` ([ADR-008](../planning/adrs/ADR-008-dpo-designado.md)).

## E

- **Editor** — Role que publica artigos. Pode abrir BanRequest. Hierarquia: `dev > admin > editor > user`.
- **Editoria** — Sinônimo de Categoria. Termo UX-facing preferido em pt-BR.
- **Epic (EP-NN)** — Macro-objetivo de produto. Decomposto em Features. IDs imutáveis.

## F

- **Feature (F-NN)** — Chunk de valor entregue dentro de um Epic. Contém Descrição + CAs + USs (com BDD) + Tasks. IDs imutáveis.

## L

- **Leitor anônimo** — Persona P-01. Sem cadastro. Maior fatia do MAU.
- **Leitor autenticado** — Persona P-02. Cadastrado, pode comentar/curtir/receber newsletter.

## M

- **MAU (Monthly Active Users)** — Métrica de uso. KVM 1 dimensionado para ≤30k MAU sustentado ([ADR-005](../planning/adrs/ADR-005-hostinger-kvm1.md)).
- **Migration** — Arquivo Django de DDL. Numeradas (`0001_initial.py`, `0002_search_indexes.py`...).

## R

- **Redator** — Sinônimo de Editor / Autor (UX-facing).
- **RF (Requisito Funcional)** — Capacidade do sistema. `RF-NNN`. Vive em `docs/requirements/RF/`.
- **RNF (Requisito Não-Funcional)** — Qualidade transversal (perf, security, a11y, LGPD, availability). `RNF-NN`. Vive em `docs/requirements/RNF/`.
- **Role** — Papel de autorização: `dev | admin | editor | user`. Hierarquia hard-coded.

## S

- **Search log** — Tabela operacional de buscas para detecção de abuso. Retention 7d, pseudonimizado (hash + IP truncado + bucket 5min — [RNF-lgpd](../requirements/RNF/RNF-lgpd.md)).
- **search_vector** — Coluna `tsvector` do Postgres que materializa o índice FTS. Mantida por trigger SQL ([ADR-018](../specs/busca-editorial/adrs/ADR-018-trigger-sql-fonte-verdade-consistencia.md)).
- **Sprint** — Janela de execução de ~1-2 semanas. Não confundir com "Sprint" como time-box rígido — aqui é mais "tema da janela".

## T

- **Task (TNN.M.K ou TX-NN)** — Unidade implementável de trabalho. Único nível onde termos técnicos são aceitos no título. Cada Task fechada cita o commit (SHA) que a entregou.

## U

- **US (User Story USNN.M)** — Necessidade de uma persona específica em formato canônico `Como [persona], quero [ação], para [valor]`. Inclui cenários BDD em Gherkin.

## V

- **Visão de produto** — Seção obrigatória em todo Epic/Feature. pt-BR sem jargão técnico. Conta o "porquê" e o "para quem".

---

## Cross-references

- Convenções de naming: [`backlog/README.md`](README.md)
- Skill canônica: [`engenharia-de-requisitos`](https://github.com/seekdevcore/sk-requirements-engineering-theskill)
- Architecture overview: [`docs/architecture/overview.md`](../architecture/overview.md)
