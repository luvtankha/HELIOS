# HELIOS v2 Phase 3 — contracts and coexistence architecture

This phase defines stable boundaries before Java, realtime media, or AI implementation begins. It does not change runtime behavior.

## Technology baseline for v2

- Frontend: existing Next.js/React application retained.
- Patient application backend: Java 21 + Spring Boot 4.1.x (initial implementation target: 4.1.1) with Maven Wrapper.
- Persistence: Spring Data JPA/Hibernate against the existing PostgreSQL database.
- Schema migration after handoff: Flyway.
- AI/voice runtime: Python/PyTorch service, versioned independently from the Java application.
- Java <-> AI control/structured-event protocol: protobuf + bidirectional gRPC stream.
- Browser realtime media transport candidate: WebRTC audio. Phase 4 must prove this against WebSocket streaming before the media transport is locked.
- Browser <-> Java application/control APIs: HTTPS JSON REST plus a versioned realtime control/event channel where needed.

## Coexistence architecture during patient migration

The unchanged doctor dashboard prevents an all-at-once Express removal. During the patient migration the system intentionally runs two application backends against one PostgreSQL database:

```text
                            PostgreSQL
                         (system of record)
                          /            \
                         /              \
              Spring Boot v2          Express v1
              patient backend       existing backend
                    ^                    ^
                    |                    |
             /api/v2/patient       /api/v1/doctor...
                    ^                    ^
                    |                    |
              Patient routes        Doctor routes
                  Next.js              Next.js

              Spring Boot v2
                    |
             gRPC control/events
                    |
              Python AI/voice
                    ^
                    |
        realtime media (candidate WebRTC)
                    |
             Patient browser
```

The browser always contacts Spring Boot first to create/authorize a voice session. If Phase 4 selects direct WebRTC to the voice service/media gateway, Java issues a short-lived, single-session media credential and remains the authoritative control/persistence service. The Python service never receives a reusable patient application credential and never becomes the source of authorization truth.

## Service ownership matrix

| Responsibility | Next.js patient UI | Spring Boot | Python AI/voice | PostgreSQL | Existing Express |
| --- | --- | --- | --- | --- | --- |
| Render finalized doctor-avatar UI | OWNER | - | - | - | - |
| Capture/play realtime audio | OWNER | session policy | media/model endpoint | - | - |
| Patient session authorization | token holder | OWNER | validates short-lived voice grant only | persistence | legacy until route cutover |
| Consent/profile/visit orchestration | client | OWNER | - | persistence | legacy until cutover |
| Voice-session lifecycle | client | OWNER | runtime participant | metadata | legacy clip path until cutover |
| Full-duplex model inference | media peer | policy/control | OWNER | minimal metadata only | - |
| Conversation context/model runtime | display | policy boundary | OWNER runtime | persisted structured state | legacy interview until cutover |
| Clinical fact acceptance/validation | display | OWNER | proposes candidates | OWNER data | legacy until cutover |
| Follow-up question selection | display | constraints/stopping policy | proposes/realizes next turn | state | legacy engine baseline |
| Red-flag deterministic policy | display/escalation UI | OWNER | may emit candidate signal | audit/state | legacy rules until cutover |
| Specialization routing decision | display | OWNER deterministic/policy engine | supplies structured facts only | decision/audit | legacy routing until cutover |
| Provider selection | client | OWNER authorization/transaction | no authority | visit/audit | legacy until cutover |
| Document upload | client | eventual OWNER | optional extraction helper only | document metadata/evidence | adapter/legacy during transition |
| Queue/check-in | client | eventual OWNER | no authority | queue state | legacy during transition |
| Doctor dashboard | - | no current UI change | - | shared read model | OWNER during patient migration |

## Browser -> Spring Boot REST contract

All new patient APIs live under `/api/v2`. Existing `/api/v1` remains untouched until each capability is cut over.

### Session

```text
POST /api/v2/patient-sessions
GET  /api/v2/patient-sessions/{sessionId}
PATCH /api/v2/patient-sessions/{sessionId}
POST /api/v2/patient-sessions/{sessionId}/submit
```

Representative create request:

```json
{
  "conversationLanguage": "hi-Hinglish"
}
```

Representative response:

```json
{
  "sessionId": "...",
  "sessionToken": "opaque-short-lived-proof",
  "status": "ACTIVE",
  "conversationLanguage": "hi-Hinglish",
  "visitId": null,
  "version": 1
}
```

The token is not stored in logs. Existing session ownership semantics must remain at least as strict as v1.

### Consent/profile/visit

```text
POST /api/v2/consents
POST /api/v2/patients
GET  /api/v2/patients/me
POST /api/v2/visits
GET  /api/v2/visits/{visitId}
```

These contracts should preserve existing IDs and semantic fields where practical so the doctor-side read path continues to understand the same records.

### Voice session

```text
POST   /api/v2/voice-sessions
GET    /api/v2/voice-sessions/{voiceSessionId}
POST   /api/v2/voice-sessions/{voiceSessionId}/resume
DELETE /api/v2/voice-sessions/{voiceSessionId}
```

Create request:

```json
{
  "patientSessionId": "...",
  "visitId": "...",
  "capabilities": {
    "bargeIn": true,
    "languageMode": "hi-Hinglish"
  }
}
```

Create response:

```json
{
  "voiceSessionId": "...",
  "state": "CONNECTING",
  "media": {
    "transport": "WEBRTC_CANDIDATE",
    "signalingUrl": "/api/v2/voice-sessions/.../signal",
    "credential": "single-use-short-lived-media-grant",
    "expiresAt": "..."
  },
  "conversation": {
    "languageMode": "hi-Hinglish",
    "doctorAvatarId": "lead-general"
  }
}
```

The transport field remains a candidate until Phase 4. The public REST shape intentionally hides model/provider implementation details from the frontend.

### Structured intake

```text
GET /api/v2/intake-sessions/{sessionId}
GET /api/v2/intake-sessions/{sessionId}/summary
```

The browser should not POST arbitrary AI-generated clinical facts as trusted state. Structured facts are accepted server-side from the authenticated AI-service stream only after schema/policy validation.

### Routing

Preserve the useful v1 semantics while moving the implementation to Java:

```text
POST /api/v2/patient/me/routing
GET  /api/v2/patient/me/providers?specialization=...
POST /api/v2/patient/me/routing/provider
```

The response continues to distinguish routing support from diagnosis and includes decision version, uncertainty band, emergency escalation flag, alternatives and clinician-review requirement.

## Realtime browser event contract

The UI state must describe the live consultation without exposing internal STT/LLM/TTS stages.

Public UI events:

```text
session.ready
doctor.speaking.started
doctor.speaking.caption
doctor.speaking.ended
patient.speech.started
patient.speech.ended
doctor.handoff
conversation.warning
conversation.completed
connection.degraded
connection.reconnecting
connection.restored
session.ended
```

Representative event envelope:

```json
{
  "eventId": "uuid",
  "voiceSessionId": "...",
  "sequence": 42,
  "type": "doctor.handoff",
  "occurredAt": "...",
  "payload": {
    "fromAvatarId": "lead-general",
    "toAvatarId": "specialist-female"
  }
}
```

The speech bubble consumes `doctor.speaking.caption` as a visual representation of generated speech. It is not an editable transcript and is not persisted as a patient-confirmed fact merely because it was displayed.

Internal model events such as partial recognition tokens, model logits, prompt construction, or TTS chunk states are not browser product events.

## Barge-in contract

The user experience requires interruption to be an explicit lifecycle, not a UI trick:

```text
AI audio playing
  -> patient speech onset detected
  -> media layer immediately attenuates/stops queued AI audio
  -> voice runtime receives cancel_generation(turnId)
  -> already-played assistant audio boundary is recorded
  -> patient audio continues without reopening a session
  -> conversation engine incorporates the interruption
  -> next assistant turn is generated from the updated context
```

Acceptance contract: cancellation is idempotent, stale assistant audio cannot resume after a successful interruption, and reconnect does not replay cancelled audio.

## Java <-> Python AI service contract

Use protobuf/gRPC because both Java and Python have first-class bidirectional streaming support and the interface can be generated from one schema.

Proposed service surface:

```proto
service VoiceRuntime {
  rpc Health(HealthRequest) returns (HealthResponse);
  rpc GetCapabilities(CapabilitiesRequest) returns (CapabilitiesResponse);
  rpc Conversation(stream RuntimeMessage) returns (stream RuntimeMessage);
}
```

Logical message kinds:

```text
Java -> Python
  session_start
  policy_context
  patient_profile_context (minimum necessary fields only)
  document_fact_context (bounded structured facts, not arbitrary doctor notes)
  cancel_generation
  session_end

Python -> Java
  runtime_ready
  patient_turn_boundary
  assistant_turn_started
  assistant_caption_delta
  assistant_turn_ended
  clinical_fact_candidate
  missing_information_state
  red_flag_candidate
  conversation_complete_candidate
  runtime_metric
  runtime_error
```

Audio frames travel over this gRPC stream only if Phase 4 selects Java-mediated media. If Phase 4 selects direct WebRTC to the Python/media service, gRPC carries control and structured events while audio stays on the media plane.

Every structured candidate from Python includes:

```json
{
  "field": "duration",
  "value": "since this morning",
  "knowledgeState": "YES",
  "confidence": "MEDIUM",
  "source": "PATIENT_REPORTED",
  "evidenceTurnIds": ["turn-12"],
  "model": "...",
  "modelVersion": "...",
  "conversationPolicyVersion": "..."
}
```

Java validates allowed fields/types, session ownership, sequence/order, evidence references, and safety invariants before persistence.

## Conversation-intelligence boundary

The v2 engine is hybrid rather than giving a generative model unrestricted control.

```text
Patient audio
  -> voice model/runtime
  -> candidate semantic facts + conversational context
  -> deterministic schema/policy validator (Java)
  -> intake state: KNOWN / UNKNOWN / CONFLICT / MISSING
  -> follow-up policy
       - hard safety questions / red-flag requirements
       - required intake coverage
       - conflict clarification
       - AI-ranked contextually natural next question
  -> voice runtime realizes the selected intent naturally in Hindi/Hinglish
```

The AI may propose the next question/wording, but Java owns stopping criteria and non-negotiable safety/coverage constraints. The engine must avoid re-asking facts already captured with sufficient confidence unless there is a conflict or clinically relevant ambiguity.

## Specialization-routing boundary

Do not implement routing as `LLM -> doctor specialty`.

Use:

```text
validated structured intake facts
  -> deterministic emergency/red-flag policy
  -> versioned specialization mapping/rules
  -> conservative confidence/ambiguity handling
  -> general-clinician fallback when uncertain
  -> routing decision persisted with input hash + rule/dataset version
  -> optional provider list filtered by active/accepting configuration
```

The existing TypeScript routing engine is the behavioral baseline for the Java port. AI-generated diagnosis labels, unreviewed document text and doctor-only notes remain excluded from routing input.

## Database ownership and Flyway handoff

### During coexistence

- Existing Prisma migrations remain the historical record for v1.
- Spring/JPA maps to the current tables without renaming/recreating them.
- Hibernate schema auto-generation is disabled for shared environments; validation is allowed.
- New v2 schema changes are additive and must remain readable by the unchanged Express/doctor path where it touches shared tables.

### Flyway handoff

Do not translate and rerun every old Prisma migration against existing databases. Instead:

1. Provision an isolated database from the current Prisma migration chain.
2. Capture/verify the resulting schema fingerprint.
3. Establish that schema as the Flyway baseline/handoff point.
4. Add the first v2 Flyway migration after the baseline version.
5. Verify both Java/JPA and existing Express/Prisma against the migrated schema.
6. Only then designate Flyway as owner of new migrations.

Prisma schema files remain present while Express needs Prisma. Any new shared-table change must be reflected in Prisma's model view as needed for the unchanged Express runtime, but only one migration system is allowed to execute the physical change after handoff.

## New v2 persistence concepts

Prefer additive tables/columns rather than overloading `VoiceInteraction` with a fundamentally different streaming lifecycle. Candidate concepts:

```text
RealtimeVoiceSession
  id
  patientSessionId
  visitId
  status
  languageMode
  transport
  modelProvider
  modelName
  modelVersion
  policyVersion
  startedAt / endedAt
  terminationReason
  rawAudioRetained = false

ConversationTurn
  id
  realtimeVoiceSessionId
  sequence
  speaker (PATIENT / ASSISTANT)
  startedAt / endedAt
  interrupted
  languageMetadata
  textEvidence?       # only if policy permits; not raw audio

ClinicalFactCandidate / accepted structured fact linkage
  session/turn evidence references
  field/value/state/confidence/source
  model + policy provenance

ConversationEvent
  sequence
  type
  minimal metadata
  occurredAt
```

Exact physical schema waits until the Java/JPA mapping phase and database integration environment are available. Raw audio is not stored by default.

## Reconnect and failure semantics

### Browser network loss

- UI enters a neutral reconnecting state using doctor-character state, not a fake processing transcript.
- Java keeps the logical voice session resumable for a bounded grace period.
- Resume request carries `voiceSessionId` and last acknowledged event sequence.
- Server replays only durable control events after that sequence; never replay cancelled audio.
- If media cannot be resumed safely, terminate that media instance and create a new media attachment under the same patient intake session.

### Python/model failure

- Python emits a typed runtime error/health failure.
- Java marks the realtime voice session degraded/failed and preserves already accepted structured facts.
- The system does not fabricate a model response.
- Legacy clip-STT fallback may remain available during migration/testing, but it must not be presented as equivalent full-duplex behavior.

### Java/database failure

- Python must not continue creating authoritative clinical state while Java is unavailable.
- Model runtime may finish/cancel the current audio turn, then stop accepting new clinical actions until authority is restored.
- Database writes use idempotency/event IDs so reconnect cannot duplicate accepted facts or routing decisions.

## Security contract

- TLS for browser/API and service-to-service transport outside a trusted local development environment.
- Browser holds patient session proof; Python receives only a scoped, expiring voice grant.
- Java authenticates the Python service separately from patient identity.
- No reusable database credential is exposed to browser or Python model code.
- Origin/CORS rules remain explicit; state-changing APIs require the same-or-stronger protections as v1.
- Logs use request/session correlation IDs and avoid raw patient speech/text unless a specific protected diagnostic policy permits it.
- Secrets come from environment/secret manager, never committed files.
- File upload and document security constraints remain independent from the voice model.

## Proposed Spring Boot module/package structure

```text
backend-java/
  pom.xml
  mvnw / mvnw.cmd
  src/main/java/com/helios/
    HeliosPatientApplication.java
    config/
    security/
    patient/
      api/
      application/
      domain/
      persistence/
    consent/
    visit/
    intake/
    voice/
      api/
      application/
      grpc/
      realtime/
      persistence/
    routing/
    documents/
    queue/
    audit/
    common/
  src/main/resources/
    application.yml
    db/migration/
  src/test/
```

Doctor-dashboard packages are deliberately absent from the new Java change scope at this stage.

## Proposed Python service structure

```text
voice-service/
  pyproject.toml
  src/helios_voice/
    app.py
    config.py
    grpc_server.py
    contracts/
    runtime/
      session.py
      cancellation.py
      turn_manager.py
    media/
      webrtc.py        # candidate, proven in Phase 4
      codecs.py
    models/
      adapter.py
      human1_moshi.py  # candidate adapter, not yet locked
    conversation/
      context.py
      fact_candidates.py
      followup.py
      safety.py
    observability/
  tests/
```

Model-specific code stays behind `models/adapter.py` so a failed Human-1/Moshi spike does not force application/backend redesign.

## Final doctor-dashboard handoff contract

The current doctor dashboard is unchanged during all patient-side implementation phases. The completed patient system must write/read the same shared clinical concepts the doctor side already consumes: patient, visit, accepted interview/clinical facts, documents/evidence, timeline/risk signals, routing decision, queue state and clinical brief/provenance.

Only after patient v2 is feature-complete and validated do we perform a separate doctor integration phase. That phase can either point the existing doctor frontend at equivalent Java read APIs or migrate doctor backend services incrementally. Until then, Express remains available for doctor APIs and Prisma remains available for those Express services.

## Phase 3 acceptance gates

- New APIs are namespaced and can coexist with `/api/v1`: PASS by design.
- Doctor dashboard has no required code change to start patient migration: PASS by design.
- Java owns business/security/persistence authority; Python owns model runtime only: PASS.
- AI cannot directly assign a doctor or write trusted clinical facts without Java validation: PASS.
- Existing deterministic routing safety behavior has a defined migration path: PASS.
- PostgreSQL remains the system of record with additive-first migration: PASS.
- Reconnect, cancellation and idempotency semantics are defined before implementation: PASS.
- Media transport remains explicitly unfinalized until measured Phase 4 evidence: PASS.

## Context re-check

- Locked patient UI changed: NO.
- Doctor-dashboard source/runtime changed: NO.
- Hindi/Hinglish target preserved: YES.
- Full-duplex/barge-in requirement represented in contracts: YES.
- Diagnosis/treatment authority added: NO.
- Existing Phase 1 cleanup candidates removed: NO.
- Phase 2 source baseline invalidated: NO; this phase adds documentation only.
- Figma touched: NO.

Phase 4 may now perform a technical spike against these contracts without committing the product to a model or media transport prematurely.
