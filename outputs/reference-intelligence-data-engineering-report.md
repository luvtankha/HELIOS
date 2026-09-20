# HELIOS reference intelligence + dataset engineering report

Scope: post-Phase-4 reference analysis, additive data architecture, original synthetic corpus generation, and evaluation infrastructure. No model was trained and Phase 5 was not started.

## 1. Reference architecture findings

HELIOS should keep its controller/service/repository architecture and its existing separation of patient, session, visit, interview, voice, document, verification, consent, audit, and timeline records. The references consistently support stable patient identity, dated care contexts, typed measurements, explicit lifecycle status, effective time distinct from audit time, immutable provenance, and export projections from a canonical internal record. Raw FHIR or an external EHR schema should not become the HELIOS storage model.

The resulting design adds only the missing cross-cutting primitives: typed observations, full provenance vocabulary, explicit knowledge states, richer verification outcomes, and interview-graph versioning. The extracted projects remain read-only references; their application code, schemas, conversations, and records were not copied into HELIOS output.

## 2. Most useful OpenEMR concepts

- Stable patient identifiers and encounter-scoped records.
- Documents, prescriptions, procedures, and observations as independently addressable resources.
- Status/effective-period handling, append/amend workflows, scoped APIs, and capability discovery.
- FHIR as an interoperability surface.

HELIOS did not adopt OpenEMR's large legacy table surface, billing-oriented structures, PHP modules, UI, or US-specific assumptions.

## 3. Most useful OpenMRS concepts

- Visit as a span of care and Encounter as an interaction within that span.
- `Concept + typed Obs value + unit + clinical time` as a flexible measurement model.
- Locale-aware names/synonyms while retaining a language-neutral concept identity.
- Revision/void semantics that preserve history.

HELIOS adopted a compact `Observation`, not the OpenMRS metadata platform, module framework, order engine, or Java/Hibernate architecture.

## 4. Most useful Synthea concepts

- Seeded generation with a fixed reference date.
- One canonical patient-owned longitudinal record projected into multiple formats.
- Stable referential IDs and exporter validation.
- Splitting patients before emitting visits, paraphrases, or derived examples.

The HELIOS generator is original and case-template-driven. It does not import Synthea records, US population distributions, disease modules, costs, or clinical probabilities.

## 5. Most useful MTS-Dialog concepts

- Explicit conversation input, speaker turns, section labels, and structured-summary targets.
- Clinical-history categories such as chief complaint, HPI, medications, allergies, family/social history, review of systems, labs, and procedures.
- Evaluation based on fact precision, omissions, unsupported facts, field/state/value accuracy, and correction handling rather than text overlap alone.

HELIOS excludes assessment, diagnosis, plan, treatment, and disposition from patient-intake targets unless a diagnosis is explicitly documented as historical source data.

## 6. Most useful Indic speech concepts

- Separate selected language, transcript language, native script, English normalization, code-mixed status, and speaker role.
- Preserve original orthography and map it to language-neutral structured facts.
- Evaluate ASR error and downstream semantic fact accuracy by language/script subset.

The inspected reference has nine manifest rows and one conversation per listed language, so it was used only as a structural reference. No source audio or transcript was copied. Current generated coverage is English, Hindi, and Hinglish (`hi-Latn`).

## 7. HELIOS changes made

- Added five individual reference analyses, a master comparison, FHIR mapping, and prioritized integration plan under `docs/reference/`.
- Added an original deterministic dataset generator and validator.
- Added a typed `ObservationRepository` and repository test.
- Added corpus-backed tests for thresholds, synthetic markers, patient split isolation, all 11 benchmark tasks, all difficult-case categories, clarification/conflict labels, timeline deltas, doctor verification, and English/Hindi/Hinglish routing.
- Extended the abdominal-pain classifier to recognize romanized Hindi `pet` used by Hinglish fixtures.
- Updated root and domain documentation and excluded read-only references/large generated outputs from formatting.

The Phase 4 visual design, patient flow, deterministic question graph, and six existing demo pathways were not rewritten.

## 8. New database changes

Migration: `apps/api/prisma/migrations/20260909120000_reference_data_architecture/migration.sql`.

- `ClinicalSource`: added `DOCUMENT_EXTRACTED` and `SYSTEM_GENERATED`.
- `KnowledgeState`: persistent enum with `YES`, `NO`, `UNKNOWN`, `NOT_ASKED`, `NOT_APPLICABLE`, and `CONFLICT`.
- `VerificationStatus`: added `PARTIALLY_CORRECT` and `MISSED`.
- `Interview.questionGraphVersion`: required, defaulting to `phase4-v1`.
- `Observation`: patient/optional visit relations; concept key/display; optional code system/code/category; JSON value/reference range; unit; knowledge state; status; effective time; provenance; audit timestamps and indexes.

No mutable `InterviewQuestion` catalog was added. Question definitions remain version-controlled code, while answers and graph version are persisted for reproducibility.

## 9. New schemas

- `dataset/schemas/helios-dataset.schema.json` describes the HELIOS synthetic record structures.
- Shared TypeScript contracts now expose the expanded knowledge/provenance vocabulary and `ObservationDto`.
- Dataset projections include JSON, JSONL, CSV, and lightweight FHIR-compatible NDJSON for Patient, Encounter, and Observation.

The FHIR files are mapping fixtures, not certified profiles, bundles, or production exchange artifacts.

## 10. Dataset generation method

`scripts/generate-helios-dataset.mjs` uses seed `26047` and fixed reference time `2026-01-15T09:00:00.000Z`. It creates 1,000 synthetic people across age, sex, urban/rural context, ten Indian states/regions, and three supported language modes. Each person receives one to five visits drawn from 13 requested documentation case types. The generator then derives clinical facts, six-turn conversations, summaries, documents and extraction targets, timeline events/comparisons, doctor-verification examples, speech-evaluation rows, benchmark tasks, CSV exports, FHIR NDJSON, and patient-grouped splits from the same in-memory records.

All identities and content are synthetic. There are no real patient identifiers, copied medical records, copied dialogues, or copied reference transcripts.

## 11. Actual dataset counts

| Artifact               |  Count |
| ---------------------- | -----: |
| Patients               |  1,000 |
| Visits                 |  3,000 |
| Clinical facts         | 15,000 |
| Clinical summaries     |  3,000 |
| Conversations          |  3,000 |
| Utterances             | 18,000 |
| Documents              |  1,000 |
| Timeline events        |  7,000 |
| Evaluation cases       |  3,000 |
| Doctor verifications   |  1,000 |
| Speech-evaluation rows |  9,000 |
| Timeline comparisons   |  1,000 |

Every requested minimum was met.

## 12. Validation results

`scripts/validate-helios-dataset.mjs` reports **PASS** with zero validation errors, duplicate IDs, orphan references, schema failures, invalid dates, patient split leaks, conversation-order failures, or timeline-order failures. It also requires all benchmark tasks, difficult-case categories, timeline delta states, and verification outcomes.

Engineering gates:

| Gate                     | Result                                            |
| ------------------------ | ------------------------------------------------- |
| Format                   | Passed                                            |
| Lint                     | Passed                                            |
| Strict typecheck         | Passed                                            |
| API tests                | 59 passed; 4 PostgreSQL integration tests skipped |
| Web tests                | 16 passed                                         |
| Dataset validation       | Passed                                            |
| Prisma schema validation | Passed                                            |
| Production build         | Passed                                            |

The four database integration tests require a configured `DATABASE_INTEGRATION_URL`; no live PostgreSQL service was available. Repository tests and Prisma validation passed.

## 13. Train/validation/test counts

Splits are assigned by deterministic patient hash before any visit or conversation is emitted. All records for a patient remain in one split.

| Split      | Patients |
| ---------- | -------: |
| Train      |      790 |
| Validation |      119 |
| Test       |       91 |

Observed patient-level leakage: **0**.

## 14. Difficult-case counts

| Difficulty             | Conversations |
| ---------------------- | ------------: |
| Ambiguous              |           230 |
| Colloquial             |           231 |
| Contradictory          |           231 |
| Correction             |           230 |
| Incomplete             |           231 |
| Irrelevant response    |           232 |
| Misunderstood question |           229 |
| Mixed language         |           231 |
| Multiple symptoms      |           232 |
| Standard               |           229 |
| Transcription error    |           231 |
| Uncertain duration     |           232 |
| Uncertain severity     |           231 |

Ambiguous, incomplete, irrelevant, uncertain, transcription-error, and misunderstood answers explicitly expect clarification. Contradictory later answers expect `CONFLICT` rather than silent overwrite.

## 15. Language counts

| Utterance language   | Count |
| -------------------- | ----: |
| English (`en`)       | 5,544 |
| Hindi (`hi`)         | 5,544 |
| Hinglish (`hi-Latn`) | 6,912 |

The speech evaluation contains text references and metadata only; `audioAvailable` is explicitly false.

## 16. Integration recommendations for Phase 5+

1. Phase 5 safety: consume only confirmed facts and explicit states; have clinically reviewed deterministic rules; use the difficult clarification/conflict cases as regression tests. Do not infer safety from this synthetic corpus.
2. Phase 6 document intelligence: evaluate against synthetic entity targets first, preserve `DOCUMENT_EXTRACTED`, require doctor verification before promotion, and later add separately licensed scanned/image fixtures.
3. Timeline: implement delta computation over typed facts and observations; report only `NEW`, `REMOVED`, `CHANGED`, and `UNCHANGED` without unsupported interpretation.
4. Doctor review: expose provenance and all verification outcomes, preserve original and edited values, and record verifier/time.
5. Speech: add licensed, segmented audio with timing/diarization metadata and report WER/CER plus semantic fact accuracy separately for native-script and code-mixed speech.
6. Interoperability: validate mappings against the chosen FHIR R4/ABDM implementation guide before exposing production import/export.
7. Terminology: introduce a small clinically governed multilingual concept catalog before broadening the controlled question graph.

These are recommendations only. Phase 5 has not been started.

## 17. Known limitations

- The corpus is deterministic synthetic test data, not clinically validated evidence and not representative of India.
- Clinical content uses a bounded template library across 13 complaint types; it does not model real prevalence, comorbidity, disease progression, or diagnostic truth.
- Speech rows have no generated audio, accents, diarization timestamps, or acoustic noise.
- Documents are structured synthetic text, not rendered prescriptions/scans, so OCR realism is limited.
- The FHIR projection is intentionally lightweight and has not been validated against a deployment-specific implementation guide.
- The Phase 4 engine still intentionally supports six controlled pathways; broader corpus cases are future evaluation inputs, not newly activated clinical flows.
- Persistent integration was not exercised against a live PostgreSQL instance in this environment.
- No fine-tuning, model weights, safety engine, diagnosis engine, or Phase 5 implementation was created.
