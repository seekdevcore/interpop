# skills/ — Skills do projeto Interpop

Catálogo de todas as skills referenciadas em `AGENTS.md` (seção *Plugins ativos*), na mesma ordem de prioridade. As **skills locais** ficam versionadas aqui (cópia física); os **plugins** vivem fora do projeto (gerenciados pela harness Claude Code) e são apenas referenciados.

## Ordem de prioridade (espelho de AGENTS.md)

| # | Skill | Tipo | Onde mora |
|---|-------|------|-----------|
| 1 | `andrej-karpathy-skills@karpathy-skills` | Plugin (harness) | `~/.claude/plugins/karpathy-skills/` |
| 2 | `superpowers@claude-plugins-official` | Plugin (oficial) | `~/.claude/plugins/claude-plugins-official/plugins/superpowers/` |
| 3 | `superpowers@superpowers-dev` | Plugin (dev) | `~/.claude/plugins/superpowers-dev/plugins/superpowers/` |
| 4 | **`referencias-dashboards`** | **Skill local** | **[`./referencias-dashboards/`](./referencias-dashboards/)** |
| 5 | **`ecossistemas-ui-ux`** | **Skill local** | **[`./ecossistemas-ui-ux/`](./ecossistemas-ui-ux/)** |
| 6 | `frontend-design@claude-plugins-official` | Plugin (oficial) | `~/.claude/plugins/claude-plugins-official/plugins/frontend-design/` |

## Skills locais — fonte de verdade

`ecossistemas-ui-ux` e `referencias-dashboards` derivam dos PDFs em `docs/` deste projeto. Cada uma contém:

- `SKILL.md` — definição com YAML frontmatter (`name`, `description`) + corpo carregado pelo Claude Code quando invocada.
- `README.md` — descrição voltada ao desenvolvedor.
- `references/` — espaço para material extenso futuro.

**Single source of truth ativo.** O Claude Code lê em `~/.claude/skills/<nome>/`, mas esse caminho é um **symlink** para este diretório. Editar a skill aqui propaga automaticamente.

Verificação:

```bash
ls -la ~/.claude/skills/ecossistemas-ui-ux    ~/.claude/skills/referencias-dashboards
# → ambas devem apontar para .../interpop/skills/<nome>
```

Para replicar em uma máquina nova (após clonar o repositório):

```bash
PROJECT=/caminho/para/interpop
ln -s "$PROJECT/skills/ecossistemas-ui-ux"    ~/.claude/skills/ecossistemas-ui-ux
ln -s "$PROJECT/skills/referencias-dashboards" ~/.claude/skills/referencias-dashboards
```

## Plugins — gerenciados pela harness

Plugins **não** são copiados para este diretório. São instalados via marketplace/CLI do Claude Code e ficam no diretório global da harness. Listados acima apenas para deixar a *ordem de prioridade* completa de AGENTS.md visível em um único lugar.

Para reinstalar os plugins em uma máquina nova, ver a documentação do Claude Code ou o registro do marketplace.

## Como atualizar uma skill

1. Editar `skills/<nome>/SKILL.md` (ou outros arquivos).
2. Se o Claude Code já estiver usando symlinks (ver acima), nada mais precisa ser feito.
3. Se ainda há cópia em `~/.claude/skills/`, espelhar a alteração lá ou recriar via `cp -r`.
4. Validar: `wc -w skills/<nome>/SKILL.md` (alvo: 500–2000 palavras).
