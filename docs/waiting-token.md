# Waiting and token system

Check-in creates one backend `QueueEntry` per visit using a transactional date/key counter and returns a daily token. Statuses are WAITING, CALLED, IN_CONSULTATION, COMPLETED, CANCELLED, NO_SHOW and SKIPPED. Doctor actions include call/call-next, start, complete, skip, no-show, cancel and requeue; pause/resume applies to the queue. Position and estimated wait are calculated server-side. Priority values are NORMAL/PRIORITY_REVIEW and are not SafetyEngine results.

Check-in is visit-idempotent; sequence uniqueness is enforced per queue/date, and service retries bounded serialization conflicts. Verification of broader multi-instance concurrency is incomplete. Patient and doctor pages poll approximately every eight seconds; there is no WebSocket/SSE. See [queue architecture](queue/architecture.md) and [API](api.md).
