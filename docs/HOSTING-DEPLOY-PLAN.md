# Hospedagem & Deploy — Interpop

> Documento de decisão e roadmap. Atualizado em 2026-05-19.
> Hospedagem definida: **Hostinger KVM 1** (VPS, não PaaS).

## Stack definida

**Tudo num único VPS Hostinger KVM 1** (~R$ 40/mês, 1 vCPU, 4 GB RAM, 50 GB SSD, IPv4 dedicado).

| Camada | Como roda no VPS |
|---|---|
| **Frontend** (Vite build) | Build estático servido pelo Nginx |
| **Backend** Django + DRF | Gunicorn como WSGI atrás do Nginx (reverse proxy) |
| **Banco** | PostgreSQL local na mesma máquina |
| **Media** (capas) | `/var/www/interpop/media/` servido pelo Nginx |
| **SMTP** | Gmail (já configurado, 500/dia free) |
| **HTTPS** | Let's Encrypt via certbot (`certbot --nginx`) |
| **Process manager** | systemd unit pro gunicorn + reverse proxy Nginx |
| **Backups** | `pg_dump` diário via cron + rsync de `/media/` |

**Custo total**: ~R$ 40/mês (só Hostinger). Sem dependências externas pagas.

## Vantagem do VPS

- **Controle total**: SSH, instala o que quiser, escolhe versão Python/Node
- **Tudo num lugar só**: sem CORS entre domínios diferentes (frontend e backend mesma origem)
- **OAuth simples**: callback `https://interpop.cc/api/auth/google/callback/` funciona sem hack
- **Cookies sem dor**: `SameSite=Lax` puro (mesma origem) — sem `SameSite=None; Secure` cross-domain

## Desvantagem (a saber)

- **Você é o sysadmin**: atualizar SO, monitorar disco, configurar firewall (ufw), proteger SSH
- **Sem escala horizontal automática** (se viralizar uma matéria, vai engasgar — mas isso é problema bom de ter)
- **Backups são responsabilidade sua** (sem snapshots auto como Neon/Fly)

## Pré-requisitos antes do primeiro deploy

Ajustes obrigatórios no Django:

1. **`SECRET_KEY`** via env (no `.env` no servidor, fora do git)
2. **`DEBUG=False`** em produção
3. **`ALLOWED_HOSTS`** = `['interpop.cc', 'www.interpop.cc']` (após registrar domínio)
4. **`CSRF_TRUSTED_ORIGINS`** = `['https://interpop.cc', 'https://www.interpop.cc']`
5. **WhiteNoise** OU servir `/static/` direto pelo Nginx (mais performante)
6. **`MEDIA_ROOT = '/var/www/interpop/media/'`** apontando pra disco do VPS
7. **PostgreSQL** local: criar role + db, `DATABASES` via `dj-database-url`
8. **`SECURE_*` settings**: `SECURE_SSL_REDIRECT=True`, `SECURE_HSTS_SECONDS=31536000`, `SESSION_COOKIE_SECURE=True`, `CSRF_COOKIE_SECURE=True`
9. **`SIMPLE_JWT['AUTH_COOKIE_SECURE'] = True`** em produção

Frontend:

10. **`vite build`** gera `/dist/` — serve com Nginx `try_files`
11. **`VITE_API_URL`** = string vazia (mesma origem)

## Arquitetura no VPS

```
                    ┌─────────────────────────────────┐
   internet ────────│  Nginx (porta 443)              │
                    │   ├─ /          → /dist/ static │
                    │   ├─ /api/      → :8000 gunicorn│
                    │   ├─ /media/    → /var/www/...  │
                    │   ├─ /static/   → /var/www/...  │
                    │   └─ /django-admin/ → :8000     │
                    └─────────────────────────────────┘
                                  ↓ proxy_pass
                    ┌─────────────────────────────────┐
                    │  gunicorn (systemd, :8000)      │
                    │   workers=2-4                   │
                    │   ├─ Django (config.wsgi)       │
                    │   └─ PostgreSQL (unix socket)   │
                    └─────────────────────────────────┘
```

## Passo a passo do primeiro deploy

1. **Comprar Hostinger KVM 1** + registrar domínio (`interpop.cc` ou similar)
2. **SSH inicial**: `ssh root@<IP>`, criar user `interpop`, configurar SSH key, desabilitar root login + senha, instalar ufw, abrir só 22/80/443
3. **Stack base**: `apt install postgresql nginx git certbot python3-certbot-nginx nodejs npm` — Python NÃO precisa: o `uv` instala a versão exata (3.12) pinada no `pyproject.toml`.
4. **Instalar uv** (toolchain Python oficial do projeto): `curl -LsSf https://astral.sh/uv/install.sh | sh`
5. **PostgreSQL**: criar role `interpop` + db `interpop_db`, ajustar `pg_hba.conf`
6. **Clonar repo**: `git clone git@github.com:GabeMarques-Intetsu/interpop.git /var/www/interpop`
7. **Backend setup**: `cd backend && uv sync --frozen` (cria `.venv` com Python 3.12 + todas as deps do `uv.lock` em ~3s) + `cp .env.example .env` (editar SECRETs)
8. **Migrate + createsuperuser** + collectstatic (via `uv run python manage.py …`)
9. **systemd unit** `/etc/systemd/system/gunicorn-interpop.service`
10. **Frontend build**: `npm install && npm run build` → `/var/www/interpop/dist/`
11. **Nginx config** `/etc/nginx/sites-available/interpop` + symlink em `sites-enabled` + reload
12. **HTTPS**: `certbot --nginx -d interpop.cc -d www.interpop.cc`
13. **DNS no Hostinger**: A record apontando pro IP do VPS
14. **Cron de backup**: `0 3 * * * pg_dump interpop_db | gzip > /backups/$(date +%F).sql.gz`
15. **Testar OAuth callback** (após cadastrar apps Google + Facebook com URLs reais)

## Workflow de deploy contínuo

Script `scripts/deploy.sh` no servidor:

```bash
#!/bin/bash
set -e
cd /var/www/interpop
git pull origin main
cd backend
# uv sync --frozen instala exatamente o que está no uv.lock (reproduzível)
# em ~1-3s, contra ~30-60s do pip. Substitui venv + pip install.
uv sync --frozen
uv run python manage.py migrate --noinput
uv run python manage.py collectstatic --noinput
cd ..
npm ci --silent
npm run build
sudo systemctl restart gunicorn-interpop
echo "Deploy OK em $(date)"
```

Trigger: `ssh interpop@server "/var/www/interpop/scripts/deploy.sh"` após `git push` no main.
Pode evoluir pra GitHub Actions com SSH deploy depois.

## Status atual (2026-05-19)

- **Plataforma escolhida**: ✅ Hostinger KVM 1
- **Domínio**: ❌ a registrar
- **Settings/production.py production-ready**: ❌ falta `SECURE_*`, ajustar `ALLOWED_HOSTS`, WhiteNoise, `dj-database-url`
- **PostgreSQL na app**: ❌ ainda SQLite — migrar `DATABASES`
- **OAuth Google/Facebook**: ❌ a cadastrar (depende de domínio real)
- **Contas iniciais criadas localmente**: ✅ ver `seed_users.py`

## Pré-deploy checklist (quando for hora)

- [ ] Comprar Hostinger KVM 1
- [ ] Registrar domínio + apontar DNS
- [ ] Hardening SSH (key only, fail2ban)
- [ ] Firewall ufw
- [ ] PostgreSQL local + role + db
- [ ] Settings production tunings (SECURE_*, ALLOWED_HOSTS, CSRF_TRUSTED)
- [ ] Migration de SQLite pra Postgres (`dumpdata` + `loaddata`)
- [ ] Nginx config + systemd gunicorn
- [ ] Let's Encrypt SSL
- [ ] Backup cron (`pg_dump` + rsync media)
- [ ] Smoke test: login, criar artigo, comentar
- [ ] Cadastrar OAuth Google + Facebook com callback real
- [ ] Implementar django-allauth + wire frontend
