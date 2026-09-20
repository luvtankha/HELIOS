# HELIOS Phase 4 Completion Report

## 1. Architecture

Phase 4 adds a deterministic case-taking pipeline:

`Patient text / confirmed voice → InterviewService → ClinicalNLUService → Zod validation → InterviewEngine → InterviewRepository → PostgreSQL/Prisma`

The optional model is limited to interpretation. `InterviewEngine` owns pathway selection, question priority, dependency activation, conflict clarification, completeness, and completion. React renders server-selected questions and does not contain clinical flow rules.

## 2. Interview state machine

Persistent interview statuses are `ACTIVE → REVIEW → COMPLETED`, with `ABANDONED` reserved. A response is structured but does not enter confirmed clinical state until the patient confirms it. Every confirmation updates the state, next question, completeness, and response status transactionally. Refresh/resume reloads the last confirmed state. Review can reopen one fact as `NOT_ASKED`, collect its replacement, and return to review.

Facts distinguish `YES`, `NO`, `UNKNOWN`, `NOT_ASKED`, and `CONFLICT`. Raw answers are appended rather than overwritten.

## 3. Question graph

Questions are extensible definitions containing ID, pathway, field, category, patient text, controlled alternative wording, input type, options, required flag, priority, and optional dependency. Selection ranks active missing required fields deterministically. Dependencies activate relevant branches; for example, a vomiting/nausea answer activates the abdominal vomiting-frequency follow-up. A conflict or ambiguous required answer takes priority over ordinary missing fields.

Supported input contracts are `TEXT`, `LONG_TEXT`, `VOICE`, `CHOICE`, `MULTI_SELECT`, `YES_NO`, `NUMBER`, `DATE`, `DURATION`, and `SLIDER`.

## 4. Supported complaint pathways

The synthetic/demo graph includes:

- Abdominal pain
- Chest discomfort
- Headache
- Fever
- Cough/breathing complaint
- General pain

These pathways are documentation demonstrations, not complete clinical protocols. They contain no risk classification or emergency logic.

## 5. NLU implementation

`ClinicalNLUService` receives only the current question, raw answer, deterministic interpretation, and at most one relevant existing fact. Its output schema permits only the requested field, value, knowledge state, confidence, and ambiguity marker. Invalid output gets one retry; a second failure preserves the deterministic/raw result. English, Hindi, and mixed Hindi-English rules cover the primary demo complaint, duration, abdominal location, severity, unknowns, and explicit negative multi-select answers.

The safety prompt explicitly says the model is not a doctor, may extract only stated information, must not diagnose, treat, or invent symptoms, must preserve ambiguity, and must return JSON only.

## 6. Database changes

Migration `20260909000000_adaptive_interviews` adds:

- `InterviewStatus` and `InterviewResponseStatus` enums
- `Interview` with session/visit ownership, state JSON, current question, completeness, and lifecycle timestamps
- `InterviewResponse` with question ID, raw and normalized answers, language, source, confidence, status, and confirmation time
- `AIInteraction` with provider, model, input type, validation outcome, tokens, and latency
- Relations, indexes, foreign keys, and check constraints

Completion upserts the confirmed summary into `ClinicalHistory` with `PATIENT_REPORTED` provenance. No Phase 4 data is marked `DOCTOR_VERIFIED`.

## 7. APIs

- `POST /api/v1/interviews`
- `GET /api/v1/interviews/:id`
- `GET /api/v1/interviews/:id/current-question`
- `POST /api/v1/interviews/:id/response`
- `POST /api/v1/interviews/:id/confirm`
- `POST /api/v1/interviews/:id/revise`
- `POST /api/v1/interviews/:id/complete`

All bodies use Zod validation, responses use the existing API envelope, and ownership is verified with the Phase 3 HMAC session proof. Internal prompts are never returned.

## 8. Files changed

Principal Phase 4 files:

- `apps/api/src/interview/question-graph.ts`
- `apps/api/src/interview/interview-engine.ts`
- `apps/api/src/interview/clinical-nlu.ts`
- `apps/api/src/providers/openai-clinical-nlu-provider.ts`
- `apps/api/src/providers/clinical-nlu-provider-factory.ts`
- `apps/api/src/services/interview-service.ts`
- `apps/api/src/repositories/interview-repository.ts`
- `apps/api/src/controllers/interview-controller.ts`
- `apps/api/src/routes/interview.ts`
- `apps/api/src/validation/interview.ts`
- `apps/api/src/serializers/interview.ts`
- `apps/api/prisma/schema.prisma` and the Phase 4 migration
- `packages/shared/src/index.ts`
- `apps/web/src/app/patient/interview/page.tsx`
- `apps/web/src/app/patient/listening/page.tsx`
- `apps/web/src/services/interview-service.ts`
- Patient-flow state/types, tests, environment sample, README, and architecture/product/security documentation

## 9. AI provider

The default is `CLINICAL_NLU_PROVIDER=rules`, which needs no external provider. The optional OpenAI adapter uses the Responses API with strict JSON-schema output, `store: false`, a configurable model and timeout, and server-only credentials. This follows the official [Create a model response](https://developers.openai.com/api/reference/cli/resources/responses/methods/create) contract for `instructions`, `input`, response storage control, structured `text.format`, and usage metadata.

No live OpenAI request was made because no clinical AI key was available in this environment.

## 10. Fallback behavior

- No AI configuration: deterministic normalization and question flow continue.
- Invalid AI JSON: one constrained retry, then deterministic/raw fallback.
- Provider error or timeout: bounded failure and deterministic/raw fallback; no state corruption.
- Unknown answer: stored as `UNKNOWN`, never silently converted to `NO`.
- Ambiguous/conflicting answer: preserved with raw history and routed to clarification.
- API/network UI failure: the in-progress input remains visible and retryable.

## 11. Tests

Automated results:

- API: 50 passed, 4 skipped
- Web: 16 passed
- Total executed: 66 passed

Coverage includes all six pathway classifications; English, Hindi, and mixed complaint input; primary abdominal demo extraction; question selection; required-field and completion logic; unknown versus no; vague answers; contradictions; safe rules fallback; invalid model output retry; model unavailability/timeout behavior; API DTO validation; voice state; and adaptive patient UI confirmation.

The four skipped tests are live PostgreSQL integration tests gated by `DATABASE_URL`.

## 12. Build and quality gate

Passed on 2026-09-09:

- `pnpm format`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm db:validate`
- `pnpm build`

The Next.js production build compiled and generated all 14 static pages, including `/patient/interview` and `/patient/listening`.

## 13. Known issues

- Rules-based language understanding is intentionally narrow and demo-oriented; unfamiliar wording may remain a medium-confidence raw string or require clarification.
- Resetting the chief complaint reuses the session's interview record and preserves earlier response rows for audit history; a later reporting UI should distinguish superseded responses more explicitly.
- The optional OpenAI adapter is implemented and contract-tested at its validation boundary, but not live-provider tested here.

## 14. Limitations

- PostgreSQL was not configured, so migration application, real database persistence, browser refresh/resume against a database, and the full database-backed E2E journey could not be executed live. The Prisma schema validated successfully and repository/API boundaries are automated-test covered.
- No physical microphone/browser permission session was available for a manual voice recording. The existing MediaRecorder flow and voice tests pass, and Phase 4 reuses transcript confirmation before NLU.
- No live clinical AI key was available. Deterministic fallback is the tested default.
- The six pathways are synthetic case-taking demonstrations. Phase 4 deliberately provides no diagnosis, prescription, treatment recommendation, emergency declaration, clinical risk score, or Phase 5 safety signal.

Phase 5 was not started.
