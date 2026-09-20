# Document AI schema

## Records

- `MedicalDocument`: immutable original metadata, private storage key, SHA-256 hash, type, page count, identity state, document date, content-only summary, and processing state.
- `DocumentProcessingJob`: attempt, state, approximate progress, timestamps, and non-sensitive error code. This supports later queue workers.
- `DocumentExtraction`: provider/model/version, combined OCR text, validated extraction metadata, aggregate confidence, status, and error code.
- `DocumentPage`: page number, OCR text, dimensions, page confidence, derived-image key, and processing state.
- `DocumentFact`: type, original JSON value, optional normalized value, `DOCUMENT_EXTRACTED` provenance, confidence, and review status.
- `DocumentEvidence`: page, exact source text, optional bounding box, and confidence.
- `TimelineEvent.documentId`: unique idempotent link preventing duplicate events for the same file.

## Document types

`PRESCRIPTION`, `LAB_REPORT`, `DISCHARGE_SUMMARY`, `CONSULTATION_NOTE`, and `UNKNOWN`.

## Fact states

`EXTRACTED`, `NEEDS_REVIEW`, `CONFIRMED`, `REJECTED`, and `VERIFIED`. Patient review never produces `VERIFIED`.

## Identity states

`PENDING`, `MATCHED`, `IDENTITY_MISMATCH`, `NOT_PRESENT`, and `MANUAL_OVERRIDE`.

## Entity contract

Each extracted fact requires `factType`, `originalValue`, confidence from 0–1, positive page number, and non-empty source text. `normalizedValue` and bounding box are optional and are never fabricated. Medication values preserve historical/current/unknown status; Phase 6 emits historical. Lab values include test, numeric result, unit, reference range, and abnormal flag only when those strings occur in the source.
