# ADR-035: Pseudonimização forte do `search_log` (bucket 5min + HMAC-pepper rotativo + IP/16 ou drop)

- **Status**: Accepted
- **Date**: 2026-06-03
- **Tags**: security, lgpd, privacy, database, pseudonymization, search-log
- **Stakeholders**: cyber-security-architect (autor da review), database-architect, code-implementer, product-manager (decide Q1)
- **Layer**: Security / Database
- **Origin**: SECURITY-REVIEW.md §3 achado **H-02** + §7.1 contestação anti-sycophancy

## Context

DESIGN v3 §3.4 (linha 437) afirma que a `search_log` cumpre LGPD via "query plain nunca persistida (hash 16 chars); IP /24; user hash; TTL 7d". O `cyber-security-architect` contestou:

- **Entropia real é fraca**: `query_hash_16` = 64 bits truncados de SHA256. Para queries do head Zipfiano (top-100 — `kpop`, `lula`, `beyoncé`, `frança`), rainbow table reverte hash→query em segundos. O hash é determinístico e enumerável.
- **`ip_24`** carrega 256 hosts por sub-rede; em residenciais com CGNAT pequeno, 1-50 indivíduos plausíveis.
- **`timestamp` em segundos** dá granularidade alta. Casado com `user_hash` (mesmo leitor faz 30 buscas no minuto) + `ip_24` + janela temporal + outros logs do projeto (`articles`, `comments`, `apps.audit`) → fingerprint comportamental + ponte de identidade entre sessão anônima e sessão logada.
- **LGPD Art. 12 §2º** exige impossibilidade técnica de re-identificação por meios razoáveis. O conjunto atual **não** sustenta anonimização forte — é pseudonimização fraca. Comunicar "conformidade LGPD" sobre essa base **expõe o projeto à ANPD** em caso de incidente.

Buscas podem revelar dado sensível (LGPD Art. 5 II): saúde, política, orientação sexual. O custo de re-identificação parcial é alto reputacionalmente.

## Decision Drivers

- **Conformidade LGPD real**, não declarada — Art. 5 II/III + Art. 12 §2º + Art. 18 (DSAR).
- **Defesa em camadas**: nenhuma propriedade isolada (hash, IP, user) deve permitir re-identificação.
- **Custo aceitável de analytics**: o `search_log` precisa ainda servir analytics agregado (queries populares, taxa de "no results").
- **Minimização de coleta** (LGPD Art. 6 III) — coletar o menos possível para o fim declarado.
- **Pivot operacional aceito**: rotação periódica de pepper invalida rainbow tables construídas sobre logs anteriores.

## Considered Options

1. **Manter DESIGN v2** (`query_hash_16` SHA256 sem pepper + IP/24 + timestamp seg + user_hash) — rejeitado por H-02.
2. **Reduzir tudo a agregado horário sem PII** (só `query_hash, results_count_bucket, hour_bucket`) — perde forensics de abuse e DSAR.
3. **Pseudonimização forte multi-camada**: HMAC-pepper rotativo + bucket 5min + IP/16 ou drop + base legal LGPD declarada ⭐
4. **Eliminar `search_log` totalmente** — perde toda capacidade de analytics e defesa contra abuso.

## Decision Outcome

**Chosen option: Opção 3** — pseudonimização forte multi-camada. Mesmo se Q1 (open question §8 da SECURITY-REVIEW) responder "(a) só analytics", a estrutura é compatível (Q1=a remove campos; Q1=b/c mantém com pseudonimização forte). A decisão arquitetural é **uma**, a configuração é parametrizada.

### Esquema concreto

```python
# apps/search/models.py
class SearchLog(models.Model):
    query_hash = models.CharField(max_length=32, db_index=True)
    # HMAC-SHA256(SEARCH_LOG_PEPPER, normalized_query)[:32]
    # pepper rotaciona a cada 30 dias via management command
    # 16 hex chars antigo (64 bits) → 32 hex chars (128 bits) — torna brute force inviável

    timestamp_bucket = models.DateTimeField(db_index=True)
    # bucketed a 5 minutos: date_trunc('minute', NOW()) - (EXTRACT(minute FROM NOW())::int % 5) min

    user_hash = models.CharField(max_length=32, null=True, blank=True)
    # HMAC-SHA256(SEARCH_LOG_PEPPER, str(user_id))[:32] — null se anônimo

    ip_prefix = models.CharField(max_length=15, null=True, blank=True)
    # IP /16 (ex.: "192.168") — OU completamente dropado conforme Q1
    # se Q1 = (a) só analytics → null forçado

    results_count = models.PositiveIntegerField()
    feature_flag_session = models.CharField(max_length=16, null=True)
    # ex.: "search_v1" — habilita análise de coorte se feature flag muda

    class Meta:
        indexes = [
            models.Index(fields=['query_hash', 'timestamp_bucket']),
        ]
```

### Rotação de pepper

```python
# settings/base.py
SEARCH_LOG_PEPPER_CURRENT = env('SEARCH_LOG_PEPPER_CURRENT')  # 32 bytes random
SEARCH_LOG_PEPPER_PREVIOUS = env('SEARCH_LOG_PEPPER_PREVIOUS', default=None)
SEARCH_LOG_PEPPER_ROTATION_DAYS = 30
```

Management command `rotate_search_log_pepper` (cron mensal):

1. Move `_CURRENT` → `_PREVIOUS`
2. Gera novo random 32 bytes → `_CURRENT`
3. Após 30d, `_PREVIOUS` é zerado — logs antigos viram irreversíveis mesmo com posse da chave atual.

### Base legal LGPD declarada (texto canônico em `docs/legal/privacy.md`)

> "O Interpop coleta dados pseudonimizados sobre buscas (hash criptográfico irreversível da consulta, agregação temporal a 5 minutos, identificador de sessão hasheado, e — quando habilitado — prefixo de rede /16) com retenção máxima de 7 dias, exclusivamente para (a) melhoria do serviço editorial e (b) defesa contra abuso. Base legal: **legítimo interesse** (LGPD Art. 7 IX) ponderado contra o impacto residual em re-identificação. Pseudonimização revisada a cada 30 dias via rotação de pepper criptográfico."

### Positive Consequences

- HMAC-pepper com rotação 30d invalida rainbow tables construídas sobre logs vazados — atacante com posse do dump precisa também ter o pepper específico daquela janela.
- Bucket 5min reduz capacidade de correlação temporal (fingerprint cai de ~720 amostras/h para 12).
- IP /16 (ou drop) elimina ponte CGNAT residencial.
- Hash de 128 bits (32 hex) elimina brute force prático mesmo para top-100 Zipf.
- Base legal **declarada e auditável** — ANPD aceita pseudonimização forte sob legítimo interesse.

### Negative Consequences

- **Analytics perde precisão**: bucket 5min reduz granularidade temporal — séries por minuto não são mais possíveis.
- **Custos operacionais**: management command de rotação precisa scheduling confiável (cron + Healthchecks.io ping — Task M-06 / T30.4.X8).
- **DSAR (LGPD Art. 18)**: cliente pedindo "minhas buscas" não pode receber resposta exata (pseudonimização forte = impossível reverter por design); resposta canônica: "dado pseudonimizado, não associável de volta — destruído após 7d".
- **Forensics de abuse fica mais difícil**: investigar incidente requer cruzamento com pepper da janela ativa naquele momento.

## Pros and Cons of the Options

### Opção 1 — DESIGN v2 (hash 16 + IP/24 + timestamp seg)

- 👍 Implementação simples; sem rotação.
- 👎 Pseudonimização fraca; rainbow table trivial em head Zipf; vetor de re-identificação real.
- 👎 LGPD "comunicada" sem sustentação técnica = risco regulatório.

### Opção 2 — Só agregado horário sem PII

- 👍 LGPD trivial.
- 👎 Perde DSAR, perde forensics, perde detecção de abuse por user/IP.

### Opção 3 — Pseudonimização forte multi-camada ⭐

- 👍 Conformidade LGPD real, defensável em auditoria.
- 👍 Mantém analytics (com granularidade aceitável) + forensics (com fricção controlada).
- 👎 Custo operacional de rotação + complexidade conceitual no time.

### Opção 4 — Eliminar `search_log` totalmente

- 👍 Zero risco LGPD.
- 👎 Cega para abuse + zero capacidade de melhoria orientada por dado.

## Implementation Notes

- **Task ID**: **T30.4.X1\*** (LGPD pseudonimização forte) — 🟠 High, Sprint 4
- **Tasks suporte**: TX-19 (search_log no `--exclude-table-data` do `pg_dump`), T30.4.X8 (Healthchecks.io ping na purga 7d)
- **Settings**: 3 env vars novos (`SEARCH_LOG_PEPPER_CURRENT`, `SEARCH_LOG_PEPPER_PREVIOUS`, `SEARCH_LOG_PEPPER_ROTATION_DAYS`)
- **Migration**: `apps/search/migrations/000X_search_log_pseudonymization.py` — schema novo + data migration que dropa coluna antiga `query_hash_16` (não preserva, é PII fraca)
- **Management command**: `apps/search/management/commands/rotate_search_log_pepper.py` + systemd timer mensal
- **Documentos legais**: `docs/legal/privacy.md` — seção LGPD com base legal explícita
- **Testes**: ver ADR-039 (test integration de bypass de trigger) e SECURITY-REVIEW §9 passo 8 (testes adversariais) — adicionalmente:
  - `test_hmac_pepper_rotation_invalidates_old_hash`
  - `test_timestamp_bucketed_to_5min`
  - `test_ip_prefix_is_class_b_or_null`
  - `test_purge_after_7d` (existente — TX-04)
- **Decisão pendente do Q1 (SECURITY-REVIEW §8)**: PM decide se `ip_prefix` é mantido ou dropado. ADR é compatível com ambos.

## Open Concerns

- **Pepper em env compartilhada com workers gunicorn** — herda risco de M-10 (SECURITY-REVIEW). Mitigação via `logging.Filter` (TX-23). Aceito como trade-off operacional até vault em Sprint 7+.
- **Falta de DPO formal** no Interpop hoje — ADR-035 assume que `product-manager` é o ponto de decisão de privacy. Quando equipe crescer, revisar.

## References

- SECURITY-REVIEW.md §3 H-02 + §7.1 (contestação) + §8 Q1
- DESIGN.md §3.4 linha 437 (a frase contestada)
- BACKLOG.md T30.4.X1 (LGPD pseudonim. forte)
- LGPD Lei 13.709/2018 Art. 5 II, III; Art. 6 III; Art. 7 IX; Art. 12 §2º; Art. 18
- ENISA — "Pseudonymisation techniques and best practices" (2019)
- NIST SP 800-188 — De-Identifying Government Datasets
- ADR-032 (`--exclude-table-data` do `search_index` — extensível ao `search_log` via TX-19)
- ADR-037 (cache key + auth_tier — invariante de não-mistura, complementar a este ADR)
