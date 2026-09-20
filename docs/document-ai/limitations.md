# Document AI limitations

- The deterministic extractor covers a deliberately small set of English labels, medication patterns, dates, and hemoglobin layouts. It is not a general clinical parser.
- Local image OCR currently initializes Tesseract with English. Hindi/Indic document OCR is not validated.
- PDF.js reads embedded text per page but does not render and OCR scanned PDF pages in this MVP.
- Bounding boxes are available for PDF text items and mock blocks; current Tesseract integration preserves line text/confidence but not word coordinates.
- Handwriting is routed through ordinary OCR and must be treated as uncertain; perfect recognition is not promised.
- In-process asynchronous jobs are not durable across server shutdown and must move to a queue for production.
- Local storage is private from web routes but is not encrypted by this code; production requires encrypted managed storage, key management, backup, retention, malware scanning, and operational access controls.
- Patient name matching is conservative normalized exact matching, not identity proofing.
- Patient correction stores a normalized replacement while retaining the original extraction; richer field-specific editing is future work.
- Document deletion is a soft cancellation for audit integrity; retention/erasure policy needs product and legal governance.
- There is no implemented SafetyEngine or doctor dashboard in this checkout. Phase 6 exposes controlled future boundaries but does not create safety alerts or doctor verification.
- No clinical validation, diagnosis capability, perfect OCR, or production readiness is claimed.
