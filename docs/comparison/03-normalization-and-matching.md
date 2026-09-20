# Normalization and matching

Matching is conservative and deterministic. Unicode text is normalized, case and punctuation are removed, whitespace is collapsed, and a small controlled alias map is applied (`Hb`/`haemoglobin` → `hemoglobin`, `Glucophage` → `metformin`, and specified breathing terms). There is no unconstrained fuzzy match in the clinical core.

Facts match only on `(entityType, canonicalEntityKey)`. Multiple facts with the same identity in either snapshot are `CONFLICTED` for review instead of being silently selected.

Numeric comparisons accept numbers and units. Only controlled mass conversions (`mcg`, `mg`, `g`) are converted. Identical other units are compared as recorded; incompatible units are `NOT_COMPARABLE`. Numeric changes include absolute and percentage deltas when the prior value is nonzero. No clinical interpretation is performed.
