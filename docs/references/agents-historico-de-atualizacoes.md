# Histórico de atualizações do AGENTS.md

> Notas "_Atualizado em_" que ficavam no fim das seções do `AGENTS.md`, movidas para cá em 2026-11-04. Texto original, sem reescrita, na ordem em que apareciam.

_Atualizado em 2026-05-19 — adicionada §0 "Comportamento esperado" a partir de `docs/references/PDF Gabarito.pdf` (5 diretrizes inegociáveis + acknowledgment de sessão); skill `claude-cookbooks`, comandos `uv` no topo, sumários para todos os plugins/skills ativos (garante invocação mesmo se o protocolo falhar), reorganização para colocar comandos antes das listas longas._

_Atualizado em 2026-05-20 — adicionada §5 com 19 roadmaps canônicos de roadmap.sh, mapeamento por relevância para o stack Interpop + skills correspondentes. Versão project-agnostic em `~/.claude/CLAUDE.md` (global)._

_Atualizado em 2026-05-21 — adicionada §6 Política de testes (INEGOCIÁVEL): 10 tipos de teste core praticados + 13 tipos de extensão + protocolo formal para criar tipo novo, convenções operacionais (reports `docs/tests/` com timestamp ISO 8601), cross-ref para `testing-standards.md` como documento-mestre. Item-pointer adicionado em §4 Convenções._

_Atualizado em 2026-11-04 — `AGENTS.md` enxugado (340 → 100 linhas) para carregar mais rápido no início de cada sessão: §3 (Sumários), §5 (Roadmaps), o texto integral da §0 e da §6 e estas notas de histórico foram movidos, sem reescrita, para `docs/references/agents-*.md`; o `AGENTS.md` ficou com as regras de toda sessão e a seção "Onde está o resto". Saiu da §4 a linha que mandava aplicar o protocolo global de skills, extinto nesta data (texto guardado em `agents-sumarios-de-skills.md`)._

## Texto anterior do item 3 da §2

Até 2026-11-04, antes da desativação do `superpowers@superpowers-dev`, o item 3 da lista de plugins e skills ativos dizia:

3. **`superpowers@superpowers-dev`** — variante de desenvolvimento (skills experimentais). Complemento ao oficial.
