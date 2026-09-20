# Change semantics

- `NEW`: recorded now with no matching previous fact.
- `REMOVED`: previously recorded but not reported now. This does not mean stopped or resolved.
- `CHANGED`: matched facts have different comparable normalized fields.
- `UNCHANGED`: matched normalized fields are equal.
- `CONFLICTED`: duplicate facts or an unverified current value differs from a doctor-verified prior value.
- `UNKNOWN`: current knowledge is unknown, or an allergy is absent now. Absence never proves allergy removal.
- `NOT_COMPARABLE`: values or units cannot be compared safely.
- `NEWLY_CAPTURED`: known now but explicitly `UNKNOWN` or `NOT_ASKED` previously.

Descriptions are fixed templates and avoid implications of worsening, improvement, diagnosis, causality, adherence, risk, or resolution.
