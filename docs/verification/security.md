# Verification security

Mutation and read routes require the existing HMAC-signed doctor token. The service derives doctor ID from the token and checks an active `DOCTOR` or `ADMIN` database user for every operation. Strict request schemas reject supplied `doctorId`, status, fact ID overrides, and unknown fields.

Opaque review IDs are decoded only into allow-listed fact types; the repository resolves the actual patient from the source row. Patient-scoped reads query only that patient. Document content is returned only after doctor authorization with private, no-store response headers.

Optimistic versions prevent silent lost updates. UUID idempotency keys prevent duplicate actions and cannot be reused for a different fact or action. User-facing errors hide database details.

The current repository has no organization, clinic, care-team, or doctor-patient assignment model. Consequently, active doctors share the same demo-wide patient scope. Production deployment must add organizational identity and assignment authorization before clinical use.
