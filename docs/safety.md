# Clinical safety boundary

**Phase 5 SafetyEngine: NOT IMPLEMENTED.** The schema contains `RiskSignal`, severity/status enums and timeline/comparison support for persisted signals, and some doctor surfaces can display stored signals. There is **no executable, versioned rule set** that ingests symptoms, negation, historical values, unknowns and provenance to produce clinically validated attention signals. The seeded `PRIORITY_REVIEW` queue badge is an operational demo cue, not a derived safety finding. The Phase 21 reset validator reports `safetyEngine: UNAVAILABLE`.

Accordingly, HELIOS cannot claim that it screens for emergencies, rules out danger, triages clinically, recommends care, or gives a “safe” result when no signal appears. A clinician must independently evaluate the patient and source material. Unknown, conflicting, or missing data must not be turned into reassurance. Before any SafetyEngine is introduced it would require clinician-approved rules, explicit versioning and provenance, tests for negation/temporality/conflicts/missing data, safe escalation design, clinical evaluation and governance. These are **planned requirements**, not current controls.

See [Phase 19 release blocker](phase19-testing-report.md), [limitations](limitations.md), and [AYUSH safety boundary](ayush/safety-boundary.md).
