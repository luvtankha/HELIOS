import asyncio
import os
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
import httpx

from helios_voice_bench.runtime.gemini_live import GeminiLiveAdapter, GeminiLiveSession, SYSTEM_INSTRUCTION, tool_declaration
from helios_voice_bench.runtime.contracts import RuntimeState


class NativeAudioTests(unittest.IsolatedAsyncioTestCase):
    async def test_logs_a_whole_turn_with_patient_provenance_and_server_completion(self):
        session = GeminiLiveSession("test-key", "test-native-audio-model")
        session.voice_session_id = "voice-1"
        response = SimpleNamespace(status_code=200, json=lambda: {"complete": True, "assigned": True})
        http = AsyncMock()
        http.post.return_value = response
        with patch("helios_voice_bench.runtime.gemini_live.httpx.AsyncClient") as client:
            client.return_value.__aenter__.return_value = http
            result = await session.record_turn("patient-1", "record_turn", {"facts": [{"field": "chiefComplaint", "value": "chest pressure", "state": "KNOWN", "confidence": "HIGH"}]})
        self.assertTrue(result["complete"])
        self.assertTrue(session.completed)
        body = http.post.call_args.kwargs["json"]
        self.assertEqual(body["patientSessionId"], "patient-1")
        self.assertEqual(body["voiceSessionId"], "voice-1")
        self.assertEqual(body["facts"][0]["source"], "PATIENT_REPORTED")
        self.assertTrue(body["facts"][0]["evidenceTurnIds"][0].startswith("turn-"))

    async def test_failed_persistence_cannot_complete_or_claim_logged_data(self):
        session = GeminiLiveSession("test", "test-model")
        http = AsyncMock()
        http.post.return_value = SimpleNamespace(status_code=400)
        with patch("helios_voice_bench.runtime.gemini_live.httpx.AsyncClient") as client:
            client.return_value.__aenter__.return_value = http
            result = await session.record_turn("patient", "record_turn", {})
        self.assertFalse(result["accepted"])
        self.assertFalse(session.completed)

    async def test_server_question_queue_is_bounded(self):
        session = GeminiLiveSession("test", "test-model")
        for i in range(8):
            session.queue_question(str(i), "server question")
        with self.assertRaises(ValueError):
            session.queue_question("overflow", "question")

    async def test_malformed_tool_arguments_do_not_crash_session_or_write(self):
        session = GeminiLiveSession("test", "test-model")
        with patch("helios_voice_bench.runtime.gemini_live.httpx.AsyncClient") as client:
            for args in ([], {"facts": None}, {"facts": ["bad"]}, {"identity": [{}] * 5}):
                result = await session.record_turn("patient", "record_turn", args)
                self.assertFalse(result["accepted"])
            client.assert_not_called()
        self.assertFalse(session.completed)

    async def test_timeout_or_corrupt_server_response_cannot_claim_completion(self):
        session = GeminiLiveSession("test", "test-model")
        http = AsyncMock()
        with patch("helios_voice_bench.runtime.gemini_live.httpx.AsyncClient") as client:
            client.return_value.__aenter__.return_value = http
            http.post.side_effect = httpx.ReadTimeout("synthetic error with sensitive details")
            result = await session.record_turn("patient", "record_turn", {})
            self.assertFalse(result["accepted"])
            self.assertNotIn("sensitive", str(result))
            http.post.side_effect = None
            http.post.return_value = SimpleNamespace(status_code=200, json=lambda: {"complete": "false"})
            result = await session.record_turn("patient", "record_turn", {})
            self.assertFalse(result["accepted"])
            self.assertFalse(session.completed)

    def test_no_credentials_does_not_advertise_live_availability(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": "", "HELIOS_VOICE_CONTROL_SECRET": ""}):
            self.assertEqual(GeminiLiveAdapter().capabilities().state, RuntimeState.UNAVAILABLE)

    def test_sdk_accepts_native_audio_and_structured_tools(self):
        from google.genai import types
        config = types.LiveConnectConfig(response_modalities=["AUDIO"], output_audio_transcription={}, tools=[{"function_declarations": [tool_declaration()]}])
        self.assertEqual(len(config.tools), 1)
        self.assertIn("ALWAYS speak", SYSTEM_INSTRUCTION)


if __name__ == "__main__":
    unittest.main()
