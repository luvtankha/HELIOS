# API and security

Doctor routes use `x-doctor-token`. The HMAC token proves a user ID, and every protected operation checks the database user is active with `DOCTOR` or `ADMIN` role. Visit pairs are queried within the requested patient, rejecting cross-patient comparison.

`POST /api/v1/doctor-sessions` is deliberately demo-only and accepts the seeded username plus `DOCTOR_DEMO_ACCESS_CODE`; it is unavailable when demo mode is disabled. This is not production authentication. Production must use an identity provider, short-lived sessions, rotation, revocation, CSRF policy, and organization authorization.

Endpoints include `GET /doctor/patients`, create and quick comparison under `/patients/:patientId/comparisons`, comparison list/detail, filtered `/comparisons/:id/changes`, and individual change detail. Filters are `changeType`, `entityType`, and `needsReview`.

Audit records contain identifiers, action, request ID, and counts—not clinical values.
