# AYUSH architecture

Phase 11 adds AYUSH as ordinary longitudinal healthcare information, not as a separate clinical product. `AyushRecord` is the structured source record. Patient interview, voice transcript, and document extraction feed it; the existing Doctor Verification ledger confirms or corrects it; the existing Timeline, Comparison, and Clinical Brief consume it.

The service boundary is `AyushService` over `AyushRepository`. Patient calls are bound to the signed patient session and patient ID. Doctor calls derive identity from the signed doctor token and an active database role. Mutations create audit entries, stale existing comparisons/briefs, and request a Timeline rebuild. A failed rebuild does not erase an already committed source record.

No AYUSH prescribing, diagnosis, recommendation, efficacy evaluation, causality engine, interaction engine, duplicate Timeline, duplicate OCR pipeline, or duplicate verification ledger exists.

## API

- `GET/POST /api/v1/patients/:patientId/ayush` uses `x-session-token` and enforces patient-session ownership.
- `GET/POST /api/v1/doctor/patients/:patientId/ayush` uses `x-doctor-token` and an active doctor/admin role.
- `GET /api/v1/doctor/ayush/:recordId` returns a doctor-authorized evidence view.
- AYUSH verification uses the existing `/api/v1/verification/:verificationId/*` actions and history APIs.

Invalid IDs return not-found, cross-patient sessions return 403, malformed bodies return structured validation errors, and inactive/invalid doctor sessions cannot read or mutate doctor data.
