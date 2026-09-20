# Multilingual testing

`apps/api/tests/multilingual` covers registry behavior, locale parity, Hindi/English concept equivalence, negation, severity, duration, ambiguity, code-switching, document frequency, route authorization, fallback, and log privacy. Web tests cover the patient workflow and language-aware components.

Run `pnpm locales:validate`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`. Locale validation fails on missing, extra, duplicate, placeholder-mismatched, or invalid-code resources.
