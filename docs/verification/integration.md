# Verification integrations

## Documents

The Verification Center reuses the Phase 6 `EvidenceViewer` and private document preview path through a doctor-authorized content endpoint. Phase 10 does not rerun OCR or alter source excerpts.

## Timeline

After a committed action, Phase 7 rebuild projects the source fact with its new verification state and adds the immutable doctor-verification event. Timeline versions preserve replaced projections. A rebuild can recover state from source facts and action history.

## What Changed

Active Phase 8 comparisons are marked stale in the same transaction. Regeneration consumes updated timeline verification metadata; the underlying value change is not erased.

## Clinical Brief

Active Phase 9 briefs are marked stale. Brief source queries exclude rejected/superseded facts and render doctor-verified/corrected state separately from patient/document origin. A new version is generated through the existing refresh flow.

## Safety

There is no operational Phase 5 safety engine in this repository. Phase 10 only uses existing non-placeholder risk signals for queue ordering and never creates, modifies, resolves, or clinically interprets a signal. Verified factual inputs form a clean future reevaluation boundary.

## Failure behavior

If the transaction commits but timeline rebuild fails, the action remains saved and the UI reports that related views may need refresh. Comparison and brief remain stale rather than appearing current.
