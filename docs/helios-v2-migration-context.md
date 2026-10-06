# HELIOS v2 patient migration context

This file is the persistent implementation guardrail for the HELIOS v2 migration. Re-read it at the start and end of every phase. A phase is not complete until its work is checked against this file and all earlier completed phase outputs.

## Scope

- Change scope is the **patient experience and the patient-facing backend/data path**.
- The existing doctor dashboard is **not a change target** in the current migration. It may be inspected only to preserve contracts and to define the final handoff from the completed patient system.
- Do not redesign, refactor, delete, or migrate doctor-dashboard UI/routes/services during patient-side phases.
- PostgreSQL remains the system of record. Schema changes must be additive first and migration-safe.
- The patient-facing Node/Express/Prisma responsibilities will migrate incrementally to Java/Spring Boot. The Express application itself cannot be deleted while the unchanged doctor dashboard still depends on it.

## Locked patient UI/UX

- Illustrated/vector doctor team is the interface; no photos and no realistic 3D characters.
- One doctor is active at a time; supporting doctors remain visible.
- The active doctor speaks naturally and shows a comic-style speech bubble only as a visual representation of the spoken utterance.
- Conversation starts automatically.
- Automatic continuous listening after/while the doctor speaks, with interruption/barge-in support.
- Dynamic symptom-specific follow-up questions; no fixed visible questionnaire.
- Active doctor may hand off to another illustrated doctor without breaking the session.
- No chat input box, microphone button, start-speaking button, Next button, transcript-review screen, waveform as the primary interaction, or visible STT/processing/generation stages.
- Internal technical stages may exist, but the product must not pretend a staged STT -> LLM -> TTS pipeline is native audio-to-audio if it is not.

## Language policy

- Patient conversation: Hindi + Hinglish.
- Pure English-only interaction is not a supported patient mode in v2.
- English words naturally embedded in Hinglish remain valid and expected.
- Language handling must tolerate code-switching within an utterance rather than forcing a visible language-mode switch.

## AI and clinical boundaries

- HELIOS organizes patient-provided and document-derived information for clinicians; it does not autonomously diagnose, prescribe, recommend treatment, or replace a clinician.
- The conversation engine may select intelligent follow-up questions to fill clinically useful intake gaps, preserve uncertainty/conflicts, and stop when intake is sufficiently complete.
- Specialization routing is an intake/routing aid, not diagnosis. Uncertain cases must fall back conservatively to a general clinician/clinic review path.
- Emergency/red-flag handling must not claim that a non-match means the patient is safe. Clinical validation/governance is required before production use.
- AI/provider output never gains authorization, queue, doctor-verification, or audit authority.

## Target technical direction

- Frontend: retain the existing Next.js/React application foundation unless a later measured constraint requires otherwise; replace the patient conversational experience with the locked UI.
- Patient application backend: Java 21 + Spring Boot.
- Database access in Java: Spring Data JPA/Hibernate; schema migration ownership moves to Flyway after an explicit handoff from the existing Prisma migration history.
- Database: PostgreSQL retained.
- Realtime audio: streaming transport selected by a measured spike; WebRTC is preferred for browser realtime media if the spike confirms the operational fit, with WebSocket/HTTP used for control/events where appropriate.
- Voice/AI inference: isolated Python/PyTorch service. Do not embed the speech model directly in the Java process.
- Voice model must be proven for Hindi/Hinglish, streaming, interruption, latency, and deployment constraints before it is locked.
- Java owns application/business rules, authorization, persistence orchestration, audit, and stable API contracts. Python owns model inference/session runtime, not business authority.

## Migration rules

1. Preserve a reproducible v1 baseline before behavioral changes.
2. Build replacements alongside old paths.
3. Use explicit contracts between browser, Java, Python AI service, and PostgreSQL.
4. Prefer additive database migrations and dual-read/write only where necessary and bounded.
5. Prove feature parity and rollback before switching a capability.
6. Mark obsolete code `DELETE LATER`; do not delete it merely because a replacement is planned.
7. Delete only after the replacement is active, tested, and no remaining route/import/runtime dependency uses the old path.
8. Figma is outside implementation scope unless separately and explicitly authorized.

## Phase gate checklist

At the end of every phase verify:

- The locked patient UI has not been unintentionally redesigned.
- Doctor-dashboard code was not modified.
- Hindi/Hinglish requirements remain intact.
- HELIOS still does not claim diagnosis/treatment authority.
- PostgreSQL data/provenance/audit integrity is preserved.
- No old capability was deleted before replacement + parity evidence.
- All earlier completed phase acceptance criteria still pass or any regression is explicitly blocked before proceeding.

