# Verification architecture

Phase 10 adds an authorized human decision layer over existing HELIOS facts. It does not ingest, extract, compare, summarize, or infer safety.

The runtime flow is:

`source fact → review projection → evidence-first doctor review → validated action → database transaction → immutable DoctorVerification + AuditLog → source-fact state → dependent invalidation → timeline rebuild`

The queue is a projection, not a second clinical record. Its opaque `reviewId` encodes a validated fact type and fact ID. The server resolves patient ownership, source, evidence, current version, and acting doctor; browser-supplied identity and status are ignored.

Supported review subjects are clinical history, symptoms, medications, allergies, observations, normalized document facts, and interview responses. Phase 6 remains responsible for document extraction and rendering, Phase 7 for timeline projection, Phase 8 for comparison, and Phase 9 for briefs.

All decisions work without an LLM. No service path permits model-initiated verify, correct, reject, or uncertain actions.

## API

- `GET /api/v1/verification-queue`
- `GET /api/v1/patients/:patientId/verification-queue`
- `GET /api/v1/verification/:reviewId`
- `POST /api/v1/verification/:reviewId/verify`
- `POST /api/v1/verification/:reviewId/correct`
- `POST /api/v1/verification/:reviewId/reject`
- `POST /api/v1/verification/:reviewId/uncertain`
- `POST /api/v1/verification/:reviewId/confirm-current`
- `POST /api/v1/verification/:reviewId/keep-previous`
- `POST /api/v1/verification/bulk-verify`
- `GET /api/v1/patients/:patientId/verification-history`
- `GET /api/v1/verification/documents/:documentId`
- `GET /api/v1/verification/documents/:documentId/content`
