# STATE — Interpop

> **Memória viva** do projeto. Decisões importantes, blockers ativos, lessons learned, ideias deferred, preferências de operação. Atualizado em cada sessão de trabalho que produzir mudança de estado.
>
> Princípio: **prefira registrar a esperar lembrar**. O custo de uma linha extra aqui é desprezível comparado ao custo de redescobrir uma decisão em 3 meses.

---

## Decisões ativas que regem o trabalho

| Decisão                                                             | Quando                 | Por quê                                                                      | Onde                                                                                       |
| ------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Stack atual: Django + Postgres self-hosted em KVM 1 + Cloudflare    | Sprint 1               | Custo/controle/maturidade                                                    | [ADR-005](../../planning/adrs/ADR-005-hostinger-kvm1.md) + [PROJECT.md §Bases](PROJECT.md) |
| `docs/planning/` gitignored                                         | Antes da minha entrada | Convenção do dono                                                            | `.gitignore:47`. **Decisão pendente**: unignore ADRs 001-014?                              |
| Naming pt-BR sem infinitivo nem termo técnico em Epic/Feature/CA/US | 2026-06-02             | Skill engenharia-de-requisitos                                               | [backlog/README.md](../../backlog/README.md)                                               |
| TLC SDD com auto-sizing                                             | 2026-06-09             | Padronizar criação de specs                                                  | [specs/README.md](../README.md)                                                            |
| 35 ADRs da busca como exemplo canônico                              | Sprint 4               | "Complex" sized: spec multi-agent + 6 specialists + 2 validators + 3 reviews | [busca-editorial/](../busca-editorial/)                                                    |
| Supabase deferred Sprint 6+                                         | 2026-06-09             | Anti-sycophancy — cenários B/C invalidariam PR #37                           | [ADR-015](../../planning/adrs/ADR-015-supabase-evaluation-deferred.md)                     |
| PRs menores por Feature (não por Epic completo)                     | Sprint 5+              | Lição do squash de 60 commits no PR #37                                      | [Sprint 4 lessons](../../backlog/sprints/sprint-4-busca-editorial.md#lições-aprendidas)    |
| Branchar direto de `main` por Feature                               | Sprint 5+              | Acumular em develop pesou no merge                                           | idem                                                                                       |
| Node ≥20 obrigatório para hooks husky                               | Sempre                 | listr2 quebra em Node 18                                                     | `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"` antes de git commit            |

---

## Blockers ativos

| ID   | Bloqueio                                                                           | Impacto                                                         | Próxima ação                                                                            |
| ---- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| B-01 | Repo transferido `GabeMarques-Intetsu/interpop` → `seekdevcore/interpop`           | Local remote ainda aponta para o antigo (funciona via redirect) | Quando der, `git remote set-url origin git@github.com:seekdevcore/interpop.git`         |
| B-02 | `docs/planning/` gitignored — ADRs 001-014 invisíveis no GitHub                    | Reviewer de qualquer PR vê links 404 para ADRs                  | Decisão pendente: unignore `adrs/` específico? Ou migrar p/ `docs/specs/adrs-projeto/`? |
| B-03 | Scripts ops em `scripts/` são stubs (deploy/backup/rotate-secrets/weekly-capacity) | Operação manual hoje                                            | Sprint 7 dedicado                                                                       |
| B-04 | Lighthouse CI gate ainda manual                                                    | Regressão de perf passa silenciosa                              | Sprint 5 — TX-16                                                                        |
| B-05 | factory-boy declarada mas zero `factories.py` em apps                              | Tests usam `Model.objects.create(...)` ad-hoc                   | Sprint 5+ — quando dor de fixture                                                       |
| B-06 | E2E Playwright não existe                                                          | Smoke 100% manual                                               | Sprint 5 — TX-17                                                                        |
| B-07 | search_log retention 7d via cron NÃO automatizado                                  | LGPD viola se cron morrer silencioso                            | Sprint 5 — T30.4.X1 endurecimento pseudonimização                                       |

---

## Lessons learned

### Sprint 4 (busca editorial)

✅ **Continuar**

- Spec multi-agente antes de implementar — 10 bugs reais pegos antes de uma linha de código (incluindo `author_id BIGINT` errado, CONFIG `IMMUTABLE` quebrada, `useDeferredValue ≠ debounce`, paleta ardósia ignorando brand vigente)
- 3 code reviews por fase + fix inline (não acumular dívida)
- BDD em Gherkin pt-BR como contrato de aceitação (não só "smoke manual")
- Anti-sycophancy real (rejeitei adotar Supabase agora sem razão de produto)

❌ **Evitar**

- Confiar em commit message como contrato — BLOQUEIO-2 do REVIEW-PHASE-3: commit dizia `[a11y axe-core]` mas zero imports → mentira passou
- Push sem rotação de secret crítica em prod — F2-B-03 quase mandou para prod com `SEARCH_CURSOR_HMAC_SECRET == SECRET_KEY`
- 60 commits acumulados em develop antes do PR — exigiu squash que apagou granularidade
- Tentar resolver tudo em um único PR enorme (PR #37 foi 60 commits + 30 mil LOC alteradas — reviewer humano não revisaria isso de verdade)

🧪 **Experimentar (Sprint 5)**

- PRs menores por Feature (não por Epic completo)
- Branchar direto de `main` por Feature
- Visual regression Playwright `toHaveScreenshot` para 5 estados
- Hypothesis property-based em hooks puros (`useDebouncedValue`, `canonicalKey`)

### Reorg docs/ (PR #39)

✅ **Continuar**

- Mapear antes de mexer (survey de `docs/` antes da reorg pegou que ADRs 001-014 são gitignored — informação crítica)
- Anti-sycophancy: rejeitar adotar Supabase agora preservou 60 commits + 35 ADRs
- Stubs com cross-refs corretas valem mais que `# TODO: preencher` solto

---

## Ideias deferred (não fazer agora, mas anotar para não esquecer)

| Ideia                          | Quando talvez                             | Por que defer                                                |
| ------------------------------ | ----------------------------------------- | ------------------------------------------------------------ |
| Newsletter premium             | ≥12 meses após launch público             | Precisa base de 2k subscribers free com engagement antes     |
| Mastodon-like federation       | Quase nunca                               | Complexidade injustificada para produto centralizado         |
| Comments threading multi-nível | Avaliar quando user feedback pedir        | Hoje 1 nível basta para discussão editorial                  |
| Editor rich-text JSONField     | Quando body texto puro doer               | ADR-014 deferral consciente                                  |
| GraphQL                        | Talvez nunca                              | DRF + OpenAPI cobre todos os casos atuais                    |
| TypeScript no backend          | Quando?                                   | Sem dor real; ecossistema Django é estável                   |
| Sliders/carrosséis             | Não — leitura longa não pede carrossel    | UX contraindicado                                            |
| Banner LGPD cookies            | Quando Google Analytics ou similar entrar | Hoje só cookies essenciais (JWT) — Art. 7º V dispensa banner |
| Migração para Hetzner          | Quando KVM 1 saturar                      | Plano B documentado em ADR-005                               |

---

## Preferências do dono (operação)

- **Idioma**: pt-BR em todo doc + UI. Inglês permitido em código + nomes técnicos canônicos.
- **Anti-sycophancy obrigatório** ([Gabarito PDF](../../references/PDF%20Gabarito.pdf)).
- **Skills usadas exaustivamente** — protocolo em `~/.claude/CLAUDE.md`.
- **TDD nem sempre** — política está em [`testing-standards.md`](../../tests/testing-standards.md); para Feature Large/Complex sim, Quick mode não.
- **Commits com Co-Authored-By: Claude Opus 4.7 (1M context)** quando feitos por agente.
- **Modelo dominante**: Opus 4.7. Tarefas leves (validação, status, handoff) podem usar Haiku/Sonnet.
- **Não force-push em branches com PR aberto** — usa merge commit ou novo commit, nunca rebase destrutivo.

---

## Histórico de mudanças deste arquivo

| Data       | Mudança                           |
| ---------- | --------------------------------- |
| 2026-06-09 | Criado como parte da reorg PR #39 |

---

## Cross-references

- [PROJECT.md](PROJECT.md)
- [ROADMAP.md](ROADMAP.md)
- [Skill canônica `using-superpowers`](https://github.com/obra/superpowers) — princípio de invocar skills
- [Skill canônica `tlc-spec-driven`](https://github.com/davidteren/tech-leads-club-skills) — SDD auto-sized
- [Gabarito 5 diretrizes](../../references/PDF%20Gabarito.pdf) — comportamento esperado
