from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Protocol


class RuntimeState(StrEnum):
    UNAVAILABLE = "unavailable"
    READY = "ready"
    DEGRADED = "degraded"


@dataclass(frozen=True)
class RuntimeCapabilities:
    state: RuntimeState
    provider: str
    model: str
    model_version: str | None
    full_duplex: bool
    barge_in: bool
    languages: tuple[str, ...]
    benchmark_approved: bool = False
    reason: str | None = None


@dataclass(frozen=True)
class SessionPolicy:
    session_id: str
    language_mode: str
    allow_diagnosis: bool = False
    allow_prescribing: bool = False
    allow_direct_doctor_assignment: bool = False

    def validate(self) -> None:
        if self.language_mode != "hi-Hinglish":
            raise ValueError("HELIOS v2 voice sessions require hi-Hinglish mode")
        if self.allow_diagnosis or self.allow_prescribing or self.allow_direct_doctor_assignment:
            raise ValueError("voice runtime cannot be granted clinical or routing authority")


class VoiceModelAdapter(Protocol):
    def capabilities(self) -> RuntimeCapabilities: ...

    def start(self) -> None: ...

    def stop(self) -> None: ...

    def cancel_generation(self, turn_id: str) -> None: ...
