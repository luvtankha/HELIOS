# Demo reset

The protected `/doctor/sih-demo` page calls `POST /api/v1/demo/reset` after explicit confirmation. The backend requires non-production mode, all explicit demo gates, a local demo-named URL matching PostgreSQL `current_database()`, the designated active `demo.doctor`, and no concurrent reset. It invokes the deterministic fixture→demo cleanup→seed→strict validation pipeline and writes a metadata-only success/failure audit.

Reset covers synthetic patient-linked data, visits/interviews/documents/timeline/comparisons/briefs/verifications, demo queue/counters/users, and only the contained `demo-synthetic` storage subtree. It preserves presenter authentication through a stable re-seeded identity and preserves operational audit history. Patient tabs clear stale demo state through a reset-generation signal/poll; doctor screens reload/poll backend data.

CLI recovery:

```powershell
pnpm demo:reset
pnpm demo:verify
```

The SQL cleanup is transactional, but SQL + filesystem + process-wide reseeding cannot share one transaction. On failure the API returns 503; rerun both commands and do not present until verification passes. Full design, tests, timings, exact counts and limitations are in [Phase 21 report](phase21-demo-reset.md).
