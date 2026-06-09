# RF-007 — Busca editorial

> **Tipo**: Requisito Funcional
> **Prioridade**: 🟠 Alta (entrega Sprint 4 + refino Sprint 5)
> **Status**: 🚧 Realizado parcialmente (F-30 ✅ Done; F-31/F-32 Sprint 5)

---

## Enunciado de negócio (pt-BR, sem termo técnico)

> **Sistema permite que leitor encontre artigos publicados a partir de um termo livre digitado, opcionalmente refinado por autor, editoria e intervalo de datas, com resultados ordenados por relevância editorial e recência, exibidos com destaque visual dos termos buscados, em até 300ms percebidos pelo leitor.**

### Subseção §filtros

> Sistema aceita filtros opcionais sobre a busca: nome de autor, nome de editoria, e intervalo de datas de publicação. Filtros são combinados via AND (todos precisam ser verdadeiros para o artigo aparecer).

### Subseção §deep-link

> Estado completo da busca (termo + filtros + página) é serializado em URL única, navegável, compartilhável, e que reabre exatamente o mesmo estado quando colada em outra aba.

---

## Justificativa (por que este requisito existe)

Interpop é leitura longa. Quanto mais artigos publicamos, mais o acervo cresce e mais difícil fica para o leitor encontrar:

- O artigo que ele leu há 3 meses e quer reler
- Análise editorial sobre um tema específico (ex.: "Beyoncé", "Substack")
- Trabalhos de um redator que ele segue
- Conteúdo de uma editoria específica em um período (retrospectiva)

Sem busca, leitor depende de:

- Memória do título
- Navegação manual em editoria (lento)
- Google externo (perde-se referrer, sem highlight)

**Implicação de produto**: busca é fundação de retenção. KPI alvo pós-launch: +15% sessões com >2 páginas vistas.

---

## Realizado por (rastreabilidade ↓)

Este requisito é executado pelos seguintes Epics e Features:

| Epic                                                                  | Feature(s)                                                                                | Status      |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------- |
| [EP-10 Busca editorial](../../backlog/epics/EP-10-busca-editorial.md) | [F-30 Busca por texto livre](../../backlog/features/F-30-busca-texto-livre.md)            | ✅ Done     |
| [EP-10 Busca editorial](../../backlog/epics/EP-10-busca-editorial.md) | [F-31 Filtros](../../backlog/features/F-31-filtros-busca.md)                              | ⏳ Sprint 5 |
| [EP-10 Busca editorial](../../backlog/epics/EP-10-busca-editorial.md) | [F-32 Deep-linking + compartilhamento](../../backlog/features/F-32-deep-linking-busca.md) | ⏳ Sprint 5 |

---

## Requisitos Não-Funcionais que limitam este RF

| RNF                                            | Limite imposto                                                                               |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [RNF-perf](../RNF/RNF-perf.md)                 | p95 ≤ 300ms server, p75 LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1                                   |
| [RNF-security](../RNF/RNF-security.md)         | Throttle 30/60/500 min, HMAC cursor, XSS escape em highlight                                 |
| [RNF-a11y](../RNF/RNF-a11y.md)                 | WCAG 2.2 AA em todos os 5 estados (empty, loading, results, no-results, rate-limited, error) |
| [RNF-lgpd](../RNF/RNF-lgpd.md)                 | search_log retention ≤ 7 dias, query plain nunca persistida (hash 16 chars)                  |
| [RNF-availability](../RNF/RNF-availability.md) | Feature flag `SEARCH_FEATURE_ENABLED` permite degradação graciosa (503 + Retry-After)        |

---

## Restrições e fora-de-escopo

- **Idioma**: somente português brasileiro (stemming via `portuguese_stem` do Postgres). Inglês/espanhol fora de escopo MVP.
- **Mídia**: busca apenas em texto (título, excerpt, body). Imagens, áudio e vídeo fora de escopo.
- **Personalização**: ranking não considera histórico do usuário. Fora de escopo (futuro: ML).
- **Semantic search / embeddings**: fora de escopo do MVP. Avaliação possível em Sprint 6+ (ver [ADR-015 Supabase deferred](../../planning/adrs/ADR-015-supabase-evaluation-deferred.md) para discussão de pgvector).
- **Salvar buscas**: leitor não pode "favoritar busca" no MVP. Fora de escopo.

---

## Decisões técnicas relacionadas (ADRs)

Detalhe completo em [`docs/specs/busca-editorial/adrs/INDEX.md`](../../specs/busca-editorial/adrs/INDEX.md). Destaques que afetam diretamente o enunciado deste RF:

- **ADR-021** — Ranking: `ts_rank_cd` + recency boost com half-life de 60 dias
- **ADR-022** — Highlight client-side com `query_terms_expanded` (stems pt-BR retornados pelo server)
- **ADR-023** — URL canônica `GET /api/v1/search/articles/`
- **ADR-024 + ADR-036** — Throttle 3 camadas (anon 30/min + user 60/min + global 500/min)
- **ADR-028** — UI semântica `<input type="search">` (não combobox APG-violator)

---

## Histórico

| Data       | Evento                                                                                                                           |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-02 | RF identificado durante spec multi-agente (DESIGN v3)                                                                            |
| 2026-06-04 | F-30 implementada, atendendo CA01-CA15                                                                                           |
| 2026-06-09 | F-30 mergeada em main (PR #37 → `2bdf73b`); 3 CAs (perf k6, Lighthouse CI, retention cron) marcados para automatizar no Sprint 5 |
| Sprint 5   | Previsto: F-31 + F-32 entregam §filtros e §deep-link                                                                             |

---

## Cross-references

- [Personas e cenários](../personas-e-cenarios.md) — leitor anônimo + autenticado
- [Backlog do Epic](../../backlog/epics/EP-10-busca-editorial.md)
- [Spec técnica completa](../../specs/busca-editorial/DESIGN.md)
- [Architecture overview §5 apps Django](../../architecture/overview.md)
