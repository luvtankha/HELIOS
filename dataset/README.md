# HELIOS synthetic dataset

This directory is produced by `scripts/generate-helios-dataset.mjs` and checked by `scripts/validate-helios-dataset.mjs`.

All identities, conversations, visits, facts, documents, verifications, and timeline events are original deterministic synthetic fixtures. They are not copied from the five reference packages, do not describe real people, are not clinically validated, and do not represent the population or healthcare patterns of India.

Patient-level splitting prevents a patient's visits or paraphrases from crossing train, validation, and test. The seed and reference date are recorded in `generated/manifest.json`.

The FHIR-compatible NDJSON is a lightweight structural mapping fixture, not a certified FHIR profile or production exchange artifact. This phase creates no model weights and performs no training.
