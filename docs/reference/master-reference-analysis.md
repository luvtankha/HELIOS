# HELIOS master reference analysis

## Comparative map

| HELIOS need                           | Best reference                     | Useful concept                                            | HELIOS adaptation                                                       |
| ------------------------------------- | ---------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------- |
| Patient identity and record lifecycle | OpenEMR + OpenMRS                  | Stable identity, dated encounters, statuses               | Keep `PatientProfile`; attach clinical records to Visits                |
| Visit/interaction hierarchy           | OpenMRS                            | Visit contains encounters                                 | Keep one intake Visit now; reserve encounter-compatible mapping         |
| Flexible clinical measurements        | OpenMRS                            | Concept + typed Obs value                                 | Add compact `Observation` with concept key/code/value/unit/time         |
| Documents and workflow                | OpenEMR                            | DocumentReference-like metadata and processing state      | Keep MedicalDocument/Extraction; enrich synthetic evaluation            |
| Secure APIs                           | OpenEMR                            | Scoped resource APIs and capability discovery             | Retain HELIOS HMAC session boundary; plan scoped clinician APIs later   |
| Longitudinal synthesis                | Synthea                            | Seeded patient-owned records and exporters                | Build original HELIOS generator with canonical records and projections  |
| Multi-format export                   | Synthea                            | CSV, FHIR, NDJSON from one model                          | Emit JSON, JSONL, CSV, and compact FHIR-compatible NDJSON               |
| Dialogue-to-history                   | MTS-Dialog                         | Section-aware turns and summaries                         | Emit speaker turns, expected facts/state changes, and structured briefs |
| Hallucination evaluation              | MTS-Dialog                         | Factuality and omission analysis                          | Benchmark unsupported facts, omissions, field/state/value accuracy      |
| Indic speech metadata                 | Indic speech                       | Native/English transcript links, language and audio paths | Add language/script/code-mixed/speaker/audio metadata contracts         |
| Split integrity                       | Synthea + dialogue datasets        | Reproducibility and fixed splits                          | Split by patient before creating visits/paraphrases                     |
| Interoperability                      | All three EHR/synthetic references | Patient/Encounter/Observation/Medication/FHIR concepts    | Maintain a mapping layer; never make raw FHIR the internal domain       |

## What HELIOS already does well

HELIOS already separates PatientSession, PatientProfile, Visit, ClinicalHistory, Symptoms, Medications, Allergies, Documents, Timeline, RiskSignal, DoctorVerification, Consent, AuditLog, Interview/Response, VoiceInteraction, and AI metadata. Phase 4 already preserves raw answers, source, confidence, unknown/conflict states, deterministic flow, confirmation, and provider fallback. Its controller/service/repository boundary should remain unchanged.

## Material gaps

1. No general typed Observation for vitals/labs or externally coded measurements.
2. Clinical provenance lacks `DOCUMENT_EXTRACTED` and `SYSTEM_GENERATED`.
3. Knowledge state lacks `NOT_APPLICABLE` in shared and persistent vocabulary.
4. Verification outcomes cannot distinguish partially correct extraction from missed information.
5. No original longitudinal/multilingual/document/verification benchmark with leakage-safe splits.
6. No formal compact FHIR mapping.

## Changes justified now

Add provenance and verification enum values, `KnowledgeState`, a typed `Observation` entity, graph-version metadata on Interview, dataset schemas/generator/validator, and reference documentation. These are additive and do not alter Phase 4 patient flow or visual design.

## What remains unchanged

- Phase 4 deterministic question selection and six demo pathways.
- Question definitions in version-controlled code instead of a mutable database catalog.
- Existing normalized Medication, Allergy, Symptom, Document, and DoctorVerification entities.
- No diagnosis, prescribing, emergency declaration, model training, or clinical-validation claims.

## Future consumers

- Phase 5 may consume difficult contradiction/unknown cases but must define independently reviewed safety rules.
- Phase 6 document intelligence may consume synthetic document/entity pairs.
- Timeline and doctor-review phases may consume longitudinal deltas and verification edits.
- Speech work may consume the English/Hindi/Hinglish semantic benchmark and later properly licensed, segmented audio evaluations.
