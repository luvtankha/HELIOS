from __future__ import annotations

import asyncio
import hmac
import json
import os
import time
from dataclasses import asdict
from threading import Lock
from typing import Any

from fastapi import FastAPI, Header, HTTPException, Response, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from starlette.websockets import WebSocketState

from helios_voice_bench.gateway.protocol import AudioProtocol
from helios_voice_bench.gateway.tickets import VoiceRuntimeTicketCodec
from helios_voice_bench.runtime.contracts import RuntimeState, SessionPolicy
from helios_voice_bench.runtime.human1 import Human1Adapter
from helios_voice_bench.runtime.gemini_live import GeminiLiveAdapter
from helios_voice_bench.runtime.streaming import StreamingVoiceRuntime, StreamingVoiceSession


class QuestionRequest(BaseModel):
    voiceSessionId: str = Field(min_length=1, max_length=128)
    questionId: str = Field(min_length=1, max_length=128)
    text: str = Field(min_length=1, max_length=1200)


class SessionRegistry:
    def __init__(self) -> None:
        self._sessions: dict[str, StreamingVoiceSession] = {}
        self._pending_questions: dict[str, list[tuple[float, str, str]]] = {}
        self._lock = Lock()

    def add(self, voice_session_id: str, session: StreamingVoiceSession) -> None:
        with self._lock:
            if voice_session_id in self._sessions:
                raise ValueError("voice session is already connected")
            self._purge_pending_locked(time.monotonic())
            self._sessions[voice_session_id] = session
            pending = self._pending_questions.pop(voice_session_id, [])
        try:
            for _, question_id, text in pending:
                session.queue_question(question_id, text)
        except Exception:
            # A failed drain must not leave an unusable registration that blocks reconnect.
            with self._lock:
                if self._sessions.get(voice_session_id) is session:
                    self._sessions.pop(voice_session_id)
            raise

    def get(self, voice_session_id: str) -> StreamingVoiceSession | None:
        with self._lock:
            return self._sessions.get(voice_session_id)

    def remove(self, voice_session_id: str) -> StreamingVoiceSession | None:
        with self._lock:
            return self._sessions.pop(voice_session_id, None)

    def queue_question(self, voice_session_id: str, question_id: str, text: str) -> None:
        now = time.monotonic()
        with self._lock:
            session = self._sessions.get(voice_session_id)
            if session is not None:
                pending = None
            else:
                self._purge_pending_locked(now)
                if sum(len(items) for items in self._pending_questions.values()) >= 128:
                    raise ValueError("voice question queue is full")
                queue = self._pending_questions.setdefault(voice_session_id, [])
                if len(queue) >= 8:
                    raise ValueError("voice session question queue is full")
                queue.append((now, question_id, text))
                pending = queue
        if session is not None:
            session.queue_question(question_id, text)

    def _purge_pending_locked(self, now: float) -> None:
        expired_sessions: list[str] = []
        for voice_session_id, items in self._pending_questions.items():
            retained = [item for item in items if now - item[0] <= 90]
            if retained:
                self._pending_questions[voice_session_id] = retained
            else:
                expired_sessions.append(voice_session_id)
        for voice_session_id in expired_sessions:
            self._pending_questions.pop(voice_session_id, None)


def create_app(
    *,
    runtime: StreamingVoiceRuntime | None = None,
    ticket_codec: VoiceRuntimeTicketCodec | None = None,
    control_secret: str | None = None,
) -> FastAPI:
    provider = os.environ.get("HELIOS_VOICE_PROVIDER", "gemini-live")
    if runtime is None and provider not in ("gemini-live", "human1", "human-1"):
        raise ValueError("Unsupported HELIOS_VOICE_PROVIDER")
    selected_runtime = runtime or (GeminiLiveAdapter() if provider == "gemini-live" else Human1Adapter())
    selected_ticket_codec = ticket_codec or _codec_from_env()
    selected_control_secret = control_secret or os.environ.get(
        "HELIOS_VOICE_CONTROL_SECRET"
    )
    protocol = AudioProtocol()
    registry = SessionRegistry()
    app = FastAPI(title="HELIOS Voice Gateway", version="0.2.0")

    @app.get("/healthz")
    def health(response: Response) -> dict[str, Any]:
        capabilities = selected_runtime.capabilities()  # type: ignore[attr-defined]
        ready = capabilities.state == RuntimeState.READY and selected_ticket_codec is not None and bool(selected_control_secret)
        if not ready:
            response.status_code = 503
        return {
            "status": "ok" if ready else "unavailable",
            "runtime": asdict(capabilities),
            "ticketAuthConfigured": selected_ticket_codec is not None,
            "controlAuthConfigured": bool(selected_control_secret),
        }

    @app.get("/v1/capabilities")
    def capabilities() -> dict[str, Any]:
        return asdict(selected_runtime.capabilities())  # type: ignore[attr-defined]

    @app.post("/v1/control/question", status_code=202)
    def queue_question(
        request: QuestionRequest,
        authorization: str | None = Header(default=None),
    ) -> dict[str, str]:
        _require_control_secret(authorization, selected_control_secret)
        try:
            registry.queue_question(request.voiceSessionId, request.questionId, request.text)
        except ValueError as exc:
            raise HTTPException(status_code=429, detail=str(exc)) from exc
        return {"status": "queued"}

    @app.websocket("/v1/stream")
    async def stream(websocket: WebSocket) -> None:
        await websocket.accept()
        voice_session_id: str | None = None
        session: StreamingVoiceSession | None = None
        owns_registration = False
        try:
            if selected_ticket_codec is None:
                await websocket.close(
                    code=1011, reason="voice ticket auth is not configured"
                )
                return
            auth_message = await asyncio.wait_for(
                websocket.receive_text(), timeout=5
            )
            claims = _decode_auth(auth_message, selected_ticket_codec)
            voice_session_id = claims.voice_session_id
            policy = SessionPolicy(
                session_id=claims.voice_session_id,
                language_mode="hi-Hinglish",
            )
            policy.validate()
            session = selected_runtime.open_session(policy)
            registry.add(voice_session_id, session)
            owns_registration = True
            if hasattr(session, "run"):
                await session.run(websocket, claims, protocol)
                if websocket.client_state == WebSocketState.CONNECTED and websocket.application_state == WebSocketState.CONNECTED:
                    await websocket.close(code=1000)
                return
            await websocket.send_json(
                {
                    "type": "ready",
                    "voiceSessionId": voice_session_id,
                    "sampleRate": protocol.sample_rate_hz,
                    "frameSamples": protocol.frame_samples,
                    "frameBytes": protocol.frame_bytes,
                    "encoding": protocol.encoding,
                }
            )
            while True:
                message = await websocket.receive()
                if message.get("type") == "websocket.disconnect":
                    break
                frame = message.get("bytes")
                if frame is not None:
                    protocol.validate_frame(frame)
                    outbound = session.ingest_pcm16(frame)
                    if outbound is not None:
                        protocol.validate_frame(outbound)
                        await websocket.send_bytes(outbound)
                    continue
                text_message = message.get("text")
                if text_message is None:
                    continue
                control = _decode_control(text_message)
                event_type = control.get("type")
                if event_type == "barge_in":
                    session.barge_in()
                    await websocket.send_json({"type": "barge_in_ack"})
                elif event_type == "ping":
                    await websocket.send_json({"type": "pong"})
                else:
                    await websocket.close(
                        code=1008, reason="unsupported client control"
                    )
                    return
        except (ValueError, TypeError):
            await websocket.close(code=1008, reason="invalid voice request")
        except TimeoutError:
            await websocket.close(code=1008, reason="authentication timeout")
        except WebSocketDisconnect:
            pass
        except Exception:
            await websocket.close(code=1011, reason="live voice provider is unavailable")
        finally:
            if voice_session_id is not None and owns_registration:
                registered = registry.remove(voice_session_id)
                if registered is not None:
                    registered.close()
            elif session is not None:
                session.close()

    return app


def _codec_from_env() -> VoiceRuntimeTicketCodec | None:
    secret = os.environ.get("HELIOS_VOICE_RUNTIME_SECRET")
    if not secret:
        return None
    return VoiceRuntimeTicketCodec(secret)


def _decode_auth(message: str, codec: VoiceRuntimeTicketCodec):
    payload = _decode_control(message, max_length=4096)
    if payload.get("type") != "auth" or not isinstance(payload.get("ticket"), str):
        raise ValueError(
            "first websocket message must contain a voice runtime ticket"
        )
    return codec.verify(payload["ticket"])


def _decode_control(message: str, *, max_length: int = 4096) -> dict[str, Any]:
    if len(message) > max_length:
        raise ValueError("voice control message too large")
    payload = json.loads(message)
    if not isinstance(payload, dict):
        raise ValueError("voice control must be an object")
    return payload


def _require_control_secret(authorization: str | None, secret: str | None) -> None:
    if not secret:
        raise HTTPException(
            status_code=503, detail="voice control plane is not configured"
        )
    if not hmac.compare_digest((authorization or "").encode(), f"Bearer {secret}".encode()):
        raise HTTPException(status_code=401, detail="invalid voice control credentials")
