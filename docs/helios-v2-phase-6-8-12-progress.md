# HELIOS v2 implementation progress — persistence/auth/UI/intake/routing

This checkpoint records model-independent implementation completed after the Spring foundation. It is intentionally additive: v1 patient routes still work and doctor-dashboard code remains unchanged.

## Phase 6 — PostgreSQL/JPA handoff preparation

Implemented:

- JPA mapping for the existing quoted Prisma `PatientSession` table.
- Existing PostgreSQL named enums `PatientSessionStatus` and `PatientFlowStep` are mapped with Hibernate `NAMED_ENUM` support rather than converted to new varchar columns.
- Hibernate remains `ddl-auto: validate`; Java is not allowed to rewrite the schema.
- Flyway remains disabled until an isolated PostgreSQL database can prove the Prisma -> Flyway baseline handoff.
- `/api/v2/patient-sessions` create/read application path is implemented against the existing table contract.
- v2 sessions lock conversation language to `hi-Hinglish`; the legacy English-vs-Hindi selector is not reproduced in the new API.
- IDs use a 25-character CUID-compatible shape accepted by the existing Zod `cuid()` validators, preserving cross-backend compatibility.

Blocked before Phase 6 can be marked fully complete: this workspace has no PostgreSQL server/Docker, so JPA-vs-real-schema validation and Flyway handoff cannot be truthfully claimed yet.

## Phase 7 — patient session security compatibility

Implemented:

- Java `SessionProofCodec` reproduces the existing TypeScript `v1.<base64url-json>.<HMAC-SHA256>` patient-session proof format.
- Exact fixed-time cross-language token vector is asserted in Java tests.
- Missing, invalid, expired or wrong-session proof fails closed.
- Existing session secret/TTL environment contract is retained.
- New session APIs remain isolated under `/api/v2`; v1 authentication is untouched.

## Phase 8 — finalized patient live UI implementation

Implemented as a parallel route at `apps/web/src/app/patient/live/page.tsx`; it has **not** replaced the v1 patient flow yet.

- Original vector doctor team drawn in React/SVG; no stock photos or Figma assets.
- One active doctor, supporting doctors remain visible.
- Speech bubble exists only while the active doctor is speaking.
- Listening is represented by the active doctor's visual state; there is no waveform-orb primary interaction.
- No chat box, mic button, start-speaking button, Next button, transcript editor or visible STT/LLM/TTS processing stage.
- Realtime reducer implements the Phase 3 public event contract and ignores stale/duplicate events.
- Doctor handoff changes the active illustrated clinician without resetting the session.
- Microphone is requested automatically with echo-cancellation/noise-suppression/AGC preferences; `MediaRecorder` is not used in the v2 live path.
- Browser v2 client automatically creates/resumes a Spring patient session and keeps the session proof in `sessionStorage`, not persistent local storage.
- `NEXT_PUBLIC_PATIENT_API_V2_URL` separates the new Spring patient backend (default `:8080`) from the existing Express backend (default `:5000`) during coexistence.

The earlier temporary local opening speech-bubble event has now been removed. The v2 live UI will not fake a spoken turn with browser TTS or a local transcript pipeline; doctor speaking/listening state must come from the realtime server event stream once the Phase 4 runtime is benchmark-approved.

## Realtime voice-control scaffold

Implemented model-independently without claiming the Phase 4 gate has passed:

- shared `contracts/voice-runtime.proto` for `Health`, `GetCapabilities`, and bidirectional `Conversation`;
- contract includes runtime capability/benchmark state, cancellation, patient turn boundaries, assistant turn lifecycle, candidate facts, missing-information state, red-flag candidates, completion candidates, metrics, and runtime errors;
- Java `/api/v2/voice-sessions` create/read/resume/end control endpoints;
- voice sessions require an authorized patient-session proof, `hi-Hinglish`, and barge-in capability;
- current media response is deliberately `available: false` / `PENDING_PHASE4_BENCHMARK`; no WebRTC/WebSocket media transport is falsely advertised as ready;
- resume acknowledgement sequence cannot move backwards;
- browser creates the v2 voice-control session automatically after the patient session is ready;
- microphone capture is gated on media availability, so the browser does not record into a nonexistent runtime;
- v2 CORS is explicitly restricted to configured patient frontend origins and the required headers/methods.
- Java exposes an authenticated NDJSON control-event stream at the voice-session boundary; it uses the exact public Phase 3 event names and a bounded 256-event replay buffer for reconnect-by-sequence;
- browser NDJSON parsing validates the public event envelope before mapping it into the finalized UI reducer;
- internal pipeline events are ignored by the UI mapping, so transcription/model internals do not become product states;
- the control stream is wired to the patient UI but remains dormant while media is deliberately unavailable behind the Phase 4 gate.

## Phase 12 — intelligent intake policy boundary

Implemented in Java:

- `KNOWN / UNKNOWN / CONFLICT / MISSING` intake knowledge states.
- conflict clarification takes precedence over ordinary follow-ups;
- symptom-specific safety context is selected before generic intake fields;
- already-known facts are not re-asked unless conflicting;
- core onset/severity/pattern/associated-symptom coverage;
- symptom-specific context for chest, abdominal, headache and skin presentations;
- semantic follow-up intents are separated from spoken wording so the future voice model can realize the selected intent naturally in Hindi/Hinglish;
- model-proposed intents cannot override mandatory safety/clarification intent and diagnosis/prescribing/treatment intents are rejected.

This is not a fixed visible questionnaire. The Java policy selects the next missing semantic intent from the current structured state; the future model realizes one natural conversational question at a time.

## Clinical fact authority boundary

Implemented `ClinicalFactValidator`:

- Python/model output is only a **candidate**.
- only an allowlisted set of patient-reported intake fields is accepted;
- diagnosis and treatment fields are not accepted;
- patient turn evidence is mandatory;
- model + conversation-policy provenance is mandatory;
- source must be `PATIENT_REPORTED` for voice-runtime candidates.

## Specialization routing migration

The existing deterministic routing dataset is copied unchanged into the Java module as the migration baseline. `SpecializationRoutingEngine` ports the existing TypeScript matching/scoring behavior, including:

- negation handling;
- historic/family-history emergency suppression;
- singular/plural and one-edit fuzzy matching;
- emergency rules taking precedence;
- conservative internal-medicine/pediatrics fallback;
- confidence explicitly labelled `heuristic_match_not_probability`;
- clinician-confirmation language;
- no generative-model direct doctor assignment.

Representative TypeScript parity scenarios now pass as Java tests: orthopaedics, dermatology, neurology, urology, nephrology, endocrinology, dentistry, child routing, vague fallback, negation/history and emergency escalation.

`IntakeRoutingAdapter` is the boundary from **validated structured intake** to the deterministic router. The voice model does not call the routing engine with an invented diagnosis.

## Test checkpoint

At this checkpoint:

- Java Spring module: 24 tests passing.
- Web module: 75 tests passing after adding v2 session/voice-control/realtime-event/UI state tests.
- Voice benchmark/runtime: 11 tests passing.
- Web TypeScript typecheck and ESLint pass after realtime-control wiring.
- Root regression rerun passes: existing Express API 312 tests passed with 10 database integration tests skipped for missing DB credentials; web 75 tests passed.
- The document-fixture generator touched its manifest during the root regression run; that generated diff was restored immediately.

## Accumulated context re-check

- Phase 1 repository architecture respected: YES.
- Phase 2 v1 fallback deleted or broken intentionally: NO.
- Phase 3 coexistence (`patient -> Spring`, `doctor -> Express`) preserved: YES.
- Phase 4 Human-1 declared benchmark-approved: NO.
- Finalized patient UI redesigned: NO.
- Doctor-dashboard source modified: NO.
- Pure English patient mode added to v2: NO.
- AI granted diagnosis/prescribing authority: NO.
- AI granted direct doctor-assignment authority: NO.
- PostgreSQL replaced: NO.
- Flyway run against shared schema before handoff: NO.
- Legacy Whisper/browser TTS/Express/Prisma deleted: NO.
- Figma touched: NO.

## Remaining hard blockers

1. A suitable GPU environment is still required to run the real Human-1/Hinglish/full-duplex Phase 4 benchmark.
2. An isolated PostgreSQL environment is required to validate JPA mappings and execute the Prisma -> Flyway handoff rehearsal.
3. The realtime media service cannot be accepted end-to-end until the real voice runtime is benchmarked.

All other work should continue model-independently while these gates remain explicit.
