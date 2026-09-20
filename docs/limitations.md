# Known limitations

- **Clinical:** no SafetyEngine, diagnosis, prescription, treatment recommendation, clinically validated emergency screening, interaction inference, or medical-device validation. Optional specialization routing is a clinician-review-required intake aid; its conservative pattern match must never be interpreted as emergency clearance, diagnosis, or a booking guarantee.
- **Identity/security:** signed session proofs and object checks exist, but doctor login is demo-code based; no production IdP/MFA, clinic tenancy/RLS, revocation/refresh rotation, distributed rate limits, immutable audit store, formal external penetration certification, or compliance claim.
- **Privacy/operations:** no complete withdrawal/deletion workflow, retention schedule, deployed encrypted backup/restore exercise, incident response integration, or verified production infrastructure.
- **AI:** this local installation uses real local speech and local OCR; NLU remains rules-based. Unconfigured environment defaults can still select mocks, so verify the active profile. Neither the local models nor optional OpenAI adapters are clinically certified. Prompt/content contamination remains possible.
- **Voice/language:** English/Hindi UI and bounded Hinglish normalization only; no production TTS, broad dialect/accent/noise evaluation, or other fully supported languages.
- **Documents:** heuristic classification/extraction; local Tesseract image OCR is English-oriented; scanned image-only PDFs, handwriting, malware sandboxing and broad document formats are unsupported/unverified.
- **Architecture/scaling:** one API/web deployment, local storage, in-memory rate limits/reset lock and polling. No WebSocket/SSE, distributed cache, object-store deployment, multitenancy or interoperability implementation.
- **Testing/demo:** partial browser coverage; no complete all-browser voice/document/What Changed/Safety flow, no real provider certification, and no end-to-end production environment validation.
- **Demo:** destructive reset is local synthetic-only and not cross-process atomic. The golden baseline is a demonstration, not evidence of clinical effectiveness.

See [testing](testing.md), [security](security.md), and [safety](safety.md).
