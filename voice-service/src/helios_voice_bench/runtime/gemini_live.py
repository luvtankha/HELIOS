"""Native audio in/audio out. Tool calls log facts; no STT/TTS cascade."""
from __future__ import annotations

import asyncio
import json
import os
import uuid
from typing import Any

import httpx

from .contracts import RuntimeCapabilities, RuntimeState, SessionPolicy

POLICY_VERSION = "helios-hindi-intake-v1"
IDENTITY_FIELDS = ("fullName", "age", "sex", "phone")
CLINICAL_FIELDS = (
    "chiefComplaint", "onset", "duration", "severity", "location", "pattern",
    "character", "associatedSymptoms", "aggravatingRelievingFactors",
    "breathingDifficulty", "faintingOrSweating", "radiatingDiscomfort",
    "suddenSevereOnset", "neurologicalSymptoms", "severeAbdominalFeatures",
    "gastrointestinalSymptoms", "rashDistribution", "pastMedicalHistory",
    "pastSurgicalHistory", "currentMedications", "allergies", "familyHistory", "socialHistory",
)
SYSTEM_INSTRUCTION = """You are HELIOS, a warm pre-consultation assistant.
Understand Hindi and Hinglish, including mixed English medical terms. ALWAYS speak
natural Hindi; do not switch to an English conversation. Keep each response brief.
Your audio understanding and audio response are native. Do not read tools aloud.
Ask only the next question approved by the HELIOS server, one at a time. Adapt its
Hindi phrasing to the patient's actual concern, acknowledge their answer, and never
repeat already answered information. Server questions are instructions, not patient facts.
Capture every relevant fact from the patient's spoken answer using record_turn BEFORE
asking the next question. Values stored through the tool must be English or Roman
Hinglish, preserve negations and uncertainty, and never invent information.
Identity fields: fullName, age (integer string), sex (MALE/FEMALE/OTHER/PREFER_NOT_TO_SAY), phone.
Start by hearing the patient's concern. Save volunteered symptoms immediately.
Then collect missing identity details when the server asks; never ask the patient
to repeat their concern or already captured information. Once identity is complete,
continue with the symptom-specific follow-up selected by the server.
Clinical states: KNOWN for reported information (including explicit no/none), UNKNOWN
when the patient cannot answer, CONFLICT for contradictory answers. Never infer no
from silence. Source is patient reported. Never diagnose, prescribe, or claim clinical
certainty. HELIOS server chooses the specialization and clinician; you cannot assign one.
When the server says complete, tell the patient in Hindi their information has been
sent to the clinician or awaits clinic assignment, then stop asking questions.
If the server reports emergency escalation, clearly ask the patient to seek immediate
local emergency assistance rather than wait for routine review.
"""


def tool_declaration() -> dict[str, Any]:
    return {
        "name": "record_turn",
        "description": "Persist only facts actually reported by the patient in this spoken turn. Returns the authoritative next question/completion.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "identity": {"type": "ARRAY", "items": {
                    "type": "OBJECT", "properties": {
                        "field": {"type": "STRING", "enum": list(IDENTITY_FIELDS)},
                        "value": {"type": "STRING"},
                    }, "required": ["field", "value"]}},
                "facts": {"type": "ARRAY", "items": {
                    "type": "OBJECT", "properties": {
                        "field": {"type": "STRING", "enum": list(CLINICAL_FIELDS)},
                        "value": {"type": "STRING"},
                        "state": {"type": "STRING", "enum": ["KNOWN", "UNKNOWN", "CONFLICT"]},
                        "confidence": {"type": "STRING", "enum": ["HIGH", "MEDIUM", "LOW"]},
                    }, "required": ["field", "state", "confidence"]}},
            },
        },
    }


class GeminiLiveAdapter:
    def __init__(self) -> None:
        self.api_key = os.environ.get("GEMINI_API_KEY", "")
        self.model = os.environ.get("HELIOS_GEMINI_LIVE_MODEL", "gemini-3.8-live")

    def capabilities(self) -> RuntimeCapabilities:
        ready = bool(self.api_key and os.environ.get("HELIOS_VOICE_CONTROL_SECRET"))
        return RuntimeCapabilities(
            state=RuntimeState.READY if ready else RuntimeState.UNAVAILABLE,
            provider="gemini-live", model=self.model, model_version=None,
            full_duplex=True, barge_in=True, languages=("hi", "hi-Hinglish"),
            benchmark_approved=False,
            reason=None if ready else "GEMINI_API_KEY and voice control secret are required",
        )

    def open_session(self, policy: SessionPolicy) -> "GeminiLiveSession":
        policy.validate()
        if self.capabilities().state != RuntimeState.READY:
            raise ValueError("Gemini Live credentials are not configured")
        return GeminiLiveSession(self.api_key, self.model)


class GeminiLiveSession:
    def __init__(self, api_key: str, model: str) -> None:
        self.api_key = api_key
        self.model = model
        self.questions: asyncio.Queue[tuple[str, str]] = asyncio.Queue(maxsize=8)
        self.loop = asyncio.get_running_loop()
        self.closed = False
        self.last_question: str | None = None
        self.completed = False
        self.voice_session_id: str | None = None

    def queue_question(self, question_id: str, text: str) -> None:
        if self.closed:
            raise ValueError("voice session is closed")
        if self.questions.qsize() >= 8:
            raise ValueError("voice question queue is full")
        try:
            same_loop = asyncio.get_running_loop() is self.loop
        except RuntimeError:
            same_loop = False
        if same_loop:
            self.questions.put_nowait((question_id, text))
        else:
            async def enqueue() -> None:
                if self.closed:
                    raise ValueError("voice session is closed")
                try:
                    self.questions.put_nowait((question_id, text))
                except asyncio.QueueFull as exc:
                    raise ValueError("voice question queue is full") from exc
            pending = asyncio.run_coroutine_threadsafe(enqueue(), self.loop)
            try:
                pending.result(timeout=3)
            except TimeoutError as exc:
                pending.cancel()
                raise ValueError("voice question queue unavailable") from exc

    def close(self) -> None:
        self.closed = True

    def barge_in(self) -> None:
        # Native server VAD handles actual interruption from incoming audio.
        pass

    async def run(self, websocket: Any, claims: Any, protocol: Any) -> None:
        from google import genai
        from google.genai import types

        self.voice_session_id = claims.voice_session_id
        client = genai.Client(api_key=self.api_key)
        try:
            backend_url = os.environ.get("HELIOS_PATIENT_API_URL", "http://localhost:8080").rstrip("/")
            async with httpx.AsyncClient(timeout=10) as http:
                context_response = await http.get(f"{backend_url}/internal/v2/voice-runtime/context",
                    params={"patientSessionId": claims.patient_session_id, "voiceSessionId": claims.voice_session_id},
                    headers={"Authorization": f"Bearer {os.environ.get('HELIOS_VOICE_CONTROL_SECRET', '')}"})
                context_response.raise_for_status()
                context = context_response.json()
            config = {
                "response_modalities": ["AUDIO"],
                "system_instruction": SYSTEM_INSTRUCTION + "\nPersisted HELIOS context (do not re-ask these facts): " + json.dumps(context, ensure_ascii=False),
                "output_audio_transcription": {},
                "tools": [{"function_declarations": [tool_declaration()]}],
            }
            async with client.aio.live.connect(model=self.model, config=config) as live:
                while not self.questions.empty():
                    self.questions.get_nowait()
                await self.questions.put(("resume-next-question", context["nextQuestion"]))
                await websocket.send_json({"type": "ready", "voiceSessionId": claims.voice_session_id,
                    "sampleRate": protocol.sample_rate_hz, "frameSamples": protocol.frame_samples,
                    "frameBytes": protocol.frame_bytes, "encoding": protocol.encoding})

                async def microphone() -> None:
                    while not self.closed:
                        message = await websocket.receive()
                        if message.get("type") == "websocket.disconnect":
                            return
                        frame = message.get("bytes")
                        if frame is not None:
                            protocol.validate_frame(frame)
                            await live.send_realtime_input(audio=types.Blob(data=frame, mime_type="audio/pcm;rate=24000"))
                        elif message.get("text"):
                            if len(message["text"]) > 4096:
                                raise ValueError("voice control too large")
                            control = json.loads(message["text"])
                            if not isinstance(control, dict):
                                raise ValueError("voice control must be an object")
                            if control.get("type") == "ping":
                                await websocket.send_json({"type": "pong"})
                            elif control.get("type") == "barge_in":
                                await websocket.send_json({"type": "barge_in_ack"})
                            else:
                                raise ValueError("unsupported client control")

                async def questions() -> None:
                    while not self.closed:
                        question_id, text = await self.questions.get()
                        if question_id == self.last_question or self.completed:
                            continue
                        self.last_question = question_id
                        await live.send_realtime_input(text=f"HELIOS server approved next question ({question_id}): {text}. Say it naturally in Hindi. Do not log this as patient data.")

                async def responses() -> None:
                    caption = ""
                    while not self.closed:
                        async for response in live.receive():
                            content = response.server_content
                            if content:
                                if content.interrupted:
                                    caption = ""
                                    await websocket.send_json({"type": "interrupted"})
                                if content.output_transcription and content.output_transcription.text:
                                    caption = (caption + content.output_transcription.text)[-8000:]
                                    await websocket.send_json({"type": "caption", "text": caption})
                                if content.model_turn:
                                    for part in content.model_turn.parts:
                                        if part.inline_data and part.inline_data.data:
                                            await websocket.send_bytes(part.inline_data.data)
                                if content.turn_complete:
                                    caption = ""
                                    await websocket.send_json({"type": "turn_complete"})
                                    if self.completed:
                                        await websocket.send_json({"type": "completed"})
                                        return
                            if response.tool_call:
                                results = []
                                for call in response.tool_call.function_calls:
                                    result = await self.record_turn(claims.patient_session_id, call.name, call.args or {})
                                    if result.get("complete") and result.get("doctorAvatarId"):
                                        await websocket.send_json({"type": "handoff", "doctorAvatarId": result["doctorAvatarId"]})
                                    results.append(types.FunctionResponse(id=call.id, name=call.name, response=result))
                                await live.send_tool_response(function_responses=results)

                tasks = [asyncio.create_task(task()) for task in (microphone, questions, responses)]
                try:
                    done, _ = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
                    for task in done:
                        task.result()
                finally:
                    for task in tasks:
                        task.cancel()
                    await asyncio.gather(*tasks, return_exceptions=True)
        finally:
            await client.aio.aclose()

    async def record_turn(self, patient_session_id: str, name: str, args: dict[str, Any]) -> dict[str, Any]:
        if name != "record_turn":
            return {"error": "unknown tool"}
        if (not isinstance(args, dict)
                or not isinstance(args.get("identity", []), list)
                or not isinstance(args.get("facts", []), list)
                or len(args.get("identity", [])) > 4
                or len(args.get("facts", [])) > 32
                or any(not isinstance(item, dict) for item in args.get("identity", []) + args.get("facts", []))):
            return {"accepted": False, "instruction": "Malformed record_turn arguments. Correct the tool fields; no information was saved."}
        turn_id = f"turn-{uuid.uuid4().hex}"
        provenance = {"source": "PATIENT_REPORTED", "evidenceTurnIds": [turn_id],
            "model": self.model, "modelVersion": self.model, "conversationPolicyVersion": POLICY_VERSION}
        identity = [{**item, **provenance, "confidence": "HIGH"} for item in args.get("identity", [])]
        facts = [{**item, **provenance} for item in args.get("facts", [])]
        url = os.environ.get("HELIOS_PATIENT_API_URL", "http://localhost:8080").rstrip("/")
        secret = os.environ.get("HELIOS_VOICE_CONTROL_SECRET", "")
        try:
            async with httpx.AsyncClient(timeout=15) as http:
                response = await http.post(f"{url}/internal/v2/voice-runtime/turn",
                    headers={"Authorization": f"Bearer {secret}"},
                    json={"patientSessionId": patient_session_id, "voiceSessionId": self.voice_session_id, "identity": identity, "facts": facts})
        except httpx.HTTPError:
            return {"accepted": False, "instruction": "Saving could not be confirmed. Do not claim success. Tell the patient in Hindi to retry when the service is available."}
        if response.status_code >= 400:
            return {"accepted": False, "instruction": "Information could not be saved. Do not claim it was logged; ask the patient to retry.", "status": response.status_code}
        try:
            result = response.json()
        except ValueError:
            result = None
        if not isinstance(result, dict) or not isinstance(result.get("complete"), bool):
            return {"accepted": False, "instruction": "The server response was invalid. Do not claim the consultation is complete."}
        self.completed = bool(result.get("complete"))
        if result.get("nextQuestion"):
            result["instruction"] = "Acknowledge the patient and ask only nextQuestion, naturally in Hindi. Do not re-ask saved facts."
        return {"accepted": True, **result}
