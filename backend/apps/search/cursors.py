"""Cursor HMAC para paginação keyset (Inv #5, #6, #9 algorithms).

Por que HMAC e não JWT/Fernet:

    - Cursor não tem PII; só estado (score, published_at, article_id, depth).
    - HMAC SHA256 é mais simples, sem expiração necessária no MVP
      (rotação de secret invalida tudo automaticamente — aceito).
    - ``hmac.compare_digest`` (timing-safe) evita oracle por tempo de
      comparação (L-04 do SECURITY-REVIEW).

Formato wire::

    <base64url(json_payload)>.<base64url(hmac_sha256(secret, payload_b64))>

JSON payload schema::

    {
        "s": <float>,            # score com ROUND(6) já aplicado
        "p": "2026-05-01T12:00:00+00:00",
        "i": "<uuid>",
        "d": <int>               # depth (cap 50 — Inv #9)
    }

Decisões:
    - Inv #5: assinatura inválida → :exc:`InvalidCursorError` (view traduz para 400)
    - Inv #6: score arredondado em 6 casas (simétrico com SELECT da CTE)
    - Inv #9: ``depth`` validado no decode (rejeita > settings.SEARCH_MAX_PAGINATION_DEPTH)

Rotação de chave: mudar ``SEARCH_CURSOR_HMAC_SECRET`` em settings → todos os
cursores antigos viram inválidos. Trade-off documentado em ADR-021.
"""
from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import uuid
from datetime import datetime

from django.conf import settings

from .dto import CursorPayload


class InvalidCursorError(ValueError):
    """Cursor inválido — assinatura, formato, depth ou payload corrompido.

    O view captura e devolve 400 com ``error='cursor_invalid'`` (Inv #5).
    """


def _b64encode(data: bytes) -> str:
    """Base64 URL-safe sem padding (curto, URL-friendly)."""
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('ascii')


def _b64decode(data: str) -> bytes:
    """Decode URL-safe sem padding (adiciona padding antes de decodar)."""
    # base64.urlsafe_b64decode exige len % 4 == 0; padding com '='
    padded = data + ('=' * (-len(data) % 4))
    return base64.urlsafe_b64decode(padded.encode('ascii'))


def _sign(payload_b64: str) -> str:
    secret = settings.SEARCH_CURSOR_HMAC_SECRET.encode('utf-8')
    mac = hmac.new(secret, payload_b64.encode('ascii'), hashlib.sha256).digest()
    return _b64encode(mac)


def encode_cursor(payload: CursorPayload) -> str:
    """Serializa :class:`CursorPayload` em string ``<b64>.<sig>``.

    Score é ROUND(6) (Inv #6 simétrico com a CTE). Datetime em ISO8601.
    UUID em str. Depth em int.
    """
    body = {
        's': round(payload.score, 6),
        'p': payload.published_at.isoformat(),
        'i': str(payload.article_id),
        'd': payload.depth,
    }
    # json.dumps com sort_keys → cursor determinístico.
    payload_json = json.dumps(body, sort_keys=True, separators=(',', ':'))
    payload_b64 = _b64encode(payload_json.encode('utf-8'))
    sig = _sign(payload_b64)
    return f'{payload_b64}.{sig}'


def decode_cursor(cursor: str) -> CursorPayload:
    """Verifica HMAC, valida depth, retorna :class:`CursorPayload`.

    Raises:
        InvalidCursorError: qualquer falha (vazio, formato, base64 inválido,
            HMAC mismatch, depth > cap, JSON malformado). View traduz para
            400 ``cursor_invalid``.
    """
    if not cursor or '.' not in cursor:
        raise InvalidCursorError('cursor vazio ou sem separador')
    try:
        payload_b64, sig_b64 = cursor.split('.', 1)
    except ValueError as exc:
        raise InvalidCursorError('formato inválido') from exc

    # HMAC check (timing-safe — L-04 SECURITY-REVIEW)
    expected_sig = _sign(payload_b64)
    if not hmac.compare_digest(expected_sig, sig_b64):
        raise InvalidCursorError('assinatura HMAC inválida')

    # Decode + parse JSON
    try:
        raw = _b64decode(payload_b64)
        body = json.loads(raw.decode('utf-8'))
    except (binascii.Error, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise InvalidCursorError('payload corrompido') from exc

    # Validação de schema mínima
    try:
        score = float(body['s'])
        published_at = datetime.fromisoformat(body['p'])
        article_id = uuid.UUID(body['i'])
        depth = int(body['d'])
    except (KeyError, TypeError, ValueError) as exc:
        raise InvalidCursorError(f'schema inválido: {exc}') from exc

    # Inv #9 — cap de paginação profunda
    max_depth = settings.SEARCH_MAX_PAGINATION_DEPTH
    if depth < 0 or depth > max_depth:
        raise InvalidCursorError(
            f'depth {depth} fora do range [0..{max_depth}] — refine a busca'
        )

    return CursorPayload(
        score=score,
        published_at=published_at,
        article_id=article_id,
        depth=depth,
    )
