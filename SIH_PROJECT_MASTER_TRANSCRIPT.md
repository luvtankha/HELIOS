# HELIOS — SIH Project Master Transcript

**Study rule:** say what the code does; do not claim diagnosis, production identity, or clinical validation.

## 1. My project in 60 seconds

1. Patient opens `/patient` in the Next.js web app.
2. `PatientFlowProvider` creates/resumes a signed patient session.
3. Patient gives consent, details, language, and a complaint.
4. Optional `ListeningPage` records voice and sends it to `/api/v1/voice/transcribe`.
5. `VoiceService.transcribe()` converts audio to text through the configured speech provider.
6. Patient confirms or edits the transcript before it becomes the complaint/answer.
7. `InterviewService` runs `InterviewEngine` to ask deterministic follow-up questions.
8. Optional documents go through private storage, OCR, extraction, and review states.
9. Patient reviews data; optional `RoutingService` suggests a department and available doctor.
10. `QueueService.checkIn()` creates a PostgreSQL waiting token.
11. Doctor signs in to `/doctor`, sees only assigned/authorized patients, and opens a workspace.
12. Doctor reviews timeline, documents, What Changed, and Clinical Brief.
13. Doctor verifies/corrects facts and moves the queue token through consultation.
14. PostgreSQL stores the patient, visit, source, audit, queue, and verification history.

## 2. Complete project execution — major steps

### Step 01 — Start command

`pnpm demo:dev` → `scripts/run-with-demo-env.mjs` → loads ignored `.env`, forces the local demo database/profile, then runs `dev:services`.

**Next:** shared DTOs build; web and API start together.

### Step 02 — API starts

`apps/api/src/server.ts` → `createApp()` in `apps/api/src/app.ts` → mounts `/api/v1` routes.

**Output:** Express on `PORT` (normally 5000). **Why:** one trusted API boundary.

### Step 03 — API protects requests

`app.ts` → `requestContext`, `requestLogger`, Helmet, CORS, JSON limit, `mutationOriginGuard`, route rate limits, Zod validators.

**If failed:** `errorHandler` returns a safe API error; no raw stack is sent to the browser.

### Step 04 — Database is ready

`apps/api/src/repositories/database.ts` → Prisma client → PostgreSQL from `DATABASE_URL`.

**Next:** repositories can use parameterized Prisma queries.

### Step 05 — Patient UI loads

`apps/web/src/app/patient/page.tsx` → `PatientFlowProvider` in `apps/web/src/providers/patient-flow-provider.tsx`.

**Output:** browser-side draft plus session token in `sessionStorage`; clinical state is still validated by API.

### Step 06 — Session begins

`patientApi.createSession()` → `POST /api/v1/patient-sessions` → `PatientFlowService.createSession()`.

**Writes:** `PatientSession`; **returns:** signed `x-session-token` proof.

### Step 07 — Consent and patient record

`/patient/consent` + `/patient/details` → `POST /consents`, `POST /patients`.

`PatientFlowService.recordConsent()` and `createPatient()` create `ConsentRecord`, `PatientProfile`, and `Visit`.

### Step 08 — Complaint or voice input

`/patient/complaint` stores typed concern; `/patient/listening` uses `useVoiceRecorder()`.

`voiceService.recordAndTranscribe()` → `POST /api/v1/voice/transcribe` with audio and patient proof.

### Step 09 — Speech conversion

`VoiceService.transcribe()` validates session ownership, duration, MIME/signature, and language.

It creates `VoiceInteraction` → configured provider transcribes → patient confirms/edits → transcript is usable.

### Step 10 — Follow-up interview

`apps/web/src/app/patient/interview/page.tsx` → `interviewService.create()`/`get()`.

`InterviewService.create()` → `InterviewEngine.initialize()` → stores `Interview` state and current question.

### Step 11 — Answer confirmation

`InterviewService.respond()` produces a preview; `confirm()` updates `InterviewResponse` and interview state.

**Why:** no spoken or typed answer becomes a confirmed structured fact without patient confirmation.

### Step 12 — Optional document

`/patient/documents` → `POST /api/v1/documents` → upload middleware → `DocumentService.upload()`.

**Next:** private path, `MedicalDocument`, then `process()` runs configured OCR and rule-based extraction.

### Step 13 — Patient review

`ReviewPage` → `PatientFlowProvider.saveInterview()` → saves complaint/progress.

**Writes:** `ClinicalHistory`; **next:** routing and/or check-in.

### Step 14 — Specialization routing (optional)

`SpecializationRoutingCard` → `POST /patient/me/routing` → `RoutingRepository.assess()` → `routeSpecialization()`.

**Output:** department, alternatives, confidence band, and draft emergency escalation; never diagnosis.

### Step 15 — Provider choice

`POST /patient/me/routing/provider` → `RoutingService.select()`.

**Writes:** `Visit.preferredDoctorId` and `AuditLog`; only active, classified, accepting real doctors qualify.

### Step 16 — Token/check-in

`PatientFlowService.submitSession()` → optional emergency gate → `QueueService.checkIn()`.

`QueueRepository.checkIn()` uses a serializable transaction to create `QueueEntry`, `QueueEvent`, token number, and visit status.

### Step 17 — Waiting screen

`/patient/waiting` polls `GET /patient/me/queue-status`.

**Next:** it shows waiting/called/consultation state; there is no WebSocket or SSE.

### Step 18 — Doctor sign-in

`/doctor/login` → `POST /doctor-sessions` → `ComparisonService.signIn()`.

**Output:** signed doctor proof saved by `DoctorAuthProvider`; this is demo-code login, not production identity.

### Step 19 — Doctor dashboard

`/doctor` → `GET /doctor/dashboard` → `DoctorDashboardService.dashboard()`.

**Reads:** authorized queue, metrics, notifications, and patient summaries.

### Step 20 — Doctor workspace

`/doctor/patients/[patientId]` → `GET /doctor/patients/:patientId/workspace`.

`DoctorDashboardService.workspace()` checks active role/assignment before returning permitted clinical data.

### Step 21 — Timeline and change summary

`TimelineService` rebuilds normalized events; `ComparisonService` compares visit snapshots.

**Output:** source-labelled timeline and What Changed; neither is a diagnosis.

### Step 22 — Clinical Brief

`ClinicalBriefService` → `ClinicalBriefBuilder` → versioned `ClinicalBrief` with evidence references.

**Next:** doctor reviews a concise, traceable snapshot.

### Step 23 — Doctor verification

`VerificationService` changes verification status only after doctor action.

**Writes:** `DoctorVerification`, audits, and dependent stale/rebuild states when needed.

### Step 24 — Queue control

`OperationalQueue` → `/doctor/queue/call-next` or `/doctor/tokens/:id/:action` → `QueueService`.

**Output:** transactional `WAITING → CALLED → IN_CONSULTATION → COMPLETED` actions.

### Step 25 — Demo reset

`pnpm demo:reset` → `reset-demo.ts` → seed → `verify-demo.ts`.

**Scope:** guarded local synthetic `helios_sih_demo`, never real records.

## 3. Feature transcripts

### Voice intake

1. Patient speaks → `apps/web/src/app/patient/listening/page.tsx`.
2. `useVoiceRecorder()` captures browser audio.
3. `voiceService.recordAndTranscribe()` sends multipart audio.
4. `POST /voice/transcribe` → `VoiceService.transcribe()` validates and calls configured provider.
5. `VoiceInteraction` stores metadata/transcript state; audio is not retained by this service.
6. Patient confirms/edits → complaint or interview answer.

**Judge:** “Voice is optional; confirmation keeps speech recognition from silently changing patient data.”

### Adaptive interview

1. `InterviewPage` waits for signed-session validation.
2. `POST /interviews` → `InterviewService.create()`.
3. `InterviewEngine` picks the next deterministic question graph node.
4. `POST /:id/response` previews interpretation.
5. `POST /:id/confirm` persists response/state.
6. `complete()` writes summary to `ClinicalHistory`.

**Judge:** “Questions are deterministic; optional NLU structures an answer but is schema-checked.”

### Document processing

1. Patient uploads PDF/image → `receiveDocument` validates bounds/signature.
2. `DocumentService.upload()` stores bytes outside public web assets.
3. `process()` selects local/mock OCR.
4. Heuristic classifier + rule-based extractor create `DocumentFact` candidates/evidence.
5. Ambiguous content stays review-required.
6. Doctor/patient confirmation endpoints control acceptance.

**Judge:** “Document extraction is conservative and evidence-linked, not an autonomous diagnosis engine.”

### Routing and queue

1. `SpecializationRoutingCard` requests assessment.
2. `routeSpecialization()` evaluates versioned DB mappings and emergency drafts.
3. Patient may choose a listed existing doctor.
4. `RoutingService.select()` stores preference/audit.
5. `QueueRepository.checkIn()` assigns preference in its existing transaction.
6. Doctor queue shows only allowed patients.

**Judge:** “Routing is deterministic intake support; it is not a booking or clinical triage system.”

### Doctor workspace

1. `DoctorAuthProvider.signIn()` gets doctor proof.
2. `DoctorDashboardService` verifies active role and assignment.
3. Workspace reads facts, documents, timeline, brief, comparisons, and notes.
4. Doctor verifies/corrects through `VerificationService`.
5. Queue actions update visit/token state transactionally.

### Multilingual and AYUSH

1. `LanguageService` provides English/Hindi registry, detection, normalization, and bounded translation helpers.
2. `InterviewEngine` localizes questions.
3. `AyushService` records patient/doctor-reported AYUSH data with source and review status.
4. It does not validate safety, efficacy, or interactions.

## 4. What happens next? — fast chains

`Patient voice` → `ListeningPage` → `voiceService` → `/voice/transcribe` → `VoiceService` → provider → `VoiceInteraction` → patient confirms → interview/complaint.

`Confirmed answer` → `InterviewService.confirm()` → `InterviewResponse` + `Interview` → `complete()` → `ClinicalHistory` → review/routing.

`Upload` → `receiveDocument` → `DocumentService` → private storage/OCR/extractor → `MedicalDocument` + `DocumentFact` → review/workspace.

`Review submit` → `PatientFlowService.submitSession()` → `QueueService.checkIn()` → `QueueEntry`/`QueueEvent` → waiting poll → doctor queue.

`Doctor action` → doctor proof → assignment check → service → Prisma transaction → audit/status → refreshed dashboard.

## 5. Important file map

| File | Controls | Importance |
|---|---|---|
| `apps/api/src/server.ts` | API process entry | CRITICAL |
| `apps/api/src/app.ts` | middleware and route registration | CRITICAL |
| `apps/api/prisma/schema.prisma` | PostgreSQL model contract | CRITICAL |
| `apps/api/src/services/patient-flow-service.ts` | session, consent, patient, submission | CRITICAL |
| `apps/api/src/services/voice-service.ts` | secure transcription lifecycle | HIGH |
| `apps/api/src/services/interview-service.ts` | interview lifecycle | CRITICAL |
| `apps/api/src/services/document-service.ts` | document lifecycle | HIGH |
| `apps/api/src/queue/queue-service.ts` | token/queue actions | CRITICAL |
| `apps/api/src/routing/routing-engine.ts` | deterministic department choice | HIGH |
| `apps/api/src/doctor-dashboard/doctor-dashboard-service.ts` | authorized doctor workspace | CRITICAL |
| `apps/web/src/providers/patient-flow-provider.tsx` | patient browser state/API calls | CRITICAL |
| `apps/web/src/app/patient/listening/page.tsx` | voice UX | HIGH |
| `apps/web/src/app/patient/interview/page.tsx` | interview UX | CRITICAL |
| `apps/web/src/app/patient/review/page.tsx` | final patient review/submit | CRITICAL |
| `apps/web/src/app/doctor/page.tsx` | doctor dashboard | HIGH |
| `apps/web/src/providers/doctor-auth-provider.tsx` | doctor proof state | HIGH |
| `scripts/run-with-demo-env.mjs` | isolated demo guard | SUPPORT |
| `apps/api/prisma/seed.ts` | synthetic demo data | SUPPORT / DEMO DATA |

## 6. Important function/class map

`createApp()` — `apps/api/src/app.ts` → mounts protections/routes → returns Express app.

`PatientFlowService.createSession()` — `patient-flow-service.ts` → creates session + signed patient proof.

`VoiceService.transcribe()` — `voice-service.ts` → validates audio/session → returns transcript interaction.

`InterviewService.create/respond/confirm/complete()` — `interview-service.ts` → controls interview state.

`DocumentService.upload/process()` — `document-service.ts` → stores/processes document safely.

`routeSpecialization()` — `routing-engine.ts` → returns deterministic department result/limitations.

`RoutingService.select()` — `routing-service.ts` → validates provider → saves visit preference/audit.

`QueueService.checkIn/callNext/act()` — `queue-service.ts` → controls queue transitions.

`DoctorDashboardService.dashboard/workspace()` — `doctor-dashboard-service.ts` → returns authorized doctor view.

`ClinicalBriefService` — `clinical-brief-service.ts` → creates/reviews evidence-linked brief.

`VerificationService` — `verification-service.ts` → records doctor verification decisions.

## 7. Important data

### `PatientSession`

Created by `createSession()` → holds flow progress, patient/visit links, language → signed proof identifies it on API calls.

### `Visit`

Created with patient details → holds consultation status, complaint/history, token, preferred routed doctor → used by queue/workspace.

### `Interview` + `InterviewResponse`

Created by `InterviewService` → holds question state and patient-confirmed answers → summarized into `ClinicalHistory`.

### `VoiceInteraction`

Created by `VoiceService.transcribe()` → transcript, provider, confidence, confirmation state → feeds only confirmed text onward.

### `MedicalDocument` + `DocumentFact`

Created by `DocumentService` → private file metadata, OCR/extraction candidates, evidence/review state → visible to authorized workspace.

### `QueueEntry`

Created by `QueueRepository.checkIn()` → token/status/doctor → used by waiting screen and doctor queue.

### `RoutingDecision`

Created by `RoutingRepository.assess()` → sanitized routing input/result/version → doctor audit only.

## 8. Database in simple language

`User` → doctors/admins; `specializationId` + `acceptingRouting` control routing availability.

`PatientProfile` → patient identity/demographics; links sessions, visits, documents, timeline.

`PatientSession` → temporary intake journey and consent link.

`Visit` → one consultation instance; links history, queue, interview, routing decision.

`ClinicalHistory` → patient-reported structured visit summary.

`Interview` / `InterviewResponse` → question state and confirmed answers.

`VoiceInteraction` → speech-processing trace.

`MedicalDocument` / `DocumentFact` → document metadata, extracted candidates, evidence.

`TimelineEvent` / `PatientSnapshot` / `Comparison` / `ClinicalBrief` → longitudinal doctor-review material.

`DoctorVerification` / `AuditLog` → doctor decision trace and sensitive action history.

`QueueEntry` / `QueueEvent` / `QueueCounter` → waiting token state and actions.

**One request:** `/patient/review` → `submitSession()` → `checkIn()` → serializable Prisma transaction → `QueueEntry` + `QueueEvent` + `Visit` status → patient gets token.

## 9. AI system — exact boundary

`Speech` → configured `SpeechProvider` (`mock`, `local`, or optional OpenAI) → transcript → patient confirmation.

`NLU` → `ClinicalNLUService` → configured rules/default or optional OpenAI provider → Zod-bounded answer interpretation → deterministic interview state.

`OCR` → `MockOCRProvider` or `LocalOCRProvider` → page text → heuristic classifier + rule-based extractor → review candidates.

`Not AI` → login, authorization, queue ordering, routing, comparison, brief assembly, verification, and database writes are deterministic code.

`SafetyEngine` → **NOT IMPLEMENTED**; existing `RiskSignal` records are storage/projection, not live safety detection.

## 10. API map — judge essentials

`POST /api/v1/patient-sessions` → `PatientFlowService.createSession()` → signed patient session.

`POST /api/v1/voice/transcribe` → `VoiceService.transcribe()` → validated transcript interaction.

`POST /api/v1/interviews` → `InterviewService.create()` → first question/state.

`POST /api/v1/interviews/:id/response` → preview structured answer.

`POST /api/v1/interviews/:id/confirm` → persists confirmed response.

`POST /api/v1/documents` → `DocumentService.upload()` → private document record.

`POST /api/v1/patient/me/routing` → `RoutingService.assess()` → department support.

`POST /api/v1/patient-sessions/:id/submit` → `PatientFlowService.submitSession()` → `QueueService.checkIn()` → waiting token.

`POST /api/v1/doctor-sessions` → `ComparisonService.signIn()` → doctor proof.

`GET /api/v1/doctor/dashboard` → `DoctorDashboardService.dashboard()` → authorized queue/dashboard.

`GET /api/v1/doctor/patients/:patientId/workspace` → authorized patient workspace.

`POST /api/v1/doctor/tokens/:tokenId/:action` → `QueueService.act()` → queue lifecycle action.

## 11. Frontend map

`/patient` → welcome → `flow.start()` → session.

`/patient/language`, `/consent`, `/details` → patient-flow API → session/patient/visit.

`/patient/complaint` → typed concern or `/patient/listening`.

`/patient/interview` → `interviewService` → questions/confirmation.

`/patient/documents` → document upload/process/review.

`/patient/review` → routing card + submit.

`/patient/waiting` → poll queue status.

`/doctor/login` → demo proof; `/doctor` → dashboard/queue.

`/doctor/patients/[patientId]` → workspace, brief, verification, timeline, AYUSH, What Changed.

## 12. Backend map

`Request` → `app.ts` middleware → route → controller → domain service → repository/provider → Prisma/PostgreSQL → serializer → JSON response.

Example: `POST /voice/transcribe` → `voice.ts` → `VoiceController` → `VoiceService` → voice repository + speech provider → `VoiceInteractionDto`.

## 13. Security — what protects what

`SessionProofService` / `DoctorProofService` → HMAC signed, typed, expiring proofs.

`service ownership checks` → patient can access only own session/visit; doctor needs role + assignment unless coded admin.

`Zod + Multer validation` → rejects malformed JSON/params/files.

`Prisma` → parameterized database access; avoids raw SQL construction.

`Helmet + CORS + mutationOriginGuard` → browser-origin/header hardening.

`rate-limit middleware` → limits session/login/write/document/queue requests in-process.

`LocalPrivateDocumentStorage` + authorized content route → avoids public document URLs/path traversal.

`request logger/error handler` → request IDs, redaction/safe errors; no claim of immutable audit/central monitoring.

## 14. Failure paths

`Speech fails` → `VoiceService` marks interaction failed → UI offers retry/type fallback.

`Interview request fails` → `InterviewPage` keeps browser state; retry re-runs initialization after signed-session validation.

`OCR/extraction fails` → document gets failed/review state; no automatic verified clinical fact.

`Bad/expired proof` → `AppError` 401/403 → UI returns to safe start/sign-in path.

`DB/transaction failure` → service/repository throws → `errorHandler` safe response; token mutation does not partially claim success.

`Routing emergency draft match` → routine queue submission is blocked; user sees urgent-evaluation message.

## 15. Important configuration

`DATABASE_URL` → PostgreSQL location; never show its value.

`PORT`, `WEB_ORIGIN`, `NEXT_PUBLIC_API_URL` → API/network location.

`SESSION_TOKEN_SECRET`, TTLs → proof signing and expiry.

`SPEECH_PROVIDER`, `SPEECH_LOCAL_*`, `SPEECH_API_KEY` → speech adapter; key remains server-only.

`CLINICAL_NLU_PROVIDER`, `AI_API_KEY`, `AI_MODEL` → rules/optional OpenAI NLU.

`DOCUMENT_OCR_PROVIDER`, `STORAGE_PATH` → OCR mode and private storage.

`ENABLE_SPECIALIZATION_ROUTING`, `ENABLE_AYUSH`, `ENABLE_*` → feature gates.

`DEMO_MODE`, `ALLOW_DEMO_SEED`, `DOCTOR_DEMO_ACCESS_CODE` → synthetic demo only.

## 16. What happens when I run it?

`pnpm dev` → local env wrapper → shared build → Next dev on 3000 + API watcher on 5000.

`pnpm demo:dev` → demo wrapper → forces local `helios_sih_demo` profile → same web/API processes.

`pnpm demo:reset` → deletes/reseeds only guarded synthetic records → verifies expected baseline.

## 17. One complete end-to-end journey

1. Patient opens `/patient` → `PatientFlowProvider.start()`.
2. API creates `PatientSession` → returns signed proof.
3. Patient accepts consent → `ConsentRecord`.
4. Patient details → `PatientProfile` + `Visit`.
5. Patient records voice → `VoiceService.transcribe()`.
6. Patient confirms transcript → complaint.
7. `InterviewService.create()` chooses first deterministic question.
8. Each answer is previewed then confirmed into `InterviewResponse`.
9. Optional document becomes reviewable `MedicalDocument`/facts.
10. `complete()` creates patient-reported `ClinicalHistory`.
11. `RoutingService.assess()` optionally recommends a department.
12. Patient selects an accepting existing doctor, if available.
13. `QueueService.checkIn()` creates token in one transaction.
14. Patient waiting screen polls status.
15. Doctor signs in, sees assigned queue, calls token.
16. Doctor opens workspace, verifies evidence/facts, completes consultation.

## 18. Technology-choice defense

`Next.js + TypeScript` → one typed patient/doctor web deployment; separate routes, shared UI/runtime.

`Express + TypeScript` → explicit REST API, middleware order, controllers/services/repositories are easy to demo.

`PostgreSQL + Prisma` → relational patient/visit/document/audit links; transactions protect queue actions.

`Zod` → runtime validation at browser/API/provider boundaries.

`Local/private storage` → prototype document separation from public web assets; not cloud production storage.

`Deterministic engines` → interview, routing, queue, comparisons and brief selection remain explainable/testable.

`Optional adapters` → speech/NLU/OCR can run mock/local/provider modes without making the system depend on one vendor.

## 19. SIH judge defense — 75 short answers

1. **Why two UIs?** Patient and doctor use separate Next route trees; API authorization is the real boundary.
2. **Where is backend entry?** `apps/api/src/server.ts` then `createApp()`.
3. **Where is frontend state?** `PatientFlowProvider` and `DoctorAuthProvider`.
4. **What database?** PostgreSQL through Prisma.
5. **Main patient ID?** `PatientProfile.id`; visit work uses `Visit.id`.
6. **What starts intake?** `PatientFlowService.createSession()`.
7. **How is consent stored?** `ConsentRecord` before patient creation.
8. **How is voice captured?** Browser recorder in `ListeningPage`.
9. **How is audio protected?** proof, duration/MIME/signature checks, provider validation.
10. **Which speech model?** Configurable; local/mock/OpenAI adapter, never claim one unless profile proves it.
11. **Can STT write facts directly?** No; patient confirms transcript first.
12. **What asks follow-ups?** Deterministic `InterviewEngine`.
13. **What does NLU do?** Optional bounded answer interpretation, not question authority.
14. **Is there one AI doctor?** No.
15. **Where are prompts?** Provider adapter/NLU implementation; rules are default.
16. **How are documents stored?** Private local storage plus DB metadata.
17. **Is OCR perfect?** No; uncertain output remains review-required.
18. **What creates a brief?** `ClinicalBriefService`/builder.
19. **Can AI verify facts?** No; doctor verification is explicit.
20. **What is What Changed?** Deterministic visit-snapshot comparison.
21. **What routes a specialty?** `routeSpecialization()` with versioned DB mappings.
22. **Is routing diagnosis?** No; intake support only.
23. **Can routing book appointments?** No; it saves preference then uses queue workflow.
24. **What happens on emergency draft match?** Routine check-in blocks and recommends urgent evaluation.
25. **Is that a SafetyEngine?** No; SafetyEngine is not implemented.
26. **How are doctors found?** Active doctor records plus specialization/availability filters.
27. **How is queue race-safe?** Serializable Prisma transactions and expected-state updates.
28. **How does patient see turn?** Polling endpoint, not WebSocket.
29. **How does doctor call next?** `QueueService.callNext()`.
30. **Who may open workspace?** Active assigned doctor or coded admin path.
31. **How are tokens signed?** HMAC typed proofs with expiry.
32. **Are they JWTs?** They are custom signed token codec proofs, not an external IdP session.
33. **What prevents ID guessing?** Proof plus service-level ownership/assignment checks.
34. **How validate inputs?** Zod schemas and upload middleware.
35. **How reduce SQL injection?** Prisma parameterized queries; no string-built SQL runtime path.
36. **How handle CORS?** Exact configured origin and mutation-origin guard.
37. **How rate limit?** In-process middleware; not distributed production limiting.
38. **How log safely?** Request IDs/redaction/safe errors; no compliance claim.
39. **Can doctors see all patients?** No; assignment checks define permitted scope.
40. **What is demo login?** Synthetic access-code sign-in, not MFA/production identity.
41. **Why demo reset?** Repeatable judge state using isolated synthetic DB.
42. **Does reset touch real DB?** Guarded demo command requires local named demo target.
43. **What languages?** English/Hindi UI and bounded normalization.
44. **Is there TTS?** No production TTS implementation claim.
45. **What is AYUSH support?** Source-labelled capture/review, not efficacy validation.
46. **Where does patient complaint go?** `ClinicalHistory` after completion.
47. **What stores transcript?** `VoiceInteraction`.
48. **What stores evidence?** Document facts/evidence and brief references.
49. **What stores audits?** `AuditLog`, queue events, verification records.
50. **What happens if DB fails?** API returns safe failure; transaction does not report partial success.
51. **What happens if speech fails?** Retry or type fallback.
52. **What happens if NLU fails?** bounded fallback to deterministic interpretation.
53. **What happens if OCR fails?** failed/review state; manual review remains.
54. **What happens if token expires?** patient/doctor must restart/sign in.
55. **What is active at runtime?** Routes mounted in `app.ts`; not every file is a feature.
56. **Any WebSockets?** No.
57. **Any FHIR/ABDM?** Not implemented.
58. **Any microservices?** No; one Express API.
59. **Why monorepo?** Shared DTOs prevent web/API contract drift.
60. **Why PostgreSQL not MongoDB?** relationships/transactions fit visits, audits, queue, verification.
61. **Biggest scalability bottleneck?** single API, local storage, in-memory rate limits, polling.
62. **First scale step?** deploy stateless API replicas, managed Postgres, object storage, shared cache/limits.
63. **Can optional AI hallucinate?** Yes; schemas/source review reduce but do not eliminate content contamination.
64. **Can an uploaded prompt alter authorization?** No; provider output cannot change roles/queue/audit authority.
65. **What is mock?** Default/configurable speech and OCR paths can be mock; inspect profile.
66. **What is real in demo?** API, DB schema, transactions, routes, UI, and synthetic seeded data.
67. **Can data be deleted?** No complete production retention/withdrawal workflow.
68. **Are backups tested?** Not as deployed production assurance.
69. **Is encryption certified?** No such certification claim.
70. **Is clinical validation complete?** No.
71. **How is failure visible?** API error codes + user-facing retry/fallback panels.
72. **How is interview race handled?** `sessionReady` waits for signed-session validation before initial load.
73. **How do tests cover DB?** `pnpm test:db` uses isolated `helios_test*` target.
74. **How do tests cover browser flow?** Playwright connected demo suite.
75. **What did the team build?** A source-aware, patient-to-doctor intake/workspace workflow with deterministic operational controls.

## 20. Rapid-fire revision

Frontend? → Next.js 15 + TypeScript.  
Backend? → Express 5 + TypeScript.  
Database? → PostgreSQL + Prisma.  
API entry? → `apps/api/src/server.ts`.  
Route registry? → `apps/api/src/app.ts`.  
Patient state? → `PatientFlowProvider`.  
Doctor state? → `DoctorAuthProvider`.  
Patient proof? → `SessionProofService`.  
Doctor proof? → `DoctorProofService`.  
Voice UI? → `ListeningPage`.  
Voice service? → `VoiceService`.  
Interview engine? → `InterviewEngine`.  
Document service? → `DocumentService`.  
Queue service? → `QueueService`.  
Routing engine? → `routeSpecialization()`.  
Doctor workspace? → `DoctorDashboardService`.  
Brief? → `ClinicalBriefService`.  
Fact verification? → `VerificationService`.  
Waiting updates? → API polling.  
SafetyEngine? → Not implemented.  
Demo data? → synthetic seed only.  
Demo database? → `helios_sih_demo`.  
Test DB? → guarded `helios_test*`.  
Main limitation? → prototype, not clinically/production validated.

## 21. If a judge says “show me the code”

`Show patient session` → `apps/api/src/services/patient-flow-service.ts` → `createSession()`.

`Show proof security` → `apps/api/src/security/session-proof.ts` → `verify()`.

`Show voice` → `apps/web/src/app/patient/listening/page.tsx` → `handleRecording()`; then `voice-service.ts` → `transcribe()`.

`Show interview` → `apps/api/src/services/interview-service.ts` → `create/respond/confirm`.

`Show question logic` → `apps/api/src/interview/interview-engine.ts`.

`Show documents` → `apps/api/src/services/document-service.ts` → `upload/process`.

`Show database schema` → `apps/api/prisma/schema.prisma`.

`Show routing` → `apps/api/src/routing/routing-engine.ts` → `routeSpecialization()`.

`Show provider authorization` → `apps/api/src/routing/routing-service.ts` → `select()`.

`Show token creation` → `apps/api/src/queue/queue-repository.ts` → `checkIn()` transaction.

`Show doctor scope` → `apps/api/src/doctor-dashboard/doctor-dashboard-service.ts`.

`Show verification` → `apps/api/src/verification/verification-service.ts`.

`Show web protections` → `apps/api/src/app.ts` + `middleware/`.

`Show demo isolation` → `scripts/run-with-demo-env.mjs`.

`Show tests` → `apps/api/tests`, `apps/web/src/**/*.test.tsx`, `tests/e2e-connected`.

## 22. Variable trace

`sessionId` → `createSession()` → signed proof subject → API ownership checks → `PatientSession`.

`patientId` → `createPatient()` → `PatientProfile.id` → `Visit`, documents, timeline, doctor assignment.

`visitId` → patient creation → interview/document/history/queue/routing relation → doctor workspace.

`doctorToken` → doctor sign-in → `DoctorAuthProvider` session storage → doctor route headers → role/assignment checks.

`preferredDoctorId` → routing select → `Visit` → queue check-in assignment.

## 23. AI vs normal programming

| Task | Implemented by | Where |
|---|---|---|
| microphone recording | browser code | `useVoiceRecorder` |
| transcription | configured provider | `VoiceService` |
| answer structuring | rules/optional provider | `ClinicalNLUService` |
| interview order | deterministic code | `InterviewEngine` |
| document facts | rules/OCR candidates | document providers |
| specialty routing | deterministic code | `routeSpecialization()` |
| queue ordering | deterministic transaction | `QueueRepository` |
| access control | deterministic proofs/checks | services/security |
| doctor verification | human doctor action | `VerificationService` |

## 24. Our technical contribution

HELIOS combines consented multilingual intake, confirm-before-persist voice, source-labelled document/interview data, deterministic interview/routing/queue logic, and an authorized doctor workspace.

It integrates standard frameworks and configurable adapters; do **not** claim Whisper/OpenAI/PostgreSQL as inventions or claim clinical validation.

## 25. If 10 users become 10,000

**Current:** one web/API deployment, PostgreSQL, local files, polling, in-memory limits.

**Bottlenecks:** API instances, DB connections/queries, OCR/speech CPU, local storage, polling volume.

**Scale:** stateless API replicas, managed Postgres/read tuning, object storage, background workers, queue/cache, distributed rate limits, WebSocket/SSE only if justified.

## 26. Questions that could expose us

**Issue:** demo doctor code is not real identity.  
**Answer:** “It is explicitly a synthetic demo control; production needs IdP/MFA, revocation, and tenancy.”

**Issue:** SafetyEngine absent.  
**Answer:** “We do not claim automated clinical safety; routing drafts only block routine queue for configured patterns.”

**Issue:** adapters can be mock.  
**Answer:** “We demonstrate the real integration boundaries; the active provider is configuration-dependent and shown honestly.”

**Issue:** local storage/in-memory limits do not scale.  
**Answer:** “They are prototype choices; our scale plan moves these to managed/shared services.”

**Issue:** OCR/NLU may be wrong.  
**Answer:** “Output is source-labelled, schema-bounded, and reviewable; it never gains doctor authority.”

## 27. How do we know it works?

`apps/api/tests/routing-engine.test.ts` → deterministic routing/negation/emergency cases.

`apps/api/tests/database.integration.test.ts` → PostgreSQL persistence and selected-doctor queue handoff.

`apps/api/tests/security/*` → origin, proof, validation, rate-limit/hardening cases.

`apps/web/src/**/*.test.tsx` → patient/doctor component and flow tests.

`tests/e2e-connected/full-browser-journey.spec.ts` → synthetic browser voice → interview → document → submit → doctor review.

**Passed recently:** web suite 50 tests; isolated DB 18; security 29. **Limit:** tests are not clinical certification or penetration certification.

## 28. My 5-minute SIH explanation

1. “HELIOS turns pre-consultation waiting time into organized, source-labelled clinical context.”
2. “The patient and doctor have separate Next.js routes, but both use one secured Express API.”
3. “A patient starts a signed session, gives consent, demographics, language, and complaint.”
4. “Voice is optional: audio is validated, transcribed by the configured provider, then confirmed by the patient.”
5. “Our deterministic interview engine asks follow-ups and stores only confirmed responses.”
6. “Documents are privately stored, OCR/extracted conservatively, and remain reviewable with evidence.”
7. “At review, deterministic routing can suggest a department and an existing available doctor; it is not diagnosis.”
8. “A serializable PostgreSQL queue transaction creates the token and prevents conflicting queue updates.”
9. “The doctor dashboard is authorized by signed doctor proof plus active assignment checks.”
10. “Doctors see timeline, documents, comparisons, and Clinical Brief, then explicitly verify or correct facts.”
11. “The important distinction is that AI/adapters assist bounded transformations; authority, queue, verification, and access control remain deterministic.”
12. “Our honest limitation is that this is a synthetic prototype without production identity, clinical validation, or the planned SafetyEngine.”

## 29. One-page memory sheet

**PROJECT** → patient intake → organized doctor-ready context.  
**FRONTEND** → Next.js patient/doctor routes.  
**BACKEND** → Express `/api/v1`.  
**DATABASE** → PostgreSQL + Prisma.  
**AI** → optional bounded speech/NLU/OCR adapters; deterministic core.  
**VOICE** → `ListeningPage` → `VoiceService` → confirmation.  
**AUTH** → HMAC patient/doctor proofs; demo doctor login only.  
**MAIN FLOW** → consent → intake → interview/doc → review/routing → queue → doctor workspace.  
**MAIN API** → `apps/api/src/app.ts`.  
**MAIN DATA** → `PatientSession` → `PatientProfile` → `Visit`.  
**MAIN SECURITY** → proof + ownership/assignment + validation.  
**INNOVATION** → source-aware handoff from patient story to doctor workflow.  
**BIGGEST LIMITATION** → no SafetyEngine/clinical or production validation.  
**SCALING PLAN** → stateless API + managed DB/storage + workers/cache.  
**MOST IMPORTANT FILES** → `app.ts`, schema, patient flow, interview, voice, queue, doctor dashboard.  

### 10 things to remember

1. Patient and doctor UIs are separate routes; backend authorization is the boundary.
2. PostgreSQL is the source of truth; browser storage is only draft/session convenience.
3. Patient confirms voice and interview answers before they become structured data.
4. Interview and routing are deterministic logic, not an autonomous LLM doctor.
5. AI/OCR output is bounded and cannot grant authority.
6. Queue creation/actions use transactions.
7. Doctor access requires signed proof plus assignment/role checks.
8. Routing is support, not diagnosis, booking, or emergency clearance.
9. Demo data/login/reset are synthetic and guarded.
10. Say clearly: SafetyEngine and production readiness are not implemented.
