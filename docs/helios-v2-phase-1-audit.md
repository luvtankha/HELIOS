# HELIOS v2 Phase 1 — repository audit

Status: implementation audit complete; no runtime code deleted or migrated in this phase.

Baseline repository inspected at commit `0db0c818dc9c895d0fb537e7af3a98d86260287b` on `main`.

## Verified current architecture

The live repository differs from some earlier planning assumptions. The current frontend is **Next.js 15 + React 19 + TypeScript**, not a plain HTML/CSS/JavaScript application. The API is **Express 5 + TypeScript**. Prisma 6 maps the application to PostgreSQL. The patient and doctor route trees are in the same Next.js deployment and share the same Express API and PostgreSQL database.

Current patient voice is a staged implementation: browser `MediaRecorder` records a bounded clip, the browser uploads it to `POST /api/v1/voice/transcribe`, the backend uses a speech provider (including a local faster-whisper implementation), and patient UI paths use browser `SpeechSynthesisUtterance` for spoken prompts. This is not full-duplex audio-to-audio.

The repository already contains a substantial deterministic adaptive-interview engine and an opt-in deterministic specialization-routing engine. These are assets to migrate/evolve, not features to rebuild blindly.

## Runtime dependency path today

```text
Patient Next.js routes
  -> patient services / session token
  -> Express /api/v1
  -> controllers/services/repositories
  -> Prisma
  -> PostgreSQL

Voice today
  Browser MediaRecorder
  -> multipart /api/v1/voice/transcribe
  -> Express VoiceService
  -> SpeechProvider
  -> local faster-whisper Python worker / configured provider
  -> transcript persistence
  -> deterministic interview + optional constrained NLU
  -> browser SpeechSynthesisUtterance for the next prompt
```

## Patient frontend inventory

| Path / area | Current responsibility | Phase-1 classification | v2 direction |
| --- | --- | --- | --- |
| `apps/web` | Next.js/React application foundation | KEEP | Keep the frontend framework; do not rewrite the entire web app just to change the patient experience. |
| `apps/web/src/providers/patient-flow-provider.tsx` | Patient session IDs, token/draft persistence, language, route-step state | MODIFY | Preserve session ownership/resume concepts; remove English-default assumptions and adapt state to live consultation/session events. |
| `apps/web/src/app/patient/page.tsx` | Patient entry/resume | MODIFY | Keep entry/session semantics; transition into the new automatic live experience. |
| `apps/web/src/app/patient/language/page.tsx` | English/Hindi selection | REPLACE | v2 is Hindi/Hinglish adaptive conversation, not an English-vs-Hindi mode selector. |
| `apps/web/src/app/patient/consent/page.tsx` | Versioned patient consent | KEEP / MODIFY | Consent remains required; presentation may be integrated around the new patient flow without weakening explicit consent. |
| `apps/web/src/app/patient/details/page.tsx` | Demographic intake | KEEP / MODIFY | Data requirement remains. Decide later whether it stays a form or becomes part of the conversational flow; do not delete before replacement is validated. |
| `apps/web/src/app/patient/complaint/page.tsx` | Chief complaint with current voice conversation | REPLACE | Becomes part of the finalized automatic doctor-avatar conversation. |
| `apps/web/src/app/patient/interview/page.tsx` | Current adaptive question UI + voice/text modes | REPLACE | Replace visible questionnaire/turn UI with continuous conversation while retaining useful structured-intake semantics. |
| `apps/web/src/app/patient/listening/page.tsx` | Tap-to-speak, waveform, upload/transcribe, transcript review/edit | DEPRECATE -> DELETE LATER | Directly conflicts with finalized v2 UX. Remove only after full-duplex path is accepted and no route depends on it. |
| `apps/web/src/components/patient/complaint-voice-conversation.tsx` | ASKING/LISTENING/PROCESSING UI, browser TTS, clip transcription | DEPRECATE -> DELETE LATER | Replaced by live doctor-avatar session controller. |
| `apps/web/src/components/patient/voice-conversation-controller.tsx` | Spoken question -> record -> transcribe -> confirm -> next question | DEPRECATE -> DELETE LATER | Replaced by realtime audio/session UI. Useful behavioral tests can inform v2 acceptance tests. |
| `apps/web/src/components/patient/voice.tsx` | Mic button / waveform | DEPRECATE -> DELETE LATER | Final UI explicitly removes these as primary interaction controls. |
| `apps/web/src/hooks/use-voice-recorder.ts` | MediaRecorder clip lifecycle/silence stop | REPLACE | Realtime capture/transport will supersede clip recording. Keep until realtime capture passes device/recovery tests. |
| `apps/web/src/lib/voice-machine.ts` | Staged recording/transcription state machine | REPLACE | New state machine should model realtime session/media/doctor state instead of upload/transcribe stages. |
| `apps/web/src/services/voice-service.ts` | REST voice upload/edit/confirm client | REPLACE | New realtime session/control client. Legacy REST service stays until cutover. |
| `apps/web/src/services/interview-service.ts` | Interview REST client | MIGRATE / MODIFY | Preserve structured-intake contract semantics while moving patient APIs to Java and conversation intelligence to the new engine. |
| `apps/web/src/services/specialization-routing.ts` | Routing/provider REST client | MIGRATE | Existing routing contract should move to Java before the patient UI switches. |
| `apps/web/src/components/patient/specialization-routing-card.tsx` | Review-time department/provider recommendation | MODIFY | Routing should become the end result of completed intake rather than a disconnected card; keep current behavior until replacement is tested. |
| `apps/web/src/app/patient/documents` | Patient document upload/review | KEEP / MIGRATE | Preserve capability; patient-facing API eventually moves to Java. |
| `apps/web/src/app/patient/review/page.tsx` | Pre-submit review + routing card | MODIFY | Reconcile with conversational completion and structured summary; do not remove source review semantics blindly. |
| `apps/web/src/app/patient/complete`, `waiting`, `timeline` | Submission/token/status/history | KEEP / MIGRATE | Preserve patient capabilities; move their patient-facing backend contracts incrementally. |
| `apps/web/src/components/patient/patient-shell.tsx`, `controls.tsx`, `feedback.tsx` | Shared patient presentation primitives | REVIEW / KEEP | Reuse where compatible with locked UI; do not let existing controls force old UX into v2. |

## Patient backend inventory

| Path / area | Current responsibility | Classification | v2 direction |
| --- | --- | --- | --- |
| `apps/api/src/app.ts` | Express composition root for patient + doctor APIs | KEEP DURING MIGRATION | Cannot be deleted during patient-only migration because the unchanged doctor dashboard still depends on Express. |
| `apps/api/src/routes/patient-flow.ts` + controllers/services/repositories | Patient session, consent, profile, visit, complaint, submit | MIGRATE | Implement equivalent versioned Spring Boot endpoints/services and switch patient frontend route-by-route. |
| `apps/api/src/routes/interview.ts` + `services/interview-service.ts` | Adaptive interview state/answers/confirmation/completion | MIGRATE / EVOLVE | Preserve useful state/provenance semantics; new conversation engine selects dynamic follow-ups rather than exposing the current questionnaire flow. |
| `apps/api/src/interview/interview-engine.ts` | Deterministic question selection, conflict/unknown tracking, completeness | KEEP AS REFERENCE -> MIGRATE/EVOLVE | Valuable safety/state logic. Port or re-express deterministic invariants in the new Java/AI architecture instead of discarding them. |
| `apps/api/src/interview/clinical-nlu.ts` | Bounded structured extraction with schema validation/fallback | KEEP AS REFERENCE -> MIGRATE/EVOLVE | Preserve the principle that AI extracts bounded patient facts and never gains authority. |
| `apps/api/src/routes/voice.ts` + `services/voice-service.ts` | Multipart clip transcription/edit/confirm | DEPRECATE -> DELETE LATER | Superseded by realtime voice sessions after acceptance. |
| `apps/api/src/providers/local-speech-provider.ts` | Warm local faster-whisper worker for English/Hindi clip STT | DEPRECATE -> DELETE LATER | Not full duplex. Keep as temporary fallback/testing asset until the new voice service is proven. |
| `apps/api/scripts/transcribe-local.py` and speech setup/smoke scripts | Local Whisper runtime/setup | DEPRECATE -> DELETE LATER | Remove only after no fallback/test path needs it. |
| `apps/api/src/routing/*` | Deterministic specialization routing + audit | KEEP AS BASELINE -> MIGRATE/EVOLVE | Existing engine already provides conservative fallback, emergency-pattern precedence, immutable decision data, and provider selection. Migrate the safe deterministic core to Java and let the new AI engine supply structured intake, not unchecked routing authority. |
| `apps/api/src/routes/documents.ts` and document services | Upload/OCR/extraction | MIGRATE LATER | Patient-facing endpoints move to Java after core session/intake path. Existing extraction can remain behind an adapter during transition. |
| timeline / comparison / clinical-brief services | Derived longitudinal/brief outputs | KEEP / MIGRATE LATER | Preserve provenance and outputs. They are part of the final patient-to-doctor handoff, but doctor UI is not modified now. |
| queue patient operations | Waiting/check-in/token | KEEP / MIGRATE LATER | Preserve transactional semantics; patient-side API can migrate without redesigning doctor queue UI. |
| doctor-dashboard routes/services/UI | Existing clinician workspace | OUT OF SCOPE | Do not modify in current migration. Keep Express support until final integration phase. |

## Database inventory

Source of truth today: `apps/api/prisma/schema.prisma` plus `apps/api/prisma/migrations/*`.

Important patient-side models already exist and should be preserved semantically: `PatientProfile`, `PatientSession`, `Visit`, `ConsentRecord`, `Interview`, `InterviewResponse`, `AIInteraction`, `VoiceInteraction`, `ClinicalHistory`, `Symptom`, `Medication`, `Allergy`, `Observation`, `MedicalDocument` and extraction/evidence tables, `TimelineEvent`, `RiskSignal`, `QueueEntry`, `PatientSnapshot`, `Comparison`, `ClinicalBrief`, `AuditLog`, `Specialization`, `MedicalConditionSpecialization`, and `RoutingDecision`.

Classification:

- PostgreSQL: **KEEP**.
- Existing data and identifiers: **KEEP**.
- Prisma schema/migrations: **KEEP AS HISTORICAL BASELINE during migration; DELETE LATER only after migration ownership is safely handed to Flyway and no Express code requires Prisma**.
- Prisma runtime repositories used by unchanged doctor dashboard: **KEEP during patient-only migration**.
- New Java persistence: **ADD** JPA/Hibernate mappings against the existing PostgreSQL schema.
- Flyway: **ADD**, but do not replay/rewrite old Prisma migrations. Establish a baseline at the current schema version, then let Flyway own new v2 migrations from the handoff point forward.

The current schema already stores useful provenance and model metadata (`AIInteraction`, `VoiceInteraction`, `RoutingDecision`). v2 should extend rather than discard these concepts. Raw audio should remain non-retained by default; store only minimum session/event metadata required for operation/audit unless a separately approved retention policy requires otherwise.

## Specialization routing finding

The requested routing engine is **not greenfield**. Current implementation exists at:

- `apps/api/src/routing/routing-engine.ts`
- `apps/api/src/routing/routing-repository.ts`
- `apps/api/src/routing/routing-service.ts`
- `apps/api/src/routes/specialization-routing.ts`
- `dataset/routing/specialization-routing.json`
- Prisma models `Specialization`, `MedicalConditionSpecialization`, `RoutingDecision`, `User.specializationId`, `User.acceptingRouting`, and `Visit.preferredDoctorId`.

The current engine is deterministic and already separates routing support from diagnosis, uses conservative general-clinician fallback, stores immutable decision inputs/results/versioning, and restricts provider selection to active configured doctors. The v2 plan should preserve these safety properties. The new AI conversation engine should produce structured patient facts and uncertainty; a deterministic/policy-controlled routing layer should make the final specialization recommendation from permitted fields. Do not give an unconstrained generative model direct doctor-assignment authority.

## Repository cleanup candidates discovered

No cleanup was performed in Phase 1.

### High-confidence non-runtime cleanup candidates

- `work/web-next-stale-recovery/` — approximately 317 MB of tracked Next.js build/cache/recovery output. No source reference outside that directory was found. **REVIEW -> likely remove in cleanup phase**, then add a guard so generated build output cannot be recommitted.
- `work/sih-demo-private-uploads/` and `work/phase19-private-uploads/` — tracked synthetic/private-upload artifacts. **REVIEW** before removal because demo/test fixtures may rely on them; prefer canonical fixtures under `tests/fixtures`/`dataset` if equivalent.
- `outputs/` — historical generated reports/artifacts. No runtime source reference was found. **REVIEW**; archive externally or keep only canonical documentation that is still useful.

### Large reference corpus

`reference/` is approximately 310 MB and contains vendored/reference copies of OpenEMR, Synthea, OpenMRS and speech/dialog datasets. No direct runtime source reference to these directories was found in the application search performed in this audit. **REVIEW, not immediate delete.** Before removal, verify provenance/licensing/research requirements and whether dataset-generation scripts or documentation intentionally depend on these sources. If they are research references rather than runtime dependencies, move them out of the application repository or replace them with reproducible source manifests/links where licensing permits.

## Corrected migration implication for the doctor dashboard

Because patient and doctor routes currently share one Express API and one PostgreSQL schema, the patient backend can migrate to Spring Boot while the doctor dashboard remains unchanged only if both backends coexist temporarily:

```text
Patient Next.js routes -> Spring Boot patient APIs -> PostgreSQL
Doctor Next.js routes  -> existing Express doctor APIs -> PostgreSQL
Python voice/AI service <-> Spring Boot patient backend
```

Therefore **do not remove the entire Express/Prisma backend at patient cutover**. Remove only patient-only legacy routes/providers that are proven unused and safe to remove. Express/Prisma remain for the doctor dashboard until the later, separately gated doctor integration.

## Phase 1 exit check against migration context

- Finalized patient UI was not redesigned or implemented in this phase: PASS.
- Doctor-dashboard code modified: NO.
- Hindi/Hinglish requirement preserved in target classification: PASS.
- No diagnosis/treatment authority introduced: PASS.
- PostgreSQL retained and migration is additive-first: PASS.
- No old capability deleted: PASS.
- Figma touched: NO.

Phase 2 may begin only from this audited repository state and must establish a reproducible v1 baseline before behavioral migration.
