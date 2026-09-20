# Synthea reference analysis

## Scope inspected

The review covered Synthea's generator entry points and seed controls, modular state approach, `HealthRecord` entries, encounter generation, CSV/FHIR exporters, configuration, and representative export tests. HELIOS does not import Synthea output or disease modules.

## Useful concepts

- Reproducible seeded generation with an explicit reference date.
- A patient-owned longitudinal record containing encounters, observations, medications, allergies, procedures, and care events.
- Rule/module separation from export formatting.
- Multiple projections of the same canonical record: JSON/NDJSON, CSV, and FHIR.
- Stable referential IDs and tests that validate exporters.
- Configuration-driven population size and deterministic generation.

## HELIOS-specific adaptation

The HELIOS generator uses a small deterministic case-template library suited to its intake pathways, Indian-region testing contexts, English/Hindi/Hinglish utterances, provenance, contradictions, document extraction, doctor verification, and timeline comparisons. One synthetic patient is assigned to exactly one train/validation/test split before any visit or paraphrase is emitted. All outputs derive from the same in-memory canonical record, preventing cross-format drift.

## Concepts not adopted

Synthea's US census demographics, disease progression modules, insurance/cost model, clinical probability claims, and complete birth-to-death simulation are not appropriate evidence for an Indian pre-consultation prototype. HELIOS-generated distributions are deliberately test distributions and are not population estimates or clinically validated trajectories.
