# Timeline temporal and provenance model

`eventDate` is when the represented event occurred. It is nullable. `recordedAt` is when HELIOS or the source system recorded it; `createdAt` is when the index row was created. Default ordering is event date, recording time, creation time, then ID. Upload time never replaces a known document date.

Date precision is `EXACT_DATE`, `MONTH_ONLY`, `YEAR_ONLY`, `DATE_RANGE`, or `UNKNOWN`. A date range may also have `eventEndDate`. A normalized phrase such as “about three years ago” can be retained in `temporalText` without manufacturing a calendar day.

Temporal state is independent of verification: `CURRENT`, `HISTORICAL`, `UNKNOWN`, `DISCONTINUED`, or `NOT_APPLICABLE`. Discontinued is used only when explicitly recorded. Medication action is independently represented as started, reported, changed, confirmed, or discontinued; document medications are projected as historical/reported.

`source` describes provenance; `verificationStatus` describes review state. `sourceType` and `sourceId` identify the underlying entity. Optional visit/document/fact IDs, source text, page, confidence, original/normalized values, group key, and evidence preserve traceability.
