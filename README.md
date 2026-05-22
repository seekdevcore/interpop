# Interpop

> Projeto editorial brasileiro que analisa criticamente o **Soft Power** e o papel da cultura pop na manutenção da hegemonia global.

A partir de música, moda, cinema, literatura e cultura digital, o Interpop investiga como determinados atores exercem influência política de forma indireta no sistema internacional.

---

## Stack

| Camada                     | Tecnologia                                                                       |
| -------------------------- | -------------------------------------------------------------------------------- |
| **Frontend**               | React 19 + TypeScript + Vite + React Router 7                                    |
| **Backend**                | Django 5 + Django REST Framework                                                 |
| **Toolchain Python**       | [`uv`](https://docs.astral.sh/uv/) (substitui pip + venv)                        |
| **Banco**                  | SQLite (dev) · PostgreSQL (prod)                                                 |
| **Auth**                   | JWT em cookie httpOnly + django-axes (brute-force) + roles admin/editor/user     |
| **Charts**                 | Recharts (dashboard de métricas admin)                                           |
| **E-mail**                 | SMTP Gmail (welcome + notificações de artigo + alertas de moderação)             |
| **SEO**                    | Sitemap.xml + robots.txt dinâmicos + Open Graph middleware para crawlers sociais |
| **Hospedagem (planejada)** | Hostinger KVM 1 — Nginx + gunicorn + systemd + Let's Encrypt                     |

---

## Rodar localmente

**Pré-requisitos:** Node ≥ 20.19 e `uv` instalado.

```bash
# 0. Instalar uv (uma vez por máquina) — gerencia Python + deps + venv
curl -LsSf https://astral.sh/uv/install.sh | sh

# 1. Clonar
git clone git@github.com:GabeMarques-Intetsu/interpop.git
cd interpop

# 2. Backend (terminal 1) — uv resolve Python 3.12 + .venv + deps em ~3s
cd backend
uv sync                                       # cria .venv com tudo do uv.lock
cp .env.example .env                          # ajustar SECRET_KEY, EMAIL_*, etc.
uv run python manage.py migrate
uv run python manage.py createsuperuser
uv run python manage.py runserver             # http://127.0.0.1:8000

# 3. Frontend (terminal 2)
cd ..                                         # voltar à raiz
npm install
npm run dev                                   # http://localhost:5173
```

**Single-source-of-truth para skills locais:** após clonar, criar symlinks para o Claude Code descobrir as skills do projeto (opcional, só se você usa Claude Code):

```bash
PROJECT="$(pwd)"
ln -s "$PROJECT/skills/claude-cookbooks"        ~/.claude/skills/claude-cookbooks
ln -s "$PROJECT/skills/ecossistemas-ui-ux"      ~/.claude/skills/ecossistemas-ui-ux
ln -s "$PROJECT/skills/referencias-dashboards"  ~/.claude/skills/referencias-dashboards
```

---

## Estrutura

```
interpop/
├── backend/                    # Django API (gerenciado por uv)
│   ├── apps/
│   │   ├── articles/           # Posts + categorias + sitemap + OG middleware
│   │   ├── audit/              # Middleware + endpoint de métricas
│   │   ├── comments/           # Comentários + curtidas
│   │   ├── moderation/         # Banimentos diretos + BanRequest workflow
│   │   ├── newsletter/         # Inscrições + templates de e-mail
│   │   └── users/              # Auth (JWT cookie) + roles admin/editor/user
│   ├── config/settings/        # base, development, production
│   ├── pyproject.toml          # Dependências (fonte de verdade)
│   ├── uv.lock                 # Lockfile reproduzível
│   └── requirements.txt        # Auto-exportado (compat com tooling externo)
├── src/                        # React app
│   ├── pages/                  # Home, Article, News, Admin, CreatePost, etc.
│   ├── components/             # UI compartilhada (NewsCard, Modal, ArticleShareBar, ...)
│   ├── services/               # Camada axios → Django
│   ├── router/                 # Rotas + AdminRoute + ScrollToHashOrTop
│   └── utils/                  # Helpers puros (renderArticleBody, etc.)
├── skills/                     # Skills locais do projeto (com symlinks globais)
│   ├── claude-cookbooks/       # Catálogo dos notebooks Anthropic (84 recipes)
│   ├── ecossistemas-ui-ux/     # Padrão UI/UX do projeto (5 categorias de fontes)
│   ├── referencias-dashboards/ # Padrão para dashboards/KPIs/admin
│   └── README.md               # Catálogo + instruções de instalação
├── docs/
│   ├── Logos/                  # Variantes do logo (SVG + assinatura)
│   ├── planning/               # Planejamento interno (gitignored — local-only)
│   │   ├── Improvement-system.md
│   │   ├── HOSTING-DEPLOY-PLAN.md
│   │   ├── session-auth-strategy.md
│   │   ├── reorganization-proposal-2026-05-21.md
│   │   └── audits-2026-05-21/
│   ├── references/             # PDFs canônicos (fontes primárias)
│   │   ├── PDF Gabarito.pdf
│   │   ├── ecossistema_ui_ux_revisado.pdf
│   │   └── guia_referencias_dashboards.pdf
│   ├── tests/                  # Padrões + reports de teste
│   │   ├── testing-standards.md (+ .pdf)
│   │   ├── reports/            # .md por execução (gitignored — local)
│   │   └── reports-pdf/        # PDF espelho (gitignored — local)
│   └── architecture/           # (a criar) overview + diagramas C4
├── scripts/                    # md-to-pdf.sh + futuros stubs operacionais
├── .github/workflows/          # ci.yml (pytest cov 40% + tsc/lint/build)
├── AGENTS.md                   # Instruções para agentes AI (espelhado em CLAUDE.md)
└── CLAUDE.md                   # → AGENTS.md (symlink — mesmo conteúdo)
```

---

## Convenções

- **Typecheck obrigatório**: `npx tsc --noEmit` (frontend) e `uv run python manage.py check` (backend) devem sair com `exit 0` antes de qualquer push.
- **Commits AI** incluem `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- **Padrão UI/UX**: definido na skill `skills/ecossistemas-ui-ux/SKILL.md` (sumário no AGENTS.md §3).
- **Padrão dashboards**: definido na skill `skills/referencias-dashboards/SKILL.md` (sumário no AGENTS.md §3).
- **Features Claude API**: começar **sempre** pelo cookbook em `skills/claude-cookbooks/SKILL.md`.
- **Acessibilidade**: WCAG 2.2 + Core Web Vitals validados em toda entrega de frontend.
- **Nunca commitar**: `backend/.env`, `backend/db.sqlite3`, `backend/.venv/`, `**/__pycache__/` (já no `.gitignore`).

---

## Documentação adicional

- [AGENTS.md](AGENTS.md) — instruções para agentes AI: comandos do projeto, plugins ativos, sumários e convenções.
- [skills/README.md](skills/README.md) — catálogo das skills locais + plugins referenciados.
- [docs/architecture/overview.md](docs/architecture/overview.md) — arquitetura atual (stack, topologia, apps, observability) em uma página.
- [docs/runbooks/](docs/runbooks/) — runbooks operacionais (stubs — preencher conforme incidentes).
- [docs/postmortems/](docs/postmortems/) — postmortems blameless (TEMPLATE + catálogo).

---

## Licença

**Proprietária — todos os direitos reservados** · Copyright © 2026 Gabriel Marques.

Ver [LICENSE](LICENSE) para os termos completos. Resumo:

- **Você pode**: baixar, executar localmente para estudo/avaliação, e **se inspirar** em técnicas, padrões e decisões de design para projetos independentes e distintos.
- **Você NÃO pode**: copiar trechos substanciais para outros projetos, redistribuir, revender, sublicenciar, hospedar versão pública ou usar como base de produto comercial.
- **Cliente Interpop**: tem autorização expressa para operar este software como produto editorial próprio (interpop.cc).
- **Outros usos**: pedidos de autorização (licenciamento comercial, fork público, parceria) via GitHub `@GabeMarques-Intetsu`.
