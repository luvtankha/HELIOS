# HELIOS v2 Phase 4 — full-duplex voice spike

Status: **IN PROGRESS / GATE NOT YET PASSED**.

This phase deliberately does not mark a voice model as production-ready from documentation claims alone. The migration context requires measured Hindi/Hinglish, interruption, latency and deployment evidence before voice-coupled implementation proceeds.

## Evidence gathered

### Human-1 / Moshi candidate

Hugging Face repository inspected: `VoiceArena/Human-1`.

Verified model metadata/model-card claims:

- audio-to-audio / full-duplex speech dialogue;
- approximately 7.7B parameters;
- Hindi (`hi`) model using a custom Hindi SentencePiece tokenizer;
- built by adapting Kyutai Moshi;
- model card explicitly describes interruptions, overlaps, backchannels and natural turn-taking;
- Mimi audio codec, 24 kHz audio, 8 codebooks;
- CC-BY-4.0 model license;
- repository is roughly 31 GB and the primary checkpoint is fp32;
- training was on large spontaneous Hindi conversational data;
- the model card states that performance on other languages/domains is not guaranteed;
- the model card describes it as research/casual-conversation oriented and explicitly does not recommend it for professional advice/duties.

Implication for HELIOS: Human-1 is the strongest currently identified open candidate for the **interaction mechanics** we need, but it is **not yet proven for Hinglish or medical-intake dialogue** and cannot be treated as a healthcare-ready model as-is.

### Base Moshi

`kyutai/moshika-pytorch-bf16` is an approximately 7.7B Moshi model with English metadata. It remains architecturally useful as the base/reference but is not the HELIOS language fit by itself.

### MiniCPM-o 4.5

`openbmb/MiniCPM-o-4_5` is a strong 9B any-to-any/full-duplex model and is Apache-2.0, but its official model card states that real-time speech conversation is bilingual **English and Chinese**. Its broader multilingual capabilities do not establish Hindi speech generation/full-duplex Hindi support. It therefore remains rejected for the current Hindi/Hinglish voice requirement unless future official evidence changes.

## Hinglish conclusion

No inspected Human-1 documentation establishes robust Hinglish code-switching performance. Hindi training may naturally contain some borrowed English vocabulary, but that is not sufficient evidence for the HELIOS requirement.

Therefore the following remain mandatory measured tests before model lock:

1. Devanagari Hindi input/output.
2. Romanized Hindi input/output.
3. Intra-sentence Hinglish code-switching.
4. Common Indian medical vocabulary and English medical loanwords inside Hindi.
5. Corrections: `pain nahi, pressure hai` style self-repair.
6. Numbers, durations, medication names and symptom locations.
7. Accents/speaking speeds/noisy consumer microphones.
8. Long-session context retention.

## Local execution feasibility check

Current Chat on Steroids workspace:

- Python runtime: not installed/on PATH (Windows Store alias only).
- `uv`: available and can provision a Python runtime later.
- NVIDIA CUDA GPU: none detected; `nvidia-smi` is unavailable.
- Detected GPU: integrated AMD Radeon graphics with approximately 512 MB reported adapter memory.
- Human-1 checkpoint: roughly 31 GB fp32.

Conclusion: this machine cannot provide a meaningful Human-1 realtime benchmark. Installing Python alone would not resolve the GPU/VRAM constraint.

The public Hugging Face `bhaskarbuilds/human-1-demo` Space was also found to be paused during this phase, so it cannot currently serve as the benchmark environment.

## Compute policy

Do not silently launch paid GPU jobs. The model weights may be free/open under their license, but realtime inference compute is not automatically free. A cloud/Hugging Face GPU benchmark requires an explicitly available free allocation or separate user approval for any billable compute.

## Benchmark harness specification

When suitable GPU compute is available, the spike must run a fixed, versioned evaluation set rather than ad-hoc chatting.

### Conversation set

At minimum include:

```text
H01 pure Hindi symptom description
H02 Romanized Hindi symptom description
H03 Hinglish chest-pressure description
H04 Hinglish abdominal-pain description
H05 correction/self-repair
H06 interruption during assistant question
H07 repeated interruption / overlap
H08 short backchannel (haan / hmm / ji)
H09 uncertain answer (shayad / pata nahi)
H10 conflicting answer requiring clarification
H11 medication/allergy vocabulary
H12 dates/durations/numbers
H13 noisy microphone sample
H14 long pause without ending the conversation
H15 long multi-turn intake context
```

These are **interaction tests**, not diagnostic tests. Clinical question quality is evaluated separately by the conversation-engine phase.

### Metrics

Capture at least:

```text
time_to_first_audio_ms
median_turn_response_ms
p95_turn_response_ms
barge_in_detection_ms
generation_cancel_ms
stale_audio_after_cancel_ms
audio_dropouts
unexpected_turn_end_count
language_drift_count
hinglish_code_switch_failures
context_repetition_count
semantic_correction_success
GPU_VRAM_peak
GPU_utilization
real_time_factor
```

### Hard acceptance criteria

The model/transport cannot be locked unless:

- patient can interrupt while assistant audio is being generated/played;
- cancelled assistant audio does not restart;
- conversation remains one continuous session after interruption;
- Hindi is natural enough for the intended patient population;
- Hinglish/code-switching is demonstrably usable, not merely theoretically possible;
- the runtime exposes enough control to enforce HELIOS session termination and safety policy;
- deployment fits a known GPU class with measured memory/latency;
- model output can be constrained/mediated by the Java authority boundary from Phase 3;
- no claim is made that the base model itself is medically validated.

## Media transport decision status

WebRTC remains the preferred candidate for browser media because it is designed for realtime media and provides browser media tracks, congestion/jitter handling and ICE/STUN/TURN connectivity. WebSocket remains useful for application/control events and as a comparison/fallback transport, but a pure binary-WebSocket audio path would require more custom media buffering/cancellation behavior.

The final transport is **not locked** until the same audio/model benchmark is run over the candidate topology. If direct browser -> Python/media WebRTC wins, Spring Boot remains the control/authorization/persistence authority and issues only a short-lived media grant as defined in Phase 3.

## Phase 4 blocker

The repository work can define and test model-independent contracts, but this phase cannot honestly pass its core acceptance gate on the current machine because there is no suitable GPU and the available Human-1 public demo is paused.

Safe next options are:

1. attach/provide access to a suitable CUDA GPU environment;
2. use an explicitly free GPU allocation if available;
3. explicitly authorize a bounded paid GPU benchmark;
4. wait for/restart an accessible Human-1 demo environment that exposes the required realtime behavior.

Until one of those is available, do **not** couple HELIOS v2 implementation to Human-1-specific APIs or delete the existing voice fallback.

## Context re-check at current Phase 4 stop point

- Phase 1 repository findings still valid: YES.
- Phase 2 source baseline invalidated: NO.
- Phase 3 service/authority boundaries invalidated: NO.
- Locked patient UI changed: NO.
- Doctor-dashboard code changed: NO.
- Hindi/Hinglish requirement weakened to Hindi-only: NO; this is precisely why the gate remains open.
- Model incorrectly labelled medically safe: NO.
- Old voice implementation deleted: NO.
- Figma touched: NO.

Phase 4 remains open until measured runtime evidence is available.

## Implemented benchmark harness

The no-GPU portion of the gate is now executable under `voice-service/`:

- `benchmarks/scenarios.json` contains the fixed H01-H15 Hindi/Hinglish interaction set.
- `benchmarks/gate.json` contains explicit engineering thresholds.
- `src/helios_voice_bench` validates manifests, ingests real JSONL measurements, computes p95/counters, and refuses to pass mock/unmeasured or incomplete result sets.
- `tests/test_benchmark.py` verifies manifest integrity and gate behavior.

Validation performed with CPython 3.12 provisioned by `uv`: scenario validation passes and all 6 harness unit tests pass.

This closes the **benchmark-infrastructure** part of Phase 4, but it does not close the real-model evidence gate. No synthetic result has been recorded as a Human-1 pass.
