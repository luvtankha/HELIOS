# Timeline limitations

- The timeline is not a diagnosis or disease-progression engine.
- Phase 8 comparison language such as “improved” or “worsened” is intentionally absent.
- Relative temporal phrases are stored without inventing dates unless an upstream normalized date is supplied.
- Existing medication/allergy entities lack a dedicated effective date and therefore project with unknown date/state unless their source explicitly provides one.
- A patient UI is implemented. A more detailed doctor view requires production clinician authentication and authorization and is not exposed through the patient session token.
- Persisted `RiskSignal` rows can be displayed as system-generated safety signals. This checkout still has no operational Phase 5 `SafetyEngine`.
- Live PostgreSQL migration/rebuild verification requires `TEST_DATABASE_URL`; unit/API/UI behavior uses controlled test doubles when it is absent.
