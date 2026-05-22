"""
Helpers compartilhados do app audit.

Por que `audit/utils.py` e não `apps/users/utils.py` ou módulo standalone:
audit é o app que naturalmente "vê" toda request (RequestIDMiddleware,
AuditLogMiddleware) — extrair IP a partir do request é uma operação
de telemetria, não de domínio.
"""
from __future__ import annotations


def get_client_ip(request) -> str | None:
    """Extrai IP do cliente respeitando X-Forwarded-For do reverse proxy.

    Em prod o stack é Cloudflare → nginx → gunicorn. Cloudflare popula
    CF-Connecting-IP mas o nginx já agrega isso em X-Forwarded-For, então
    o primeiro elemento do header é o IP real do cliente. Sem proxy
    (dev local), REMOTE_ADDR é o IP direto.

    Retorna None se nenhum dos dois estiver presente — caller decide
    default (ex: bucket key de cache pode usar '0.0.0.0' como bucket
    "ip desconhecido").

    C13 do reorganization-proposal: consolida lógica antes duplicada em
    apps/articles/views.py::_client_ip + apps/audit/middleware.py::_get_ip.
    """
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')
