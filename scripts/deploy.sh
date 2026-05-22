#!/usr/bin/env bash
# scripts/deploy.sh — pós-deploy automatizado (rollback se falha).
#
# STATUS: STUB. NÃO IMPLEMENTADO.
#
# Spec original: HOSTING-DEPLOY-PLAN.md §A.2 + §X.X.
# Quando implementar:
#  1. Pull latest no VPS (git pull --ff-only origin main).
#  2. uv sync --frozen + python manage.py migrate + collectstatic.
#  3. systemctl restart interpop-gunicorn + celery + celery-beat.
#  4. Curl /healthz/ com retries (3 × 5s). Se falha → rollback git +
#     restart serviços + alerta via Sentry release.
#  5. Tag git release com GIT_SHA atual + log JSON pra Loki.
#
# Setado como `exit 1` para detectar invocações acidentais. O dia que
# este script for implementado de fato: REMOVER esta header inteira +
# atualizar testing-standards.md:181.
set -euo pipefail
echo "[interpop:deploy] STUB — não implementado. Ver HOSTING-DEPLOY-PLAN.md §A.2." >&2
exit 1
