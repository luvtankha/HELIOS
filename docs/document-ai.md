# Document AI pipeline

Implemented prototype path: patient-authorized optional upload → MIME/extension/signature and byte validation → private local storage/hash duplicate check → processing job → OCR/page text → heuristic type classification and conservative extraction → original/normalized fact with page evidence/confidence → patient fact review → doctor evidence review/verification. The input remains a source, not a diagnosis.

The pipeline accepts validated PDFs and supported images. `DocumentType` values are `PRESCRIPTION`, `LAB_REPORT`, `DISCHARGE_SUMMARY`, `CONSULTATION_NOTE`, `UNKNOWN`. `DOCUMENT_OCR_PROVIDER=mock` is the deterministic default. `local` uses PDF.js text extraction for digital PDFs and English Tesseract.js image OCR; it explicitly fails for scanned image-only PDFs without extractable text. Handwriting and multilingual document accuracy are not assured. The classifier/extractor are HELIOS heuristics, not a production medical-document model.

`MedicalDocument` stores a private key, hash and processing/identity state; `DocumentPage`, `DocumentExtraction`, `DocumentFact`, and `DocumentEvidence` preserve page locations, OCR text, original and normalized values, review status and evidence. A patient can confirm/edit/reject extracted facts; doctor verification is a **separate** authorized action with history. Processing failure or identity mismatch remains visible for review. Authorized binary responses use no-store, `nosniff`, restricted preview policy, and never reveal the storage path. There is no malware sandbox or guaranteed polyglot/PDF active-content protection.

See [pipeline details](document-ai/pipeline.md), [providers](document-ai/providers.md), [limitations](document-ai/limitations.md), and [API](api.md).
