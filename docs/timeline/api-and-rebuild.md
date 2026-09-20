# Timeline API and rebuild

`GET /api/v1/patients/:patientId/timeline` supports ISO `from`/`to`, event type, source, verification status, 1–50 item limits, opaque cursor, and ascending/descending sort. `GET /api/v1/timeline/:eventId` returns the event, bounded visit/document context, evidence, and version metadata. `POST /api/v1/patients/:patientId/timeline/rebuild` reconstructs only that patient.

The patient UI initializes its projection once and uses incremental filtered queries afterward. Completed document processing and fact review project only the affected document. Soft document removal rejects only that document's events. A rebuild upserts stable fingerprints and rejects stale projections with version snapshots.

The current implementation uses sequential transactional upserts for clear version behavior. Production scale may require a durable queue, batch strategy, and concurrency control.
