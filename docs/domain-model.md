# HELIOS domain model

Phase 1 separates records by responsibility and provenance instead of treating a patient story as one arbitrary document.

## Identity and participation

- `User` represents a future authenticated identity and requires an email or username at the database level.
- `PatientProfile` is a minimum-necessary demographic profile. It stores age rather than exact date of birth for the Phase 2 flow.
- `PatientSession` represents resumable kiosk/pre-consultation progress and may exist before a patient profile because consent precedes demographic entry.
- `Visit` is the consultation/pre-consultation event and owns clinical records.

## Clinical and longitudinal information

- `ClinicalHistory` is one structured history per visit. Complex sections use bounded JSON structures so later schemas can evolve without collapsing everything into free text.
- `Symptom`, `Medication`, and `Allergy` preserve reusable, queryable records and an explicit source.
- `Observation` stores a typed concept, optional code, value, unit, reference range, knowledge state, effective time, visit context, and provenance. It is intentionally general enough for vital signs, laboratory results, and future document-derived measurements without forcing all facts into JSON history sections.
- `TimelineEvent` provides a rebuildable patient-scoped chronological projection across visits. It distinguishes event time from recording time, preserves date precision, temporal state, provenance, verification status, origin IDs, evidence links, grouping keys, conflict keys, and deterministic fingerprints. `TimelineEventVersion` retains prior projections when an indexed event changes or is rejected.
- `MedicalDocument` stores private file metadata, content hash, classification, processing status, identity state, summary, and document date separately from derived extraction data.
- `DocumentPage` preserves page order, OCR text, confidence, dimensions, and an optional private processed-image key.
- `DocumentFact` stores typed original and normalized values, confidence, review state, provenance, and optional patient/visit linkage. `DocumentEvidence` points each fact back to source text, page, and optional bounding box.
- `DocumentProcessingJob` makes attempts, state, timing, and failures observable. `DocumentExtraction` records provider/model, processing version, structured output, confidence, and errors.
- `RiskSignal` is storage only. No rule, inference, medical recommendation, or diagnosis is implemented.

## Provenance and verification

`ClinicalSource` keeps `PATIENT_REPORTED`, `AI_STRUCTURED`, `DOCUMENT_EXTRACTED`, `DOCTOR_VERIFIED`, and `SYSTEM_GENERATED` distinct. `DoctorVerification` stores original and verified JSON values with verifier identity and status. The schema never treats AI-structured or document-extracted content as verified clinical fact.

## Consent and audit

- `ConsentRecord` is versioned and session-scoped. A nullable patient relation reflects consent occurring before patient details.
- `AuditLog` records actor, action, entity reference, request ID, and metadata. It must not contain unnecessary medical content.

## Voice interactions

`VoiceInteraction` belongs to a patient session and optionally its visit. It preserves original provider text, optional normalization, patient edits, and the final accepted transcript as separate fields. Status records recording/processing/transcribed/edited/confirmed/failed/cancelled outcomes. Audio metadata is intentionally minimal and declares `retained: false`; raw audio is processed in memory and not stored by HELIOS. Each retry creates another interaction rather than overwriting history.

## Index strategy

Compound and single-column indexes cover patient/status, visit/status, document processing, timeline event date, verification entity, request ID, and created-time access patterns. Unique constraints protect patient codes, visit tokens, session-to-visit mapping, document extractions, and consent versions.

Document indexes additionally cover patient/date, session/status, identity state, file hash, fact review state, and job status. A document can create at most one timeline event. File hashes are indexed for patient-scoped duplicate detection rather than globally unique, because identical source files can legitimately belong to different patients.

# Adaptive interview entities

- `Interview` is one resumable state machine per patient session/visit and records the version-controlled question graph version used to create it.
- `InterviewResponse` preserves the question, raw answer, normalized answer, language, source, confidence, status, and confirmation time.
- `AIInteraction` stores operational provider/model, validation, token, and latency metadata associated through the interview.
- Confirmed state uses `YES`, `NO`, `UNKNOWN`, `NOT_ASKED`, `NOT_APPLICABLE`, and `CONFLICT`; no Phase 4 value is doctor-verified.
