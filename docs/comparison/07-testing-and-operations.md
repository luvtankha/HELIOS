# Testing and operations

Tests under `apps/api/tests/comparison` cover every change class, allergy absence, unknown versus not-asked, unit conversion, incompatible units, deltas, verified/unverified conflict, duplicates, deterministic output, rejected records, doctor-proof tampering, validation, and filters.

The evaluation fixture is synthetic-only. Its accuracy is a regression signal, not a clinical performance claim. No real patient data or inferred labels are used.

Operations must set a strong `SESSION_TOKEN_SECRET`, control `DOCTOR_DEMO_ACCESS_CODE`, disable demo mode outside approved demonstrations, apply migrations, and seed only synthetic environments. Replace demo sign-in before production. Phase 5’s operational safety engine and a production clinician identity provider remain absent; Phase 8 does not simulate them.
