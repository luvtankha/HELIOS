"""Actual vendor connection with synthetic Hindi only. Never prints credentials."""
import asyncio
import json
import os
import sys
from time import monotonic


async def main() -> int:
    from google import genai
    from google.genai import errors

    key = os.environ.get("GEMINI_API_KEY", "")
    if not key:
        print(json.dumps({"status": "unconfigured", "detail": "Set GEMINI_API_KEY in the private .env"}))
        return 2
    model = os.environ.get("HELIOS_GEMINI_LIVE_MODEL", "gemini-3.8-live")
    client = genai.Client(api_key=key)
    started = monotonic()
    audio_bytes = 0
    caption = ""
    try:
        async with asyncio.timeout(30):
            async with client.aio.live.connect(model=model, config={
                "response_modalities": ["AUDIO"],
                "system_instruction": "Always speak Hindi. This is a synthetic software connectivity test. Say a brief greeting and ask what symptom the patient has. Do not provide medical advice.",
                "output_audio_transcription": {},
            }) as live:
                await live.send_realtime_input(text="नमस्ते! कृपया हिंदी में अभिवादन करें।")
                async for response in live.receive():
                    content = response.server_content
                    if not content:
                        continue
                    if content.output_transcription and content.output_transcription.text:
                        caption += content.output_transcription.text
                    if content.model_turn:
                        for part in content.model_turn.parts:
                            if part.inline_data and part.inline_data.data:
                                audio_bytes += len(part.inline_data.data)
                    if content.turn_complete:
                        break
        hindi = any("\u0900" <= char <= "\u097f" for char in caption)
        print(json.dumps({"status": "passed" if audio_bytes and hindi else "incomplete",
            "model": model, "nativeAudioBytes": audio_bytes, "hindiCaption": hindi,
            "elapsedSeconds": round(monotonic() - started, 2)}, ensure_ascii=False))
        return 0 if audio_bytes and hindi else 1
    except errors.APIError as exc:
        # Vendor messages/URLs can contain credentials; expose only a status code.
        print(json.dumps({"status": "provider_rejected", "code": exc.code, "model": model}))
        return 1
    except Exception as exc:
        print(json.dumps({"status": "connection_failed", "errorType": type(exc).__name__, "model": model}))
        return 1
    finally:
        await client.aio.aclose()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
