# Document processing pipeline

1. Validate session ownership, patient/visit binding, extension, declared MIME, byte signature, size, and request rate.
2. Hash the bytes with SHA-256 and reject an active duplicate for the patient.
3. Store the immutable original using a server-generated private key and safe filename metadata.
4. Create a processing job and advance one `DocumentStatus` state: `UPLOADED`, `VALIDATING`, `PREPROCESSING`, `OCR_PROCESSING`, `LAYOUT_PROCESSING`, `EXTRACTING`, `NORMALIZING`, `REVIEW_REQUIRED`, `VERIFIED`, `FAILED`, or `CANCELLED`.
5. For images, auto-orient, bound the resolution, normalize contrast, sharpen, and retain the derived PNG separately. For text PDFs, process each page independently and retain page coordinates from the PDF text layer.
6. Produce page text and blocks through `OCRProvider`.
7. Classify with deterministic keyword evidence. Ties/insufficient evidence return `UNKNOWN`.
8. Extract only explicitly present fields and validate the structured result with Zod. Invalid provider output gets one bounded retry, then `EXTRACTION_FAILED`.
9. Preserve original and normalized values, confidence, page, source text, and available coordinates.
10. Compare an explicitly extracted patient name with the active patient. A mismatch quarantines facts and prevents timeline/safety availability until manual review.
11. Create a historical timeline candidate dated from the document when available. Document medications remain `HISTORICAL`; they are not promoted to current medication.
12. Let the patient confirm, correct, or reject facts. The extraction remains auditable.

Failures retain the original and job error code, making retry possible without re-upload. Logs contain IDs, operation, status, duration, and error code—not OCR text or medical entities.
