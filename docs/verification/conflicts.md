# Conflict handling

Phase 10 detects a workflow conflict when an unresolved fact shares patient, fact type, and normalized key with an older doctor-verified/corrected fact but has a different structured value.

The review panel presents previous and current values side by side with independent source and verification badges. It does not prefer the newer value.

`CONFIRM_CURRENT` verifies the current source fact and preserves the older record historically. `KEEP_PREVIOUS` rejects the current proposed fact while leaving the previous verified fact active. `MARK_UNCERTAIN` keeps the proposal in needs-review state. Every final conflict decision requires explicit doctor confirmation and a reason.

Phase 8 still owns longitudinal change classification. Regeneration keeps the fact that a value changed while reflecting the updated verification status.
