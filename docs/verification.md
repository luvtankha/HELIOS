# Doctor verification

Verification is an implemented doctor-authorized, evidence-first workflow. Supported actions are verify, correct, reject, mark uncertain, confirm current and keep previous; bulk verify is bounded. Requests carry expected fact version and an idempotency UUID. `DoctorVerification` records original/verified value, old/new status, source, evidence references, actor, timestamp, reason/comment and fact version. It is immutable history; correction does not erase origin. Downstream timeline/comparison/brief boundaries can become stale/rebuild.

See [architecture](verification/architecture.md), [state machine](verification/state-machine.md), [provenance](verification/provenance.md), [audit](verification/audit.md), and [security](verification/security.md).
