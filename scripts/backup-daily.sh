#!/usr/bin/env bash
# scripts/backup-daily.sh — backup diário do PostgreSQL + media uploads.
#
# STATUS: STUB. NÃO IMPLEMENTADO.
#
# Spec: HOSTING-DEPLOY-PLAN.md (Sprint deploy — quando virar prod).
# Quando implementar:
#  1. pg_dump --format=custom interpop > /var/backups/interpop/db-$(date +%Y%m%d).pgc
#  2. tar czf /var/backups/interpop/media-$(date +%Y%m%d).tgz /var/www/interpop/media/
#  3. Sync para storage externo (Backblaze B2 / R2). Reter 7 dailies + 4 weeklies + 12 monthlies.
#  4. Verificar integridade (pg_restore --list em arquivo aleatório recente).
#  5. Alerta se backup demora > 5min ou falha.
#
# Schedule futura: systemd timer 03:30 BRT (low traffic window).
set -euo pipefail
echo "[interpop:backup-daily] STUB — não implementado." >&2
exit 1
