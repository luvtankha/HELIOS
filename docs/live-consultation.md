# Native Hindi consultation

## Behavior

1. The patient consents, then describes the symptom first. HELIOS speaks Hindi and understands Hindi/Hinglish. The speech bubble contains generated Hindi captions and disappears when audio playback ends; the active avatar shows a listening glow.
2. The native model calls `record_turn` with identity and clinical facts. Python attaches patient-reported provenance and submits the whole turn to Java before another question is selected.
3. Java validates fields, knowledge states, confidence and evidence. Clinical values use English/Roman Hinglish. Explicit uncertainty is retained, conflicts prompt clarification, and identity is collected without repeating the symptom question.
4. The follow-up policy prioritizes symptom-specific context. Answered fields, including explicit unknown answers, are not repeatedly requested. The model phrases the approved question naturally in Hindi.
5. Completed intake persists a specialization and rationale, selects an active clinician accepting that specialty, grants workspace access and marks the visit ready for review.
6. The patient sees the clinician handoff and completion after the final audio finishes. The doctor sees the concern, facts, uncertainty/evidence and routing decision.

The gateway does not write raw patient audio. Spoken captions are transient UI data; structured facts are durable records. The model does not prescribe or make the final clinical decision.

## Connections

| Connection | Purpose |
| --- | --- |
| Browser → Java `/api/v2` | Session proof, consent, voice ticket, reconnect and events |
| Browser ↔ Python `/v1/stream` | Signed ticket followed by 24 kHz mono PCM16 and UI controls |
| Python ↔ Gemini Live | Native audio and structured function calls |
| Python → Java `/internal/v2/voice-runtime` | Authenticated context retrieval and atomic turn persistence |
| Java → PostgreSQL | Identity, intake, routing, visit and doctor assignment |
| Doctor browser → Express `/api/v1` | Password sign-in and assigned patient workspace |

`HELIOS_VOICE_RUNTIME_URI` is Java's internal gateway address. `HELIOS_VOICE_PUBLIC_URI` must be reachable by the browser; these differ in Docker. Next.js public URLs must be set at build time because they are compiled into the client and CSP.

## Runtime and cost

The default is `gemini-live` with `gemini-3.8-live`, configured through private `GEMINI_API_KEY`. [Google's pricing](https://ai.google.dev/gemini-api/docs/pricing) lists free-tier native audio input/output, subject to quotas (checked October 4, 2026). Use a project with billing disabled to avoid paid usage. HELIOS cannot inspect billing from the key. Quota exhaustion produces an unavailable/recovery state without switching providers.

Human-1 remains experimental and requires CUDA resources plus measured benchmarks. The current workstation's 16 GB RAM and integrated Radeon graphics cannot run that adapter as configured; it is not active.

## Recovery and efficiency

- Reconnect requests a fresh ticket, uses bounded exponential retries and restores persisted clinical context.
- The control stream resumes after its last sequence. Replayed control captions cannot override native playback.
- A fixed-size PCM accumulator avoids repeatedly shifting sample arrays. Completion/disposal stops microphone tracks and releases audio nodes.
- Provider tasks are cancelled together and the SDK client closes on success or error.
- Intake matching, brief aggregation and timeline conflict grouping avoid repeated collection scans/copies.
- Routing selects a matching doctor with the smallest active workload.
- The measured live route adds about 9 kB of route JavaScript, with about 102 kB shared initial Next.js code.

## Database and doctors

The project-local database starts only with `HELIOS_LOCAL_DATABASE=true` and `127.0.0.1:55435/helios`. Initialization uses password authentication. Records remain under ignored `.local/postgres`; the system PostgreSQL instance is separate.

Flyway migrations include the shared baseline, voice sessions, facts, specialty catalog and per-doctor password hash. Existing Prisma-managed databases require a schema-ownership/baseline handoff before enabling Flyway on them.

`pnpm local:doctor` provisions `helios-local`, using a salted scrypt hash of the private access code. It accepts Internal Medicine referrals. Clinic deployments need their own doctor roster, credentials and specialties. With no matching doctor, intake is saved awaiting clinic assignment.

## Deployment and validation

`docker compose --env-file .env -f compose.v2.yml up --build` defines PostgreSQL, Next.js, Java, the doctor API, the voice gateway and Prometheus. Remote microphone use needs HTTPS/WSS and externally reachable public URLs. Docker is unavailable on this workstation, so local builds/service checks are the validated path; container execution remains untested.

The native roundtrip feeds model-generated synthetic Hindi PCM through the real Gemini gateway and checks symptom-first logging, identity, follow-up, durable completion and Hindi audio. The handoff check signs in with the configured doctor's password and retrieves the real workspace, also confirming anonymous access is denied.

Browser tests cover consent, responsive layout, captions during audio, listening, renewed-ticket reconnect, avatar handoff, completion and automated accessibility. These are software checks, not exhaustive clinical or accent/microphone benchmarks.

The stopped temporary validation database is in `../items to be deleted/native-voice-validation-postgres` for manual deletion. It is not a runtime dependency. The final checks and their limits are recorded in [the health report](health-check-2026-10-04.md).
