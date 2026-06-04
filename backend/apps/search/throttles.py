"""DRF throttles para o endpoint ``/api/v1/search/articles/``.

Stack em camadas (ADR-024 + ADR-036):

    1. :class:`SearchAnonThrottle`   — 30/min por IP (anônimo)
    2. :class:`SearchUserThrottle`   — 60/min por user_id (autenticado)
    3. :class:`SearchGlobalThrottle` — 500/min para o endpoint inteiro
       (key estática), defesa H-03 contra botnet distribuído onde cada IP
       fica abaixo de 30/min mas o agregado satura o backend.

Rate values vêm de ``REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']``
configurado em ``config/settings/base.py``. Dev relaxa em
``development.py`` para evitar 429 em smoke manual.
"""
from __future__ import annotations

from rest_framework.throttling import (
    AnonRateThrottle,
    SimpleRateThrottle,
    UserRateThrottle,
)


class SearchAnonThrottle(AnonRateThrottle):
    """Throttle por IP para usuários anônimos (30/min).

    Reusa :class:`AnonRateThrottle` que já extrai IP via
    ``get_client_ip`` (respeita X-Forwarded-For). DRF cuida do bucket por
    IP — só sobrescrevemos o scope para ler o rate certo.
    """

    scope = 'search_anon'


class SearchUserThrottle(UserRateThrottle):
    """Throttle por user.pk para usuários autenticados (60/min).

    ``UserRateThrottle`` usa ``request.user.pk`` como key — adequado para
    usuários autenticados (independente de IP).
    """

    scope = 'search_user'


class SearchGlobalThrottle(SimpleRateThrottle):
    """Throttle GLOBAL do endpoint (500/min compartilhado).

    ADR-036 — defesa contra DoS distribuído (vetor H-03 do
    SECURITY-REVIEW): 1000 IPs × 1 req/min = 1000 req/min agregado, cada
    IP abaixo de 30/min → ``SearchAnonThrottle`` não trigga, mas o
    backend satura.

    Esta throttle usa key estática (todos os requests compartilham o
    mesmo bucket). Quando o bucket estoura, o endpoint inteiro retorna
    429 com ``Retry-After`` calculado pelo DRF.

    Trade-off: usuários legítimos podem ver 429 em incidente. Aceitável
    — alternativa é degradação cascateada que afeta TODOS os endpoints
    (não só busca).
    """

    scope = 'search_global'

    def get_cache_key(self, request, view):
        # Key estática: todos os requests compartilham o mesmo bucket.
        # Não inclui IP, user, query — defesa botnet em vez de defesa
        # individual.
        return self.cache_format % {
            'scope': self.scope,
            'ident': 'global',
        }
