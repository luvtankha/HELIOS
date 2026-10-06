from __future__ import annotations

import importlib.util
import os
from contextlib import ExitStack
from pathlib import Path
from threading import Lock
from typing import Any

from helios_voice_bench.gateway.protocol import PCM_FRAME_BYTES
from helios_voice_bench.core import BenchmarkError, evaluate_gate, load_json, load_results

from .contracts import RuntimeCapabilities, RuntimeState, SessionPolicy
from .forced_questions import ApprovedQuestion, ForcedQuestionPlan, normalize_token_ids


class Human1Adapter:
    """Lazy Human-1/Moshi runtime with a fail-closed clinical speech boundary."""

    MODEL_ID = "VoiceArena/Human-1"
    MINIMUM_VRAM_BYTES = 24 * 1024**3
    DEFAULT_GATE_PATH = Path(__file__).resolve().parents[3] / "benchmarks" / "gate.json"

    def __init__(
        self,
        *,
        benchmark_results_path: str | None = None,
        benchmark_gate_path: str | None = None,
    ) -> None:
        self._loaded: _LoadedHuman1 | None = None
        self._load_lock = Lock()
        self._benchmark_results_path = benchmark_results_path or os.environ.get(
            "HELIOS_VOICE_BENCHMARK_RESULTS"
        )
        self._benchmark_gate_path = benchmark_gate_path or os.environ.get(
            "HELIOS_VOICE_BENCHMARK_GATE"
        )

    def capabilities(self) -> RuntimeCapabilities:
        if importlib.util.find_spec("torch") is None:
            return self._unavailable("PyTorch is not installed in this runtime")
        if importlib.util.find_spec("moshi") is None:
            return self._unavailable("Moshi is not installed in this runtime")
        import torch  # type: ignore[import-not-found]

        if not torch.cuda.is_available():
            return self._unavailable(
                "CUDA GPU is required for the Human-1 realtime runtime"
            )
        total_memory = int(torch.cuda.get_device_properties(0).total_memory)
        if total_memory < self.MINIMUM_VRAM_BYTES:
            return self._unavailable(
                "available CUDA device has less than the required 24 GiB runtime floor"
            )
        benchmark_approved, benchmark_reason = self._benchmark_approval()
        return RuntimeCapabilities(
            state=RuntimeState.READY if benchmark_approved else RuntimeState.DEGRADED,
            provider="huggingface",
            model=self.MODEL_ID,
            model_version=None,
            full_duplex=True,
            barge_in=True,
            languages=("hi", "hi-Hinglish"),
            benchmark_approved=benchmark_approved,
            reason=None if benchmark_approved else benchmark_reason,
        )

    def start(self) -> None:
        self._ensure_loaded()

    def stop(self) -> None:
        with self._load_lock:
            self._loaded = None

    def cancel_generation(self, turn_id: str) -> None:
        if not turn_id:
            raise ValueError("turn_id is required")

    def open_session(self, policy: SessionPolicy) -> "Human1StreamingSession":
        policy.validate()
        loaded = self._ensure_loaded()
        return Human1StreamingSession(loaded)

    def _ensure_loaded(self) -> "_LoadedHuman1":
        capabilities = self.capabilities()
        if capabilities.state == RuntimeState.UNAVAILABLE:
            raise RuntimeError(capabilities.reason or "Human-1 runtime unavailable")
        with self._load_lock:
            if self._loaded is not None:
                return self._loaded
            import torch  # type: ignore[import-not-found]
            from moshi.models import LMGen, loaders  # type: ignore[import-not-found]

            checkpoint = loaders.CheckpointInfo.from_hf_repo(self.MODEL_ID)
            mimi = checkpoint.get_mimi(device="cuda")
            tokenizer = checkpoint.get_text_tokenizer()
            lm = checkpoint.get_moshi(device="cuda", dtype=torch.bfloat16)
            self._loaded = _LoadedHuman1(
                torch=torch,
                mimi=mimi,
                tokenizer=tokenizer,
                lm=lm,
                lm_gen_type=LMGen,
            )
            return self._loaded

    def _unavailable(self, reason: str) -> RuntimeCapabilities:
        return RuntimeCapabilities(
            state=RuntimeState.UNAVAILABLE,
            provider="huggingface",
            model=self.MODEL_ID,
            model_version=None,
            full_duplex=False,
            barge_in=False,
            languages=("hi", "hi-Hinglish"),
            benchmark_approved=False,
            reason=reason,
        )

    def _benchmark_approval(self) -> tuple[bool, str]:
        if not self._benchmark_results_path:
            return (
                False,
                "GPU preflight passed; measured H01-H15 benchmark evidence is not configured",
            )
        gate_path = Path(self._benchmark_gate_path) if self._benchmark_gate_path else self.DEFAULT_GATE_PATH
        try:
            report = evaluate_gate(
                load_results(self._benchmark_results_path),
                load_json(gate_path),
            )
        except (OSError, ValueError, BenchmarkError, KeyError, TypeError) as exc:
            return False, f"benchmark evidence is invalid: {exc}"
        if not report.eligible:
            failures = "; ".join(report.failures[:3])
            return False, f"benchmark gate failed: {failures or 'unknown failure'}"
        return True, "measured benchmark gate passed"


class _LoadedHuman1:
    def __init__(
        self,
        *,
        torch: Any,
        mimi: Any,
        tokenizer: Any,
        lm: Any,
        lm_gen_type: Any,
    ) -> None:
        self.torch = torch
        self.mimi = mimi
        self.tokenizer = tokenizer
        self.lm = lm
        self.lm_gen_type = lm_gen_type


class Human1StreamingSession:
    """Single-patient persistent Moshi streaming state."""

    def __init__(self, loaded: _LoadedHuman1) -> None:
        self._loaded = loaded
        self._plan = ForcedQuestionPlan()
        self._forced_this_step = False
        self._closed = False
        self._stack = ExitStack()
        self._lm_gen = loaded.lm_gen_type(
            loaded.lm,
            on_text_hook=self._on_text_token,
        )
        self._stack.enter_context(loaded.mimi.streaming(1))
        self._stack.enter_context(self._lm_gen.streaming(1))

    def ingest_pcm16(self, frame: bytes) -> bytes | None:
        if self._closed:
            raise RuntimeError("voice session is closed")
        if len(frame) != PCM_FRAME_BYTES:
            raise ValueError(f"expected {PCM_FRAME_BYTES} bytes of PCM16 audio")
        torch = self._loaded.torch
        samples = torch.frombuffer(bytearray(frame), dtype=torch.int16)
        chunk = (
            samples.to(device="cuda", dtype=torch.float32)
            .div_(32768.0)
            .view(1, 1, -1)
        )
        with torch.no_grad():
            codes = self._loaded.mimi.encode(chunk)
            tokens = self._lm_gen.step(codes[:, :, :1])
            if tokens is None:
                return None
            audio_tokens = tokens[:, 1:, :]
            pcm = self._loaded.mimi.decode(audio_tokens)
        if not self._forced_this_step:
            return None
        output = (
            pcm[0, 0]
            .clamp(-1.0, 1.0)
            .mul(32767.0)
            .to(dtype=torch.int16)
            .cpu()
            .numpy()
            .tobytes()
        )
        return output

    def queue_question(self, question_id: str, text: str) -> None:
        if self._closed:
            raise RuntimeError("voice session is closed")
        token_ids = self._tokenize(text)
        self._plan.enqueue(
            ApprovedQuestion(
                question_id=question_id,
                text=text,
                token_ids=token_ids,
            )
        )

    def barge_in(self) -> None:
        if self._closed:
            return
        self._plan.cancel()

    def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        self._plan.cancel()
        self._stack.close()

    def _on_text_token(self, sampled_text_token: Any) -> None:
        self._forced_this_step = self._plan.apply_to_tensor(sampled_text_token)

    def _tokenize(self, text: str) -> tuple[int, ...]:
        tokenizer = self._loaded.tokenizer
        tokens = normalize_token_ids(
            tokenizer.encode(
                text.strip(),
                out_type=int,
                add_bos=False,
                add_eos=False,
            )
        )
        eos_id = int(tokenizer.eos_id())
        if eos_id >= 0:
            tokens = (*tokens, eos_id)
        if not tokens:
            raise ValueError("approved question produced no Human-1 text tokens")
        return tokens
