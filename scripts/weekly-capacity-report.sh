#!/usr/bin/env bash
# scripts/weekly-capacity-report.sh — coleta métricas operacionais semanais.
#
# STATUS: STUB. NÃO IMPLEMENTADO.
#
# Spec: HOSTING-DEPLOY-PLAN.md §1163.
# Quando implementar:
#  1. Coletar (sobre os últimos 7 dias):
#     - CPU/mem/disco médio/p95 (via vmstat + sar history).
#     - DB size + 10 maiores tabelas.
#     - Top 10 queries lentas (pg_stat_statements).
#     - Article CRUD/s, login/s, page views/s.
#     - Cobertura de testes atual.
#     - DORA: deploy frequency, lead time, MTTR, change failure rate.
#  2. Renderizar em Markdown único.
#  3. POST para canal Slack ops OU email ao Gabriel.
#
# Schedule futura: systemd timer domingo 09:00 BRT.
set -euo pipefail
echo "[interpop:weekly-capacity-report] STUB — não implementado." >&2
exit 1
