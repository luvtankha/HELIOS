# Limitations

This repository still lacks an operational Phase 5 safety engine and production clinician identity/assignment system. Phase 9 consumes a non-placeholder stored risk signal when one exists; otherwise it says safety status is unavailable. It does not say there are no concerns.

The HMAC doctor session is demo-only. Role authorization is enforced, visit ownership is patient-bound, and claim IDs are brief-bound, but production needs organization identity, clinician-patient assignment, revocation, and policy controls. The checked-in migration requires a configured PostgreSQL deployment. No diagnosis, treatment, prognosis, clinical ranking, or regulatory claim is made.
