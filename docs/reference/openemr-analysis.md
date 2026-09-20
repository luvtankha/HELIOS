# OpenEMR reference analysis

## Scope inspected

The review covered the REST/FHIR documentation, EHI export examples, schema definitions for patient/encounter/list/prescription/document/procedure data, patient workflow materials, and the service/controller/API organization. OpenEMR remains an external reference under its own license; no application code or patient records were copied into HELIOS.

## 1. Useful entities

- Patient demographics and identifiers separated from encounters.
- Encounters as dated clinical contexts rather than mutable properties on a patient.
- Problem/allergy/medication lists with lifecycle status and dates.
- Prescriptions distinct from medication history.
- Procedure orders/results and documents as separately addressable records.
- Practitioner, organization, location, and provenance concepts for future interoperability.

## 2. Useful relationships

- A patient owns many encounters; an encounter groups observations, notes, orders, and documents.
- Documents retain patient and encounter context while remaining independently retrievable.
- Medication/allergy records can be longitudinal and optionally encounter-linked.
- Provider participation is contextual to an encounter rather than embedded in every fact.

## 3. Useful field concepts

Stable identifiers, status/effective periods, authored/recorded timestamps, encounter type, document MIME/storage metadata, medication dose/route/frequency, allergy reaction/severity, observation code/value/unit/reference range, and explicit provenance.

## 4. Useful workflow concepts

Search before creating a patient, open/close visit lifecycle, granular record status, append/amend rather than silent replacement, document processing state, and capability discovery for external clients.

## 5. Useful API concepts

Resource-oriented patient/encounter/observation/document endpoints, consistent search filters, scoped access, versioned APIs, capability metadata, and asynchronous bulk export. HELIOS should retain its smaller controller/service/repository stack and later expose a mapping layer rather than reproduce OpenEMR endpoints.

## 6. Concepts HELIOS should not use

- The large legacy table surface and billing/claims-oriented structures.
- OpenEMR-specific PHP modules, UI workflows, access-control implementation, or US-specific compliance assumptions.
- Direct reuse of schema/table names or generated sample content.
- Full SMART/FHIR server complexity before HELIOS has stable internal semantics.

## 7. Recommended HELIOS adaptations

Add a typed `Observation` record for vitals/labs, richer provenance values, effective/recorded time separation, and external-code slots. Preserve the existing Visit boundary, document lifecycle, and repository architecture. Treat FHIR as an export/import mapping and keep internal IDs stable and independent of FHIR resource IDs.
