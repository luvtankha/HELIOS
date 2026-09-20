"""Bounded local speech worker. Reads encoded audio from stdin; emits JSON only."""
import io
import json
import sys
from base64 import b64decode


def transcribe(model, raw, language, limit):
    import numpy as np
    from faster_whisper.audio import decode_audio

    if len(raw) > 25_000_000:
        return {"error": "AUDIO_TOO_LARGE"}
    audio = decode_audio(io.BytesIO(raw), sampling_rate=16000)
    if len(audio) > (float(limit) + 1) * 16000:
        return {"error": "AUDIO_DURATION_EXCEEDED"}
    if not len(audio) or float(np.sqrt(np.mean(audio * audio))) < 0.0001:
        return {"error": "NO_SPEECH"}
    english_prompt = (
        "This is an English healthcare check-in. Preserve the patient's exact "
        "answer, including yes or no, symptoms, blood pressure, diabetes, and "
        "numbers from zero to ten."
    )
    segments, _ = model.transcribe(
        audio, language=language, beam_size=5, temperature=0,
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=550, speech_pad_ms=250),
        condition_on_previous_text=False,
        initial_prompt=english_prompt if language == "en" else None,
    )
    transcript = " ".join(segment.text.strip() for segment in segments).strip()
    return {"transcript": transcript} if transcript else {"error": "NO_SPEECH"}


def load_model(model_path):
    from faster_whisper import WhisperModel
    return WhisperModel(
        model_path,
        device="cpu",
        compute_type="int8",
        cpu_threads=4,
        local_files_only=True,
    )


def main():
    model_path, language, limit = sys.argv[1:4]
    if language not in ("en", "hi"):
        raise ValueError("Unsupported language")
    raw = sys.stdin.buffer.read(25_000_001)
    return transcribe(load_model(model_path), raw, language, limit)


def worker():
    model_path, language, limit = sys.argv[1:4]
    if language not in ("en", "hi"):
        raise ValueError("Unsupported language")
    model = load_model(model_path)
    print(json.dumps({"ready": True}), flush=True)
    for line in sys.stdin:
        try:
            request = json.loads(line)
            encoded = request.get("audio") if isinstance(request, dict) else None
            if not isinstance(encoded, str):
                raise ValueError("Invalid audio request")
            result = transcribe(model, b64decode(encoded, validate=True), language, limit)
        except Exception:
            result = {"error": "TRANSCRIPTION_FAILED"}
        print(json.dumps(result, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    try:
        if sys.argv[-1] == "--worker":
            worker()
        else:
            print(json.dumps(main(), ensure_ascii=False))
    except Exception:
        print(json.dumps({"error": "TRANSCRIPTION_FAILED"}))
        sys.exit(1)
