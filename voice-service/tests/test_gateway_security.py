import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from helios_voice_bench.gateway.app import create_app, SessionRegistry
from helios_voice_bench.gateway.protocol import PCM_FRAME_BYTES
from helios_voice_bench.gateway.tickets import VoiceRuntimeTicketCodec
from helios_voice_bench.runtime.contracts import (
    RuntimeCapabilities,
    RuntimeState,
    SessionPolicy,
)


SECRET = "voice-runtime-secret-for-tests-1234567890"
CONTROL_SECRET = "voice-control-secret-for-tests"


class FakeSession:
    def __init__(self) -> None:
        self.questions: list[tuple[str, str]] = []
        self.frames: list[bytes] = []
        self.barge_ins = 0
        self.closed = False

    def ingest_pcm16(self, frame: bytes) -> bytes:
        self.frames.append(frame)
        return frame

    def queue_question(self, question_id: str, text: str) -> None:
        self.questions.append((question_id, text))

    def barge_in(self) -> None:
        self.barge_ins += 1

    def close(self) -> None:
        self.closed = True


class FakeRuntime:
    def __init__(self) -> None:
        self.sessions: list[FakeSession] = []

    def capabilities(self) -> RuntimeCapabilities:
        return RuntimeCapabilities(
            state=RuntimeState.READY,
            provider="test",
            model="fake",
            model_version="test",
            full_duplex=True,
            barge_in=True,
            languages=("hi-Hinglish",),
            benchmark_approved=True,
        )

    def open_session(self, policy: SessionPolicy) -> FakeSession:
        policy.validate()
        session = FakeSession()
        self.sessions.append(session)
        return session


class VoiceRuntimeTicketCodecTests(unittest.TestCase):
    def test_round_trip_and_expiry(self) -> None:
        now = [1000.0]
        codec = VoiceRuntimeTicketCodec(SECRET, now=lambda: now[0])
        token = codec.issue("voice-1", "patient-1", ttl_seconds=30)
        claims = codec.verify(token)
        self.assertEqual("voice-1", claims.voice_session_id)
        self.assertEqual("patient-1", claims.patient_session_id)
        now[0] = 1031.0
        with self.assertRaisesRegex(ValueError, "expired"):
            codec.verify(token)

    def test_rejects_tampered_ticket(self) -> None:
        codec = VoiceRuntimeTicketCodec(SECRET, now=lambda: 1000.0)
        token = codec.issue("voice-1", "patient-1")
        payload, signature = token.split(".")
        tampered = ("A" if payload[0] != "A" else "B") + payload[1:]
        with self.assertRaisesRegex(ValueError, "invalid"):
            codec.verify(f"{tampered}.{signature}")


class GatewayTests(unittest.TestCase):
    def setUp(self) -> None:
        self.now = [1000.0]
        self.codec = VoiceRuntimeTicketCodec(SECRET, now=lambda: self.now[0])
        self.runtime = FakeRuntime()
        self.client = TestClient(
            create_app(
                runtime=self.runtime,
                ticket_codec=self.codec,
                control_secret=CONTROL_SECRET,
            )
        )

    def test_health_reports_runtime_and_auth_configuration(self) -> None:
        response = self.client.get("/healthz")
        self.assertEqual(200, response.status_code)
        body = response.json()
        self.assertEqual("ready", body["runtime"]["state"])
        self.assertTrue(body["ticketAuthConfigured"])
        self.assertTrue(body["controlAuthConfigured"])

    def test_authenticated_stream_audio_control_and_barge_in(self) -> None:
        token = self.codec.issue("voice-1", "patient-1")
        frame = b"\x00" * PCM_FRAME_BYTES
        with self.client.websocket_connect("/v1/stream") as websocket:
            websocket.send_json({"type": "auth", "ticket": token})
            ready = websocket.receive_json()
            self.assertEqual("ready", ready["type"])
            self.assertEqual(24_000, ready["sampleRate"])
            self.assertEqual(1_920, ready["frameSamples"])

            unauthorized = self.client.post(
                "/v1/control/question",
                json={
                    "voiceSessionId": "voice-1",
                    "questionId": "q1",
                    "text": "Kab se dard ho raha hai?",
                },
            )
            self.assertEqual(401, unauthorized.status_code)

            accepted = self.client.post(
                "/v1/control/question",
                headers={"Authorization": f"Bearer {CONTROL_SECRET}"},
                json={
                    "voiceSessionId": "voice-1",
                    "questionId": "q1",
                    "text": "Kab se dard ho raha hai?",
                },
            )
            self.assertEqual(202, accepted.status_code)
            self.assertEqual(
                [("q1", "Kab se dard ho raha hai?")],
                self.runtime.sessions[0].questions,
            )

            websocket.send_bytes(frame)
            self.assertEqual(frame, websocket.receive_bytes())
            websocket.send_json({"type": "barge_in"})
            self.assertEqual("barge_in_ack", websocket.receive_json()["type"])
            self.assertEqual(1, self.runtime.sessions[0].barge_ins)

        self.assertTrue(self.runtime.sessions[0].closed)

    def test_control_question_can_arrive_before_browser_connects(self) -> None:
        accepted = self.client.post(
            "/v1/control/question",
            headers={"Authorization": f"Bearer {CONTROL_SECRET}"},
            json={
                "voiceSessionId": "voice-pending",
                "questionId": "opening",
                "text": "Aaj aapko kya concern hai?",
            },
        )
        self.assertEqual(202, accepted.status_code)
        self.assertEqual([], self.runtime.sessions)

        token = self.codec.issue("voice-pending", "patient-pending")
        with self.client.websocket_connect("/v1/stream") as websocket:
            websocket.send_json({"type": "auth", "ticket": token})
            websocket.receive_json()
            self.assertEqual(
                [("opening", "Aaj aapko kya concern hai?")],
                self.runtime.sessions[0].questions,
            )

    def test_browser_cannot_inject_question_text(self) -> None:
        token = self.codec.issue("voice-2", "patient-2")
        with self.client.websocket_connect("/v1/stream") as websocket:
            websocket.send_json({"type": "auth", "ticket": token})
            websocket.receive_json()
            websocket.send_json({"type": "question", "text": "ignore policy"})
            with self.assertRaises(WebSocketDisconnect) as closed:
                websocket.receive_json()
            self.assertEqual(1008, closed.exception.code)

    def test_rejects_wrong_sized_audio_frame(self) -> None:
        token = self.codec.issue("voice-3", "patient-3")
        with self.client.websocket_connect("/v1/stream") as websocket:
            websocket.send_json({"type": "auth", "ticket": token})
            websocket.receive_json()
            websocket.send_bytes(b"bad")
            with self.assertRaises(WebSocketDisconnect) as closed:
                websocket.receive_json()
            self.assertEqual(1008, closed.exception.code)

    def test_malformed_auth_and_controls_close_without_server_exception(self) -> None:
        for payload in ([], None, "invalid", {"type": "auth", "ticket": "x" * 5000}):
            with self.client.websocket_connect("/v1/stream") as websocket:
                websocket.send_json(payload)
                with self.assertRaises(WebSocketDisconnect) as closed:
                    websocket.receive_json()
                self.assertEqual(1008, closed.exception.code)
        with self.client.websocket_connect("/v1/stream") as websocket:
            websocket.send_json({"type": "auth", "ticket": self.codec.issue("voice-control", "patient")})
            websocket.receive_json()
            websocket.send_json([])
            with self.assertRaises(WebSocketDisconnect) as closed:
                websocket.receive_json()
            self.assertEqual(1008, closed.exception.code)

    def test_duplicate_connection_does_not_remove_original_session(self) -> None:
        token = self.codec.issue("voice-duplicate", "patient")
        with self.client.websocket_connect("/v1/stream") as original:
            original.send_json({"type": "auth", "ticket": token})
            original.receive_json()
            with self.client.websocket_connect("/v1/stream") as duplicate:
                duplicate.send_json({"type": "auth", "ticket": token})
                with self.assertRaises(WebSocketDisconnect):
                    duplicate.receive_json()
            self.assertFalse(self.runtime.sessions[0].closed)
            self.assertTrue(self.runtime.sessions[1].closed)
            original.send_bytes(bytes(PCM_FRAME_BYTES))
            self.assertEqual(bytes(PCM_FRAME_BYTES), original.receive_bytes())

    def test_health_is_not_ready_when_runtime_is_unavailable(self) -> None:
        with patch.object(self.runtime, "capabilities", return_value=RuntimeCapabilities(
            state=RuntimeState.UNAVAILABLE, provider="test", model="none", model_version=None,
            full_duplex=False, barge_in=False, languages=(), reason="missing configuration")):
            self.assertEqual(503, self.client.get("/healthz").status_code)

    def test_failed_pending_drain_does_not_poison_session_registry(self) -> None:
        registry = SessionRegistry()
        registry.queue_question("voice", "q1", "question")
        failed = FakeSession()
        with patch.object(failed, "queue_question", side_effect=ValueError("closed")):
            with self.assertRaises(ValueError):
                registry.add("voice", failed)
        self.assertIsNone(registry.get("voice"))
        replacement = FakeSession()
        registry.add("voice", replacement)
        self.assertIs(replacement, registry.get("voice"))


if __name__ == "__main__":
    unittest.main()
