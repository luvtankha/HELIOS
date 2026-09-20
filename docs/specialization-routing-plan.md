# Specialization routing integration plan

Audit: existing Express/Prisma services, signed patient/doctor proofs, Next patient review, clinical interview facts, PostgreSQL users and operational queue are reused. There is no specialty field, patient provider directory or executable SafetyEngine. RiskSignal storage is present and must not be ignored. Existing doctors have no verified specialty/availability metadata.

1. Add normalized specialty, structured condition mappings and immutable routing audit tables; retain all legacy entities. Provider metadata defaults to unverified/unavailable rather than inventing qualifications.
2. Central versioned seed data, source links and explicit clinician-review status; deterministic matching with synonyms, limited fuzzy matching, negation/temporality handling, low-confidence fallback, pediatric context and emergency precedence.
3. Patient-proof-protected recommendation/directory/selection endpoints; derive clinical input on the server. Check emergency rules again at check-in, use existing assignments/queue for a selected eligible provider. No new booking system.
4. Add a compact recommendation/directory card on patient review and doctor-only audit view. Preserve other screens and consultation transitions.
5. Add engine, API/security, database, component and connected workflow tests; rerun all existing regression suites, document limitations and migration/maintenance procedures.

Deployment guard: `ENABLE_SPECIALIZATION_ROUTING` is opt-in (enabled for this local demo). The seed rules are conservative routing-support drafts, not clinically approved triage. Production requires clinical validation and verified provider metadata.
