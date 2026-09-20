# Document AI providers

## Interfaces

- `OCRProvider` returns page text, blocks, available coordinates, confidence, page dimensions, and optional derived imagery.
- `DocumentClassifier` returns a supported type, confidence, and reasons.
- `DocumentUnderstandingProvider` returns validated facts, document date, patient name, and a content-only summary.
- `MedicalEntityExtractor` performs conservative field extraction independently of transport/storage.

## Configured providers

`DOCUMENT_OCR_PROVIDER=mock` is the default and recommended SIH demo mode. It produces deterministic synthetic prescription, lab, discharge, or consultation OCR based on the synthetic filename, requires no external service, and includes page/block evidence.

`DOCUMENT_OCR_PROVIDER=local` uses PDF.js for embedded text and coordinates in multi-page PDFs. Images are auto-oriented/preprocessed by Sharp and passed to Tesseract.js. Tesseract language assets may need to be available or downloaded on first use; the current local configuration uses English recognition. A scanned image-only PDF is rejected for review rather than invented from empty text.

Classification and medical extraction are deterministic local rules. No LLM is called in this phase. A future LLM adapter must use the extraction-only/no-diagnosis prompt boundary, preserve uncertainty/evidence, and pass the same Zod contract before its output is stored.

Provider timeouts become `DOCUMENT_PROCESSING_TIMEOUT`. Invalid extraction becomes `EXTRACTION_FAILED`. The original file remains retryable.
