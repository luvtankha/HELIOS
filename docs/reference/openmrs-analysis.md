# OpenMRS reference analysis

## Scope inspected

The review examined the core Patient, Visit, Encounter, Obs, Concept, Order, and Provider classes, their Hibernate mappings and validators, and representative service tests. No OpenMRS code or test records were imported.

## 1. Useful entities and relationships

OpenMRS clearly separates Visit (a span of care) from Encounter (a point interaction). Encounters contain observations, orders, and participating providers. `Obs` links a patient, encounter, concept, time, optional group, and typed value. Orders link a patient, encounter, concept, orderer, reason, and lifecycle. Concepts carry data type, class, locale-specific names/synonyms, mappings, and set membership.

## 2. Useful clinical representation

- Concept plus typed value is more extensible than adding a column for every measurement.
- Observation groups represent panels or related answers without flattening their relationships.
- Effective clinical time can differ from creation/audit time.
- Voiding/revision preserves history instead of destructive updates.
- Locale-specific concept names and synonyms support multilingual display while retaining a language-neutral identity.

## 3. Useful extensibility and metadata

Attribute types, concept mappings, encounter types, provider roles, validators, and UUID-style external identity provide extension points without altering every core entity.

## 4. Concepts HELIOS should not use

HELIOS does not need OpenMRS's full metadata administration platform, module framework, person/user inheritance hierarchy, order engine, or Java/Hibernate conventions. A generic observation table must not replace well-structured HELIOS medication, allergy, document, interview, and verification entities.

## 5. Recommended HELIOS adaptations

Introduce a compact `Observation` entity with a HELIOS concept key, optional external code/system, typed JSON value, unit/reference range, effective time, status, and provenance. Extend knowledge state with `NOT_APPLICABLE`. Keep question definitions version-controlled in code for deterministic Phase 4 behavior; persist answers and graph version rather than building an OpenMRS-style metadata UI now.
