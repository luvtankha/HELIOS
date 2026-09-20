# Contributing to HELIOS

Create a focused branch (the project convention for Codex work is `codex/<topic>`), keep changes scoped, and do not overwrite unrelated work. Follow the repository's TypeScript, ESLint and Prettier configuration and the route→controller→service→repository boundaries described in [development](docs/development.md).

Before a PR, run typecheck/lint, relevant focused tests, the root test suite and build when feasible. Document commands/results and any skips. Schema changes require a forward migration and data-isolation tests. Security-sensitive routes require authentication, role/resource authorization, validation, safe errors, throttling/audit decisions and negative tests.

Never commit real patient data, identifiers, audio, documents, database dumps, provider keys, `.env`, tokens, passwords or demo access codes. Fixtures must be explicitly fictional/synthetic. Do not weaken demo/test database guards. AI/OCR/speech output must remain untrusted, source-labelled and subject to deterministic validation/human review; never add diagnosis or treatment claims without an approved product/clinical process.

Update current documentation and limitations with behavior changes. Do not claim compliance, certification, clinical accuracy, production readiness, real-time push, or provider capability without evidence.
