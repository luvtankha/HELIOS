# AYUSH verification

`AYUSH_RECORD` extends Phase 10's existing `VerificationFactType`. The same queue, detail, evidence, immutable history, audit, optimistic version, and idempotency controls provide verify, structured correct, reject, and mark-uncertain actions.

Current records in the same AYUSH system with different names are surfaced as a conflict even when their sources differ. A doctor must use an explicit conflict decision; generic verify is blocked. Correction uses an allowlist and validated system/use-state enums. Original source wording is immutable.

AI, document processing, and patient sessions cannot invoke a doctor action. A doctor token and active doctor/admin database role are required.
