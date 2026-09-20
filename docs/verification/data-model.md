# Verification data model

`DoctorVerification` is an immutable decision event. It stores patient and optional visit, typed fact reference, action, previous and new states, original and resulting values, unchanged source type, evidence references, reason, internal comment, authenticated doctor, action time, resulting fact version, and a unique idempotency key.

Reviewable source models carry `verificationStatus` and monotonic `verificationVersion`. Medication and allergy retain their existing `verifiedAt`; document facts retain their original value and evidence even when their normalized value is corrected.

Source and verification are independent. A patient-reported medication confirmed by a doctor remains `source = PATIENT_REPORTED` while its verification state becomes `DOCTOR_VERIFIED`. A correction updates only approved structured fields; its action record preserves both values.

The clinical event date is stored on the source fact. `DoctorVerification.verifiedAt` is the later decision date and never moves the clinical event.

Enums constrain fact type, action, and state. Existing legacy verification values remain in the database enum for migration compatibility but serialize to the Phase 10 state vocabulary.
