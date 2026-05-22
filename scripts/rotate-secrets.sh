#!/usr/bin/env bash
# scripts/rotate-secrets.sh — rotação de secrets do .env de produção.
#
# STATUS: STUB. NÃO IMPLEMENTADO.
#
# Spec: HOSTING-DEPLOY-PLAN.md §1139.
# Cadência recomendada: trimestral OU sob suspeita de comprometimento.
# Quando implementar:
#  1. Backup do .env atual cifrado com chave-mestra (age / gpg).
#  2. Gerar novos SECRET_KEY (django) + JWT_SIGNING_KEY (50 chars random).
#  3. Rodar AXES_RESET (limpa contadores), invalidate ALL refresh tokens
#     no DB (forçar logout massivo é trade-off conhecido — usuários
#     re-autenticam após rotação, padrão de segurança).
#  4. Atualizar .env (escrita atômica via temp + mv) + chmod 600.
#  5. Restart gunicorn + celery + celery-beat.
#  6. Smoke test: curl /healthz/ + login no admin.
#  7. Confirmar rotação em log JSON dedicado /var/log/interpop/secrets-rotation.log.
set -euo pipefail
echo "[interpop:rotate-secrets] STUB — não implementado." >&2
exit 1
