"""Testes dos throttle classes da busca (Task T30.4.1-4 + ADR-036).

Cobertura:
    - SearchAnonThrottle  scope = 'search_anon'
    - SearchUserThrottle  scope = 'search_user'
    - SearchGlobalThrottle scope = 'search_global' (ADR-036 — defesa
      H-03 botnet distribuído)
"""
from __future__ import annotations

from apps.search.throttles import (
    SearchAnonThrottle,
    SearchGlobalThrottle,
    SearchUserThrottle,
)


def test_anon_scope() -> None:
    assert SearchAnonThrottle.scope == 'search_anon'


def test_user_scope() -> None:
    assert SearchUserThrottle.scope == 'search_user'


def test_global_scope() -> None:
    """ADR-036 — throttle global do endpoint para mitigar botnet."""
    assert SearchGlobalThrottle.scope == 'search_global'


def test_anon_inherits_anon_throttle() -> None:
    """Anon usa IP como key (SimpleRateThrottle default via AnonRateThrottle)."""
    from rest_framework.throttling import AnonRateThrottle
    assert issubclass(SearchAnonThrottle, AnonRateThrottle)


def test_user_inherits_user_throttle() -> None:
    """User usa request.user.pk como key."""
    from rest_framework.throttling import UserRateThrottle
    assert issubclass(SearchUserThrottle, UserRateThrottle)


def test_global_uses_static_key() -> None:
    """SearchGlobalThrottle usa key constante — todos os requests do
    endpoint compartilham o mesmo bucket (defesa H-03)."""
    from rest_framework.test import APIRequestFactory

    throttle = SearchGlobalThrottle()
    factory = APIRequestFactory()
    req = factory.get('/api/v1/search/articles/?q=kpop')
    # Key estática (não depende de IP/user) — defesa contra botnet.
    ident_a = throttle.get_ident(req)
    ident_b = throttle.get_ident(req)
    assert ident_a == ident_b
    # Não usa IP: forçar IPs diferentes deve produzir mesma cache key
    req.META['REMOTE_ADDR'] = '1.2.3.4'
    cache_key_1 = throttle.get_cache_key(req, view=None)
    req.META['REMOTE_ADDR'] = '5.6.7.8'
    cache_key_2 = throttle.get_cache_key(req, view=None)
    assert cache_key_1 == cache_key_2, (
        'SearchGlobalThrottle deve compartilhar bucket entre IPs diferentes — '
        'caso contrário é só mais um throttle por IP (sem defesa botnet).'
    )
