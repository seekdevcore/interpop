# Personas e cenários de uso — Interpop

> Personas canônicas do produto. Toda US (User Story) referencia uma dessas no formato `Como [persona], quero ...`.

---

## Hierarquia de autorização

```
dev > admin > editor > user (leitor autenticado) > anônimo
```

---

## P-01 — Leitor anônimo

- **Quem**: pessoa que descobriu o Interpop via search engine, link de amigo, ou rede social. Não criou conta.
- **Objetivo principal**: ler artigos editoriais de cultura pop.
- **Comportamento típico**:
  - Chega via URL direta de artigo OR home (`/`)
  - Lê 1-3 artigos em uma sessão
  - Não comenta, não curte
  - Pode tentar buscar termo
- **Dispositivo majoritário**: smartphone Android médio em 4G
- **Frequência**: 70% do tráfego MAU
- **Permissões**: leitura pública apenas

## P-02 — Leitor autenticado

- **Quem**: leitor que se cadastrou (consentimento explícito). Quer participar (curtir, comentar) ou receber newsletter.
- **Objetivo principal**: ler + interagir + ser notificado
- **Comportamento típico**:
  - Volta ao site 2-3 vezes por semana
  - Lê 2-5 artigos por sessão
  - Comenta em ~10% dos artigos lidos
  - Recebe e abre newsletter semanal
- **Permissões**: tudo de P-01 + comentar + curtir + perfil + newsletter
- **Notação skill**: `Como leitor autenticado, quero ...`

## P-03 — Editor / Redator

- **Quem**: jornalista/colaborador convidado para publicar. Cadastrado pelo admin.
- **Objetivo principal**: publicar artigos editoriais
- **Comportamento típico**:
  - Acessa `/admin/articles/criar`
  - Escreve em editor de texto puro (ADR-014)
  - Publica como draft → submit → admin publica OR pode publicar direto (depende de role config)
  - Solicita ban via `BanRequest` se notar comentário ofensivo (não pode banir direto)
- **Permissões**: publicar + editar próprios + abrir BanRequest

## P-04 — Admin

- **Quem**: moderador do produto. Pode tudo exceto se virar contra outro admin (admins imunes entre si).
- **Objetivo principal**: manter saúde editorial + comunidade
- **Comportamento típico**:
  - Modera comentários reportados
  - Aprova/rejeita BanRequests de editores
  - Promove leitor a editor quando necessário
  - Não escreve artigo (geralmente; pode se quiser)
- **Permissões**: tudo exceto banir outro admin

## P-05 — Dev (Owner)

- **Quem**: criador/dono do produto (Gabriel Marques hoje). Único role acima de admin.
- **Objetivo principal**: garantir saúde técnica + integridade do produto
- **Comportamento típico**:
  - Admin++ (pode tudo)
  - Imune a ban por design
  - Único que pode promover outros para admin/dev
- **Permissões**: superadmin total

---

## Cenários de uso compostos (referenciados em Epics)

### Cenário CU-01: Descoberta de tema específico

P-01 (anônimo, mobile) chega via Google buscando "Beyoncé Soft Power", clica em resultado do Interpop, lê artigo, **quer ler mais sobre o mesmo tema**.

→ Atendido por: [EP-10 Busca editorial](../backlog/epics/EP-10-busca-editorial.md) (entra em `/buscar?q=beyoncé`)

### Cenário CU-02: Engajamento de leitor recorrente

P-02 (autenticado) volta ao site no domingo de manhã, lê 3 artigos novos, comenta no que mais gostou.

→ Atendido por: EP-01 (auth) + EP-02 (publicação) + EP-03 (comentários)

### Cenário CU-03: Moderação de conflito

P-03 (editor) lê comentário ofensivo, abre BanRequest. P-04 (admin) recebe notificação, revisa, aprova ban.

→ Atendido por: EP-05 (moderação) + EP-06 (admin)

### Cenário CU-04: Onboarding de novo redator

P-04 (admin) convida P-03 (editor novo). P-03 recebe credenciais, faz login, escreve primeiro artigo, publica.

→ Atendido por: EP-01 (users-auth) + EP-02 (publicação) + EP-06 (admin promovendo role)

---

## Cross-references

- Hierarquia técnica de roles: [architecture/overview.md §4](../architecture/overview.md)
- ADRs de permissão: [`docs/planning/adrs/ADR-008-dpo-designado.md`](../planning/adrs/ADR-008-dpo-designado.md)
- Backlog principal: [`docs/backlog/README.md`](../backlog/README.md)
