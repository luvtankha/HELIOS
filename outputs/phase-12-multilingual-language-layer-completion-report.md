# HELIOS Phase 12 — Multilingual Language Layer Completion Report

Date: 2026-09-11  
Scope: Phase 12 only; Phase 13 was not started.

## 1. Multilingual architecture

Implemented a centralized language layer shared by API, web, interview, voice, and document paths. The design separates immutable original content, language-neutral structured facts, and optional display translation. Existing clinical domain ownership remains in its original phase modules.

## 2. Supported languages

English (`en`) and Hindi (`hi`) are selectable. Eleven additional Indian language entries are represented as `COMING_SOON`, not supported. Urdu is registered as future RTL; no RTL workflow support is claimed.

## 3. Actual capabilities per language

English has complete central static resources for the implemented Phase 12 surfaces, localized interview questions/options, deterministic normalization, and speech-language metadata. Hindi has parity-validated static resources, translated interview questions/options, Devanagari and bounded Romanized-Hindi normalization, mixed-language detection, document-frequency extraction, and speech-language metadata. Neither language has measured clinical translation accuracy; arbitrary clinical prose is not automatically translated.

## 4. Language registry

`packages/shared/src/language.ts` is the authority for code, names, direction, status, and capability flags. APIs reject invalid or unavailable active languages. English is the backward-compatible default for rows or test doubles without Phase 12 metadata.

## 5. Speech integration

The Phase 3 recorder/transcriber was extended, not duplicated. Requests use session language, provider and local detected-language metadata is persisted, code-switching is represented as multiple detected languages, and raw/edited/normalized transcript boundaries remain intact. TTS has an interface only and is not advertised as available.

## 6. Translation integration

Implemented provider and batch-provider abstractions backed by approved deterministic resources. Translation responses expose provider, fallback, and source/target metadata. Unknown clinical text returns the original through an explicit fallback instead of fabricating a translation.

## 7. Language detection

Detection distinguishes English, Hindi Devanagari, and bounded Hindi-English mixed input, with confidence and uncertainty. It does not pretend to be a universal language detector. Unsupported and uncertain cases remain reviewable.

## 8. Clinical normalization

`MultilingualClinicalNormalizer` maps tested English, Hindi, and common transliterated expressions to stable concepts, including duration, severity, negation, and code-switched word order. Ambiguous `पेट खराब है`/`Pet kharab hai` input requests clarification.

## 9. Glossary

Added a versioned, reviewable clinical glossary of stable concept IDs, English/Hindi terms, synonyms, and transliterations. It is intentionally bounded and is not represented as a comprehensive medical terminology service.

## 10. Patient language flow

Language choice is stored on the session and patient profile. A mid-flow switch preserves the current workflow step and captured answers. The header exposes the current language and a route to change it. English/Hindi static resources and interview content are kept centrally; untouched clinical evidence remains in its original language.

## 11. Doctor language flow

Clinical Brief and AYUSH doctor views include an English/Hindi display-language control. The signed doctor endpoint persists preference when an authenticated token is available; local preference preserves the UI choice. The patient's original language remains separately visible in evidence data.

## 12. Document integration

Documents persist primary/detected language metadata, while extracted facts retain their original language and source evidence. Hindi `दिन में दो बार` deterministically normalizes to `twice daily`. Display translation is optional and never overwrites OCR or the uploaded file.

## 13. Timeline integration

Timeline construction remains based on canonical facts. Phase 12 adds contracts and localized provenance labels without rebuilding events when display language changes. Original wording and evidence links remain available.

## 14. What Changed integration

Comparison semantics continue to operate on stable snapshots and normalized values, never translated prose. Localized presentation can label change state while underlying `NEW`, `CHANGED`, `UNKNOWN`, and conflict meanings remain unchanged.

## 15. Clinical Brief integration

The doctor display language can localize supported brief UI and known labels. Structured claims, evidence, verification, staleness, and original patient statements are preserved. No generative clinical translation was added.

## 16. Verification integration

Verification continues to show original source beside normalized fact. Translation is display-only. Doctor actions retain Phase 10 authorization, version checks, immutable history, and downstream refresh boundaries.

## 17. AYUSH integration

AYUSH enum labels render in English/Hindi without changing canonical system values. Original names, evidence, source, and verification remain separate. No medicine is invented from a generic statement and no treatment recommendation is produced.

## 18. Safety integration

Localized attention and fallback messages were added. Negation, uncertainty, provenance, and knowledge state live in structured data rather than translated prose. The Phase 5 `SafetyEngine` is absent in this checkout, so Phase 12 created no substitute triage or diagnostic behavior.

## 19. Original-source preservation

Schema additions store original language, detected languages, display language, and display translation separately. Interview, voice, and document serializers expose the distinction. Translation never changes source or upgrades verification status.

## 20. Tests

Automated result: 208 API tests passed, 26 web tests passed, and 5 database integration tests were skipped because they are environment-gated. Multilingual coverage includes registry/parity, detection, code switching, normalization, negation, ambiguity, document extraction, authentication, fallback, and log privacy. Reusable normalization fixtures cover English, Hindi, and Hinglish.

## 21. Accessibility

Patient layout emits `lang` and `dir`, language controls have accessible labels, and existing workflow tests query controls by accessible roles/names. No dedicated screen-reader, axe, or complete manual responsive audit was performed, so WCAG conformance is not claimed.

## 22. Security

Detection/normalization require a signed patient session; translation accepts a signed patient session or active doctor; doctor preference requires signed doctor authorization. Language telemetry contains operation/provider/language/latency/status and excludes patient text. Existing upload, audio, audit, and provenance controls remain in place.

## 23. Performance

Registry lookup, approved-resource translation, detection, and normalization are local and bounded; batch translation avoids per-item HTTP orchestration. The full automated suites completed in under nine seconds per API/web workspace on this machine. No load or percentile latency benchmark was run.

## 24. Typecheck

`pnpm typecheck` passed for shared, API (including tools), and web packages under strict TypeScript settings.

## 25. Build

`pnpm build` passed: shared and API TypeScript builds completed, and Next.js produced all 18 routes successfully. Prisma schema validation and client generation also passed.

## 26. Known limitations

The glossary and transliteration rules are bounded. Speech quality depends on the configured provider. No clinical translation-accuracy evaluation, automated medical translation, production TTS, RTL workflow, or universal Indic language detection exists. Several patient/doctor legacy prose areas remain English-first outside centrally localized Phase 12 strings. Database integration tests require an available PostgreSQL instance. This system does not diagnose or recommend treatment.

## 27. Future language expansion plan

Promote one `COMING_SOON` language only after adding reviewed locale resources, interview translations, glossary/transliteration fixtures, speech-provider evidence, document examples, UI/accessibility checks, and locale-validator parity. Add RTL layout verification before enabling Urdu. Evaluate clinical semantic preservation—including negation, uncertainty, dose, frequency, and temporality—independently for every language before claiming clinical translation quality.

## Verification commands

- `pnpm db:validate` — passed
- `pnpm db:generate` — passed
- `pnpm locales:validate` — passed with 43 English and 43 Hindi keys; no missing, extra, duplicate, invalid-code, or placeholder errors
- `pnpm typecheck` — passed
- `pnpm test` — passed with 234 tests; 5 environment-gated database tests skipped
- `pnpm build` — passed
