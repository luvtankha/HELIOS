# Security architecture and status

This is an engineering description, **not** HIPAA/DPDP/ISO certification, a legal opinion, a completed penetration test, or authorization to process real patient information. Production readiness is **not implemented**. See the detailed [Phase 16 audit](security-audit-phase16.md).

## Implemented prototype controls

- HMAC-SHA256 signed patient and doctor proof types with issue/expiry/kind; patient tokens are session-storage scoped.
- Service-level patient ownership and doctor active-role/assignment checks; URL/body IDs alone grant no access. Admin bypass exists only where coded.
- Zod validation, Prisma parameterization, 1 MB JSON limits, simple query parser, upload bounds and in-process/IP rate-limit groups.
- Exact CORS origin, mutation Origin guard, Helmet/Next headers, no-store clinical responses, request IDs and safe errors.
- Private generated document storage keys, MIME/extension/signature/size checks, duplicate hash, traversal containment, restricted content response and authorized byte cleanup.
- Logs omit bodies/headers/query strings and redact patient-shaped fields; security events hash actor references. Sensitive actions have purpose-built audit where implemented.
- Optional provider output is schema-bound and cannot change roles, authorization, queue authority, doctor verification or audit history.
- Production config rejects built-in secrets, enabled demo mode, default demo code and public storage. Demo reset also checks actual local demo database identity before cleanup.

## Partial or absent controls

Doctor login is a synthetic demo code, not production IdP/MFA. Token revocation/refresh/key rotation, clinic tenancy/RLS, distributed limits, nonce CSP, malware sandbox, immutable audit, complete audit coverage, withdrawal/deletion, retention, encrypted backup/restore, secrets manager, infrastructure TLS/network validation, monitoring and incident response are absent, external or unverified. Prompt injection can contaminate extracted **content** even though it cannot invoke tools; source review remains required.

No SafetyEngine exists. AI cannot diagnose, prescribe or self-verify. Do not send real patient data to optional providers without approved privacy/security/legal processes.

## Release checks

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and a fresh `pnpm audit --prod --audit-level high`. A dependency audit is time-bound, not proof of no vulnerability. Production requires formal threat modelling, external assessment, live cross-user isolation, upload fuzz/malware controls, audit integrity, backup/restore and applicable clinical/legal review.
