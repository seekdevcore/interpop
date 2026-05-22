"""
AuditLogMiddleware — asynchronously-safe, non-blocking audit recorder.
Records every state-changing HTTP request after the response is sent.
Never raises: a logging failure must never break a user request.

RequestIDMiddleware — popula contextvars (request_id, user_id) lidos
pelo RequestContextFilter em apps.audit.logging. Stamp UUID curto por
request + header X-Request-ID na response (cliente pode logar em paralelo
e referenciar nas issues).
"""
import logging
import uuid

from .logging import request_id_var, user_id_var
from .models import AuditLog
from .utils import get_client_ip

logger = logging.getLogger(__name__)

_WRITE_METHODS = frozenset({'POST', 'PUT', 'PATCH', 'DELETE'})
_SKIP_PATHS    = frozenset({'/api/v1/auth/refresh/', '/admin/'})


class RequestIDMiddleware:
    """Gera ID único por request, expõe via header de response e contextvars.

    Ordem importa: precisa rodar DEPOIS de AuthenticationMiddleware (pra
    ler request.user) e ANTES de AuditLogMiddleware (pra que AuditLog
    consuma o mesmo request.id).

    Honra `X-Request-ID` recebido se o cliente já gerou um — útil pra
    correlation cross-service (ex.: frontend gera UUID antes da request
    e referencia em Sentry breadcrumbs)."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        rid = (request.headers.get('X-Request-ID') or uuid.uuid4().hex[:16])[:64]
        request.id = rid
        uid = (
            str(request.user.id)
            if hasattr(request, 'user') and request.user.is_authenticated
            else '-'
        )
        token_rid = request_id_var.set(rid)
        token_uid = user_id_var.set(uid)
        try:
            response = self.get_response(request)
        finally:
            request_id_var.reset(token_rid)
            user_id_var.reset(token_uid)
        response['X-Request-ID'] = rid
        return response


class AuditLogMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        if (
            request.method in _WRITE_METHODS
            and not any(request.path.startswith(p) for p in _SKIP_PATHS)
        ):
            self._record(request, response)

        return response

    def _record(self, request, response) -> None:
        try:
            user = request.user if request.user.is_authenticated else None
            AuditLog.objects.create(
                actor=user,
                action=f'{request.method} {request.path}',
                request_path=request.path,
                request_method=request.method,
                response_status=response.status_code,
                ip_address=get_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
            )
        except Exception:
            logger.exception('AuditLog write failed — request processing unaffected.')
