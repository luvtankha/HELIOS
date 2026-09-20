# Deployment requirements and boundary

HELIOS has build/start scripts but is **not established as production-ready for real patient data**.

```powershell
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm build
pnpm start
```

Deploy one Next.js web process (`apps/web`), one Express API process (`apps/api`), PostgreSQL, and private durable storage. Configure HTTPS at a trusted reverse proxy, exact `WEB_ORIGIN`/API URL, non-default signing secrets, least-privilege PostgreSQL credentials/TLS/network policy, non-public storage, provider keys only when selected, centralized restricted logs, health probes (`/health`), migrations before traffic, and tested backup/restore. A multi-instance deployment additionally needs distributed throttling and reset/queue coordination; current limiters/reset mutex are in-process.

For a local SIH demonstration use only the isolated `helios_sih_demo` profile and `pnpm demo:migrate`, `pnpm demo:reset`, `pnpm demo:verify`, `pnpm demo:dev`. Production must disable all demo flags and must not expose demo login/reset. Before real use, add production IdP/MFA and tenancy, retention/deletion, encryption/key management, object storage/malware scanning, monitoring/incident response, backups, infrastructure security testing, clinical validation, and applicable legal/regulatory review.
