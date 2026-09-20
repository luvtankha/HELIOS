# Verification audit

The source-fact update, `DoctorVerification` insert, `AuditLog` insert, and comparison/brief invalidation occur in one database transaction. Failure rolls back all four.

`DoctorVerification` is the detailed immutable clinical decision history. `AuditLog` records actor, action, patient/fact identifiers, verification ID, source type, old/new states, original/result values required for correction traceability, reason, request ID, and timestamp. Existing retention rules apply; Phase 10 exposes no deletion or destructive undo API.

Unique idempotency keys make a repeated network request return the original action. Optimistic fact versions reject a different stale decision. A later doctor correction creates a new row rather than rewriting an earlier decision.

Internal comments are returned only through doctor-authorized verification APIs and are not added to patient DTOs.
