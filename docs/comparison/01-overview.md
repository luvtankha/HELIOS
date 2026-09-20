# Phase 8 comparison overview

HELIOS “What changed?” is a deterministic, doctor-facing comparison of two visit records. It reports recorded differences without diagnosing, interpreting progression, predicting risk, or deciding clinical importance.

The flow is: timeline source records → immutable visit snapshots → normalized entity matching → field comparison → classified change records → clinician review. Generated comparisons are cached by both snapshot hashes and engine version. A changed source revision makes an existing comparison `STALE`; generating again creates or reuses the appropriate new result.

Phase 8 reads existing safety signals and may link them as evidence. It never creates or recalculates a safety signal.
