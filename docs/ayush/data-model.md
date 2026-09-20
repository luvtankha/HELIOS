# AYUSH data model

`AyushRecord` links to Patient and optionally Visit, Interview, MedicalDocument, and DocumentFact. Controlled enums cover system (`AYURVEDA`, `YOGA_NATUROPATHY`, `UNANI`, `SIDDHA`, `HOMOEOPATHY`, `OTHER_TRADITIONAL_SYSTEM`, `UNKNOWN`), use state (`CURRENT`, `HISTORICAL`, `STOPPED`, `UNKNOWN`, `NOT_DOCUMENTED`), and temporal relationship.

The record separately stores original and normalized names, explicitly documented ingredients, dose/frequency/route, practitioner details, reported indication, dates, reported effect, source, verification status/version, evidence, and timestamps. An old document defaults to historical use; it never implies current or stopped use. `originalName` is not writable through doctor correction.

The migration is additive and does not reinterpret conventional Medication records. AYUSH allergy reports continue to use the existing Allergy model where appropriate.
