# Phase 6 — Medical Document Understanding Completion Report

## 1. Architecture

Phase 6 adds a provider-neutral Document AI vertical slice to the existing Next.js → Express → service → repository → Prisma architecture. The browser uploads through authenticated session context; files remain behind an ownership-checked content endpoint. The API validates, privately stores, processes, persists, and exposes reviewable results without returning raw Prisma records.

The processing path is `upload → validation → preprocessing → page-aware OCR → classification → extraction → schema validation → normalization → identity check → review`. Processing begins asynchronously from a persisted job record. The current `setImmediate` runner is appropriate for the local MVP but is not a durable production queue.

## 2. OCR provider

`OCRProvider` separates OCR from orchestration. The deterministic mock provider supports repeatable tests and offline demos. The local provider uses PDF.js for per-page embedded PDF text and coordinates, Sharp for image rotation/normalization/resizing/sharpening, and Tesseract.js for English image OCR. It preserves pages, blocks, confidence, dimensions, and processed images.

Image-only/scanned PDFs fail explicitly in the current local provider instead of inventing text. The provider does not claim perfect OCR or handwriting support.

## 3. Classification

`DocumentClassifier` conservatively classifies `PRESCRIPTION`, `LAB_REPORT`, `DISCHARGE_SUMMARY`, `CONSULTATION_NOTE`, or `UNKNOWN` using explainable keyword evidence and bounded confidence. Ambiguous input stays unknown and reviewable.

## 4. Extraction provider/model

`DocumentUnderstandingProvider` and `MedicalEntityExtractor` isolate extraction from OCR and workflow code. The implemented rules extract only explicitly documented content: medication name/dose/frequency, hemoglobin result/unit/reference range, dates, admission/discharge, documented assessment/diagnosis text, doctor, facility, chief complaint, patient identity, procedures, examination findings, follow-up, plan, and explicit allergies.

Structured output is validated with Zod and retried once. Unsupported output fails the job rather than being silently accepted. The rules do not infer an absent allergy, diagnose, recommend treatment, or interpret laboratory results.

## 5. Types

Shared DTOs now include document status, type, fact status, identity status, pages, facts, evidence, and bounding boxes. The API’s internal types define OCR providers, classifiers, extractors, understanding providers, normalized facts, and evidence. Important states are explicit: extracted, needs review, confirmed, rejected, and doctor-verified.

## 6. Database changes

Migration `20260909150000_document_ai` expands the status enum and adds `DocumentType`, `DocumentFactStatus`, and `DocumentIdentityStatus`. It extends `MedicalDocument` and `DocumentExtraction`, and creates `DocumentPage`, `DocumentFact`, `DocumentEvidence`, and `DocumentProcessingJob`.

Documents are session-bound and may link to a visit. Pages and evidence preserve source location; facts preserve original and normalized values; jobs preserve attempt and error state. Patient/visit/date/status/hash indexes support ownership queries, duplicate checks, review queues, and timeline projection. A legacy-data bridge creates migration sessions before making the session relation required. Prisma validation and client generation pass; the migration was not applied to a live database in this environment.

## 7. APIs

The implementation provides upload, patient document listing, document detail, private content, process/retry, status, extraction, fact listing, fact confirm/edit/reject, identity override, and soft cancellation/removal endpoints under `/api/v1`.

Upload uses multipart memory handling, a 15 MB default limit, extension/MIME allowlisting, byte-signature validation for PDF/PNG/JPEG/WEBP, HMAC session proof, server-derived patient/visit ownership, SHA-256 duplicate detection, server-generated storage keys, and a document-specific rate limit. Private content uses `Cache-Control: private, no-store`.

## 8. UI components

The patient document page supports “Take photo”, “Upload file”, and “Skip for now”; local preview, retake, and confirmation; animated processing status; polling; failure/retry; identity-mismatch warning and manual override; document details; extracted-fact review; edit/confirm/remove actions; evidence viewing; and completion. The patient review page links into the optional document flow.

The interface uses patient-facing language and does not expose OCR, API, or model terminology.

## 9. Evidence

Each important fact can carry source text, page number, and a bounding box. The evidence viewer shows the original private document, source quotation, page, coordinates, and an image overlay for the source region when page dimensions are available. PDFs remain viewable in the private iframe; the MVP does not yet draw PDF canvas overlays.

## 10. Confidence

OCR page/block confidence, classification confidence, extraction confidence, and overall extraction confidence remain distinct. Low-confidence facts are routed to `NEEDS_REVIEW`; they are not silently promoted. Patient confirmation produces `CONFIRMED`, never doctor verification.

## 11. Provenance

Document-derived facts retain `DOCUMENT_EXTRACTED` provenance, original and normalized values, provider/model/processing version, source evidence, and review status. Corrections preserve the original source value while changing the normalized patient-confirmed value. Timeline events identify document origin and are created idempotently only after identity acceptance.

`safetyEligibleFacts()` is an explicit boundary that returns only confirmed or doctor-verified facts and returns nothing for an unresolved identity mismatch. This checkout contains `RiskSignal` storage but no Phase 5 `SafetyEngine`; Phase 6 therefore does not create risk signals or claim automatic safety integration.

## 12. Synthetic documents

`pnpm document-fixtures:generate` deterministically creates 11 synthetic-only binary fixtures: prescription PDF, lab PNG, two-page discharge PDF, degraded JPEG, rotated prescription JPEG, handwritten-like PNG, ambiguous PNG, missing-date PDF, multiple-medication PDF, multiple-lab PDF, and a byte-identical duplicate. The manifest labels them as synthetic. No real patient data is included.

## 13. Evaluation metrics

The canonical synthetic evaluation expected nine explicit fields across four cases and recovered 9/9 with 9/9 correct: field precision 100% and field recall 100% on that narrow deterministic corpus. These numbers are regression-test metrics only—not clinical accuracy, population performance, handwriting accuracy, or medical-device validation.

The suite also covers all four supported types plus unknown, low-confidence routing, OCR-error preservation, lack of inferred allergy/diagnosis, evidence, duplicate behavior, identity mismatch, and the safety eligibility boundary.

## 14. Test results

`pnpm test` passed on 2026-09-09:

- API: 18 test files passed, 1 database integration file skipped; 86 tests passed and 5 skipped.
- Web: 6 test files and 18 tests passed.
- Combined: 104 tests passed and 5 skipped.
- Actual local PDF path: a generated two-page discharge PDF preserved both pages and embedded text.
- Actual local image path: the synthetic lab PNG produced one page at 0.95 OCR confidence and recovered both “LAB REPORT” and “Hemoglobin”.

The five PostgreSQL integration tests were skipped because `TEST_DATABASE_URL` was not configured. Unit/service/API tests use controlled repositories, but a live migration and persistence run remains required before deployment.

## 15. Typecheck

`pnpm typecheck` passed for shared types, API source/tools, and the web application under strict TypeScript settings. `pnpm lint` also passed with zero warnings after strict async and unsafe-value issues were resolved.

## 16. Build

`pnpm build` passed for the shared package, Express API, and Next.js production application. Next.js compiled, type-checked, generated all 15 static pages, and included `/patient/documents` in the production route output.

## 17. Limitations

- Local OCR is English-first and not clinically validated.
- The local PDF path reads embedded text; scanned PDFs need a rasterization/OCR provider.
- Handwriting, severe blur, skew, shadows, tables, and unusual layouts can fail or require review.
- Rule extraction covers a deliberate bounded vocabulary, not arbitrary medical documents.
- Classification and identity matching are heuristic.
- The local filesystem backend is private-by-application, not production object storage with KMS, malware scanning, retention enforcement, or disaster recovery.
- The in-process runner is not durable across crashes or horizontal replicas.
- Production authentication, authorization policy, audit completeness, consent/retention policy, and threat testing remain necessary.
- Live PostgreSQL migration tests were not run in this environment.
- No diagnosis, treatment recommendation, laboratory interpretation, or automatic safety alert is produced.

## 18. Phase 7 integration

Phase 7 can consume only `safetyEligibleFacts()` output after patient confirmation or doctor verification and after identity acceptance. It should add a real, versioned SafetyEngine behind that boundary; keep document evidence attached to every derived signal; make alerts reviewable and non-diagnostic; use a durable idempotent queue; add production object storage and security controls; and validate migrations and longitudinal behavior against live PostgreSQL.

That work is explicitly not implemented in Phase 6.
