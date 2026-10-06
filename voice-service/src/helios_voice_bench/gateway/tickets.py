from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from typing import Callable


def _b64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


@dataclass(frozen=True)
class VoiceRuntimeClaims:
    voice_session_id: str
    patient_session_id: str
    issued_at: int
    expires_at: int


class VoiceRuntimeTicketCodec:
    """HMAC tickets shared by Spring and the Python gateway."""

    def __init__(
        self,
        secret: str,
        *,
        max_ttl_seconds: int = 90,
        now: Callable[[], float] = time.time,
    ) -> None:
        if len(secret.encode("utf-8")) < 32:
            raise ValueError("voice runtime secret must be at least 32 bytes")
        if max_ttl_seconds <= 0:
            raise ValueError("max_ttl_seconds must be positive")
        self._secret = secret.encode("utf-8")
        self._max_ttl_seconds = max_ttl_seconds
        self._now = now

    def issue(
        self,
        voice_session_id: str,
        patient_session_id: str,
        *,
        ttl_seconds: int = 45,
    ) -> str:
        if not voice_session_id or not patient_session_id:
            raise ValueError("voice and patient session ids are required")
        if ttl_seconds <= 0 or ttl_seconds > self._max_ttl_seconds:
            raise ValueError("ticket ttl exceeds the configured maximum")
        issued_at = int(self._now())
        payload = {
            "voiceSessionId": voice_session_id,
            "patientSessionId": patient_session_id,
            "iat": issued_at,
            "exp": issued_at + ttl_seconds,
        }
        payload_segment = _b64url_encode(
            json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
        )
        signature = hmac.new(
            self._secret, payload_segment.encode("ascii"), hashlib.sha256
        ).digest()
        return f"{payload_segment}.{_b64url_encode(signature)}"

    def verify(self, token: str) -> VoiceRuntimeClaims:
        if not isinstance(token, str) or len(token) > 4096 or not token.isascii():
            raise ValueError("invalid voice runtime ticket")
        parts = token.split(".")
        if len(parts) != 2:
            raise ValueError("invalid voice runtime ticket")
        payload_segment, signature_segment = parts
        expected = hmac.new(
            self._secret, payload_segment.encode("ascii"), hashlib.sha256
        ).digest()
        try:
            provided = _b64url_decode(signature_segment)
        except Exception as exc:
            raise ValueError("invalid voice runtime ticket") from exc
        if not hmac.compare_digest(expected, provided):
            raise ValueError("invalid voice runtime ticket")
        try:
            payload = json.loads(_b64url_decode(payload_segment))
            voice_session_id = payload["voiceSessionId"]
            patient_session_id = payload["patientSessionId"]
            issued_at = payload["iat"]
            expires_at = payload["exp"]
            if (not isinstance(voice_session_id, str) or not isinstance(patient_session_id, str)
                    or not 0 < len(voice_session_id) <= 128 or not 0 < len(patient_session_id) <= 128
                    or type(issued_at) is not int or type(expires_at) is not int):
                raise ValueError("invalid claims")
        except Exception as exc:
            raise ValueError("invalid voice runtime ticket") from exc
        now = int(self._now())
        if expires_at <= now:
            raise ValueError("voice runtime ticket expired")
        if issued_at > now + 5:
            raise ValueError("voice runtime ticket issued in the future")
        if expires_at <= issued_at or expires_at - issued_at > self._max_ttl_seconds:
            raise ValueError("voice runtime ticket ttl is invalid")
        if not voice_session_id or not patient_session_id:
            raise ValueError("voice runtime ticket is incomplete")
        return VoiceRuntimeClaims(
            voice_session_id=voice_session_id,
            patient_session_id=patient_session_id,
            issued_at=issued_at,
            expires_at=expires_at,
        )
