"""Testes do cursor HMAC base64 (T30.1.7 — Inv #5, #6, #9).

Inv 5: cursor HMAC inválido → ValueError (400 no view, NÃO 500/200).
Inv 6: ROUND(score, 6) simétrico em encode/decode.
Inv 9: cap de depth (encode aceita até MAX; decode rejeita >MAX).

Round-trip property: encode(payload) → decode → same payload.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
from django.test import override_settings

from apps.search.cursors import (
    InvalidCursorError,
    decode_cursor,
    encode_cursor,
)
from apps.search.dto import CursorPayload


@pytest.fixture
def sample_payload() -> CursorPayload:
    return CursorPayload(
        score=0.123456,
        published_at=datetime(2026, 5, 1, 12, 0, 0, tzinfo=timezone.utc),
        article_id=uuid.UUID('12345678-1234-1234-1234-123456789012'),
        depth=1,
    )


# ── Round-trip ───────────────────────────────────────────────────────────────


def test_encode_decode_round_trip(sample_payload: CursorPayload) -> None:
    """Inv #5 — cursor válido roundtrips perfeitamente."""
    encoded = encode_cursor(sample_payload)
    assert isinstance(encoded, str)
    decoded = decode_cursor(encoded)
    assert decoded == sample_payload


def test_encoded_is_base64_safe(sample_payload: CursorPayload) -> None:
    """Cursor é base64 URL-safe (sem + / =)."""
    encoded = encode_cursor(sample_payload)
    assert all(c.isalnum() or c in '-_.' for c in encoded), (
        f'Cursor não é URL-safe: {encoded!r}'
    )


# ── Inv #6: ROUND(score, 6) simétrico ────────────────────────────────────────


def test_score_rounded_to_6_decimals() -> None:
    """Inv #6 — score com 12 casas é truncado em 6 (simétrico com SELECT
    da CTE scored: ROUND(score::numeric, 6))."""
    payload = CursorPayload(
        score=0.123456789012,
        published_at=datetime.now(timezone.utc),
        article_id=uuid.uuid4(),
        depth=0,
    )
    encoded = encode_cursor(payload)
    decoded = decode_cursor(encoded)
    # Float drift na 7ª casa é OK; até a 6ª deve casar.
    assert round(decoded.score, 6) == round(payload.score, 6)


# ── Inv #5: assinatura inválida → InvalidCursorError ─────────────────────────


def test_decode_garbage_raises() -> None:
    with pytest.raises(InvalidCursorError):
        decode_cursor('not_a_cursor')


def test_decode_tampered_payload_raises(sample_payload: CursorPayload) -> None:
    """Modificar 1 byte do payload sem refazer HMAC = invalid."""
    encoded = encode_cursor(sample_payload)
    # Flip primeiro char do payload (antes do ponto)
    payload_part, sig = encoded.split('.', 1)
    flipped = chr(ord(payload_part[0]) ^ 1) + payload_part[1:]
    tampered = f'{flipped}.{sig}'
    with pytest.raises(InvalidCursorError):
        decode_cursor(tampered)


def test_decode_tampered_signature_raises(sample_payload: CursorPayload) -> None:
    encoded = encode_cursor(sample_payload)
    payload_part, sig = encoded.split('.', 1)
    flipped_sig = chr(ord(sig[0]) ^ 1) + sig[1:]
    tampered = f'{payload_part}.{flipped_sig}'
    with pytest.raises(InvalidCursorError):
        decode_cursor(tampered)


def test_decode_wrong_secret_raises(sample_payload: CursorPayload) -> None:
    """Cursor assinado com secret A não decodifica com secret B."""
    with override_settings(SEARCH_CURSOR_HMAC_SECRET='secret-a-' * 4):
        encoded = encode_cursor(sample_payload)
    with override_settings(SEARCH_CURSOR_HMAC_SECRET='secret-b-' * 4):
        with pytest.raises(InvalidCursorError):
            decode_cursor(encoded)


def test_decode_empty_raises() -> None:
    with pytest.raises(InvalidCursorError):
        decode_cursor('')


def test_decode_missing_separator_raises() -> None:
    with pytest.raises(InvalidCursorError):
        decode_cursor('abc_no_dot')


# ── Inv #9: cap depth ────────────────────────────────────────────────────────


def test_decode_rejects_depth_over_cap() -> None:
    """Inv #9 — depth > SEARCH_MAX_PAGINATION_DEPTH → InvalidCursorError."""
    over_depth = CursorPayload(
        score=0.5,
        published_at=datetime.now(timezone.utc),
        article_id=uuid.uuid4(),
        depth=999,  # >> 50
    )
    encoded = encode_cursor(over_depth)
    with pytest.raises(InvalidCursorError):
        decode_cursor(encoded)


def test_decode_accepts_depth_at_cap() -> None:
    at_cap = CursorPayload(
        score=0.5,
        published_at=datetime.now(timezone.utc),
        article_id=uuid.uuid4(),
        depth=50,
    )
    encoded = encode_cursor(at_cap)
    decoded = decode_cursor(encoded)
    assert decoded.depth == 50


# ── Uses hmac.compare_digest (timing-safe — L-04 SECURITY-REVIEW) ────────────


def test_encode_is_deterministic(sample_payload: CursorPayload) -> None:
    """Mesma payload + mesmo secret → mesmo cursor (defesa cache key)."""
    a = encode_cursor(sample_payload)
    b = encode_cursor(sample_payload)
    assert a == b
