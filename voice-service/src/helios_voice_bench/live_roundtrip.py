"""Exercise native patient audio through the real gateway and durable intake.

Uses synthetic speech, creates one labelled local test patient, and saves only
the resulting session identifiers/summary in ignored .local/live-roundtrip.json.
"""
import asyncio
import json
import os
from pathlib import Path

import httpx
from websockets.asyncio.client import connect

from .gateway.protocol import PCM_FRAME_BYTES


async def synthetic_speech(client, model: str, text: str) -> bytes:
    async with client.aio.live.connect(model=model, config={
        "response_modalities": ["AUDIO"],
        "system_instruction": "You are recording synthetic test speech. Speak exactly the supplied Hindi sentence once, with no introduction, questions, or additional words.",
    }) as source:
        await source.send_realtime_input(text=f"Speak exactly: {text}")
        audio = bytearray()
        async for response in source.receive():
            if response.server_content and response.server_content.model_turn:
                for part in response.server_content.model_turn.parts:
                    if part.inline_data and part.inline_data.data:
                        audio.extend(part.inline_data.data)
            if response.server_content and response.server_content.turn_complete:
                break
        if not audio:
            raise RuntimeError("Synthetic patient audio was empty")
        return bytes(audio)


async def main() -> None:
    from google import genai
    if os.environ.get("HELIOS_LOCAL_DATABASE") != "true":
        raise RuntimeError("This smoke test requires the dedicated local HELIOS database")
    base = os.environ.get("HELIOS_PATIENT_API_URL", "http://127.0.0.1:8080").rstrip("/")
    from urllib.parse import urlparse
    parsed = urlparse(base)
    if parsed.scheme != "http" or parsed.hostname not in ("127.0.0.1", "localhost", "::1") or parsed.username or parsed.password:
        raise RuntimeError("Local test services required")
    model = os.environ.get("HELIOS_GEMINI_LIVE_MODEL", "gemini-3.8-live")
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    report = {"status": "started", "synthetic": True, "model": model}
    report_path = Path(".local/live-roundtrip.json")
    report_path.parent.mkdir(exist_ok=True)
    try:
        # Prepare genuine Hindi PCM speech before starting the consultation.
        statements = [
            "मुझे फटीग यानी थकान महसूस हो रही है।",
            "मेरा नाम सिंथेटिक राहुल है। मेरी उम्र बत्तीस साल है और मैं पुरुष हूँ।",
            "मुझे दो दिन से हल्की थकान है। दस में से तीन जितनी है। यह बीच बीच में होती है। कोई और लक्षण नहीं है।",
        ]
        recordings = []
        for index, statement in enumerate(statements):
            cached = Path(f".local/synthetic-patient-turn-{index + 1}.pcm")
            if cached.exists():
                recordings.append(cached.read_bytes())
            else:
                async with asyncio.timeout(40):
                    recordings.append(await synthetic_speech(client, model, statement))
                cached.write_bytes(recordings[-1])
            print(json.dumps({"event": "synthetic_audio_ready", "turn": index + 1}), flush=True)
        async with httpx.AsyncClient(timeout=20) as http:
            response = await http.post(f"{base}/api/v2/patient-sessions", json={"conversationLanguage": "hi-Hinglish"})
            response.raise_for_status()
            session = response.json()
            proof = {"x-session-token": session["sessionToken"]}
            report["sessionId"] = session["sessionId"]
            report_path.write_text(json.dumps(report), encoding="utf-8")
            response = await http.post(f"{base}/api/v2/consents", headers=proof,
                json={"sessionId": session["sessionId"], "consentType": "PRE_CONSULTATION", "accepted": True, "version": "1.0"})
            response.raise_for_status()
            response = await http.post(f"{base}/api/v2/voice-sessions", headers=proof,
                json={"patientSessionId": session["sessionId"], "capabilities": {"bargeIn": True, "languageMode": "hi-Hinglish"}})
            response.raise_for_status()
            voice = response.json()
            if not voice["media"]["available"]:
                report["stage"] = "voice_availability"
                report["detail"] = voice["media"]["detail"]
                raise RuntimeError("Voice runtime not ready")
            outbound: asyncio.Queue[bytes] = asyncio.Queue()
            turns: asyncio.Queue[dict] = asyncio.Queue()
            audio_bytes = 0
            hindi_caption = False
            completed = asyncio.Event()
            async with connect(voice["media"]["websocketUrl"], max_size=2**22) as socket:
                await socket.send(json.dumps({"type": "auth", "ticket": voice["media"]["credential"]}))
                ready = json.loads(await asyncio.wait_for(socket.recv(), 20))
                if ready.get("type") != "ready":
                    raise RuntimeError("Gateway did not start native media")

                async def microphone():
                    while not completed.is_set():
                        try:
                            frame = outbound.get_nowait()
                        except asyncio.QueueEmpty:
                            frame = bytes(PCM_FRAME_BYTES)
                        await socket.send(frame)
                        await asyncio.sleep(0.08)

                async def receive():
                    nonlocal audio_bytes, hindi_caption
                    async for item in socket:
                        if isinstance(item, bytes):
                            audio_bytes += len(item)
                            continue
                        control = json.loads(item)
                        if control.get("type") == "caption":
                            hindi_caption |= any("\u0900" <= char <= "\u097f" for char in control.get("text", ""))
                        if control.get("type") == "turn_complete":
                            await turns.put(control)
                        if control.get("type") == "completed":
                            completed.set()
                            return

                tasks = [asyncio.create_task(microphone()), asyncio.create_task(receive())]
                try:
                    await asyncio.wait_for(turns.get(), 35)
                    for index, recording in enumerate(recordings):
                        while not turns.empty():
                            turns.get_nowait()
                        for offset in range(0, len(recording), PCM_FRAME_BYTES):
                            await outbound.put(recording[offset:offset + PCM_FRAME_BYTES].ljust(PCM_FRAME_BYTES, b"\0"))
                        await asyncio.wait_for(turns.get(), 55)
                        context_response = await http.get(f"{base}/api/v2/intake-sessions/{session['sessionId']}", headers=proof)
                        context_response.raise_for_status()
                        context = context_response.json()
                        identity_response = await http.get(f"{base}/api/v2/patient-sessions/{session['sessionId']}", headers=proof)
                        identity_response.raise_for_status()
                        identity_complete = bool(identity_response.json().get("patientId"))
                        print(json.dumps({"event": "patient_turn_logged", "turn": index + 1,
                            "facts": len(context["facts"]), "identityComplete": identity_complete, "complete": context["complete"]}), flush=True)
                        if context["complete"]:
                            await asyncio.wait_for(completed.wait(), 20)
                            break
                    if not completed.is_set():
                        raise RuntimeError("Synthetic consultation did not complete")
                finally:
                    for task in tasks:
                        task.cancel()
                    await asyncio.gather(*tasks, return_exceptions=True)
            final = await http.get(f"{base}/api/v2/patient-sessions/{session['sessionId']}", headers=proof)
            final.raise_for_status()
            saved = final.json()
            if saved["currentStep"] != "REVIEW" or not audio_bytes or not hindi_caption:
                raise RuntimeError("Native conversation or durable completion did not pass")
            report.update(status="passed", patientId=saved["patientId"], visitId=saved["visitId"],
                nativeAudioBytes=audio_bytes, hindiCaption=hindi_caption)
    except Exception as exc:
        # Never emit vendor URLs, credentials or raw exception strings.
        report.update(status="failed", errorType=type(exc).__name__)
        raise
    finally:
        report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(json.dumps(report), flush=True)
        await client.aio.aclose()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception:
        raise SystemExit(1)
