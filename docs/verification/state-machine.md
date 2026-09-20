# Verification state machine

Source facts enter as `UNREVIEWED`, `PATIENT_REPORTED`, `AI_STRUCTURED`, `DOCUMENT_EXTRACTED`, or `NEEDS_REVIEW`.

Legal human outcomes are:

- `VERIFY` or `CONFIRM_CURRENT` → `DOCTOR_VERIFIED`
- `CORRECT` → `DOCTOR_CORRECTED`
- `REJECT` or `KEEP_PREVIOUS` → `DOCTOR_REJECTED`
- `MARK_UNCERTAIN` → `NEEDS_REVIEW`
- replacement where explicitly supported → `SUPERSEDED`

Conflicts cannot use generic verify; the doctor must select confirm current or keep previous. Correction, rejection, and both conflict decisions require a reason. Correct requires a non-empty structured value. Evidence must be available for every final action.

Rejected and superseded facts cannot accept a new action. Already verified/corrected facts cannot be verified again, but a later corrective, rejection, or uncertainty event may be recorded rather than destructively undoing history.

Every request includes the displayed fact version. A version mismatch returns `VERIFICATION_STALE_REVIEW` and requires refresh.
