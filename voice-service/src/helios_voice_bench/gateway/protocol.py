from __future__ import annotations

from dataclasses import dataclass


SAMPLE_RATE_HZ = 24_000
FRAME_RATE_HZ = 12.5
FRAME_SAMPLES = 1_920
PCM_SAMPLE_BYTES = 2
PCM_FRAME_BYTES = FRAME_SAMPLES * PCM_SAMPLE_BYTES
PCM_ENCODING = "pcm_s16le"


@dataclass(frozen=True)
class AudioProtocol:
    sample_rate_hz: int = SAMPLE_RATE_HZ
    frame_rate_hz: float = FRAME_RATE_HZ
    frame_samples: int = FRAME_SAMPLES
    frame_bytes: int = PCM_FRAME_BYTES
    encoding: str = PCM_ENCODING

    def validate_frame(self, frame: bytes) -> None:
        if len(frame) != self.frame_bytes:
            raise ValueError(
                f"expected {self.frame_bytes} bytes of {self.encoding} audio, got {len(frame)}"
            )
