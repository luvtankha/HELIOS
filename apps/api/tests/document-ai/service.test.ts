import type { DocumentRecord } from "../../src/repositories/document-repository.js";
import type { DocumentRepository } from "../../src/repositories/document-repository.js";
import {
  HeuristicDocumentClassifier,
  RuleBasedDocumentUnderstandingProvider,
} from "../../src/document-ai/providers.js";
import type { DocumentStorage } from "../../src/document-ai/storage.js";
import type { OCRProvider } from "../../src/document-ai/types.js";
import { SessionProofService } from "../../src/security/session-proof.js";
import {
  DocumentService,
  identityMatch,
} from "../../src/services/document-service.js";
import { describe, expect, it, vi } from "vitest";

const sessionId = "session-12345678";
const patientId = "patient-12345678";
const secret = "document-test-secret-long";
const proof = new SessionProofService(secret);
const token = proof.create(sessionId);

function record(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: "document-12345678",
    patientId,
    visitId: "visit-12345678",
    sessionId,
    fileName: "prescription.png",
    mimeType: "image/png",
    storagePath: "private/original.png",
    fileSize: 8,
    fileHash: "hash",
    documentType: "UNKNOWN",
    pageCount: 1,
    identityStatus: "PENDING",
    documentDate: null,
    summary: null,
    uploadedAt: new Date(0),
    uploadedBy: sessionId,
    processingStatus: "UPLOADED",
    deletedAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    extraction: null,
    pages: [],
    facts: [],
    jobs: [],
    ...overrides,
  };
}

describe("document identity handling", () => {
  it("distinguishes match, mismatch, missing identity and pending comparison", () => {
    expect(identityMatch("Aarav Sharma", "Aarav Sharma")).toBe("MATCHED");
    expect(identityMatch("Priya Patel", "Aarav Sharma")).toBe(
      "IDENTITY_MISMATCH",
    );
    expect(identityMatch(undefined, "Aarav Sharma")).toBe("NOT_PRESENT");
    expect(identityMatch("Aarav Sharma", undefined)).toBe("PENDING");
  });
});

describe("DocumentService", () => {
  it("loads only the lightweight processing status while a document is running", async () => {
    const repository = {
      findStatusOwned: vi.fn(async () => ({
        id: "document-12345678",
        processingStatus: "OCR_PROCESSING" as const,
        jobs: [{ progress: 40, errorCode: null }],
      })),
    } as unknown as DocumentRepository;
    const service = createService(repository, {
      store: vi.fn(),
      read: vi.fn(),
    });

    await expect(service.status("document-12345678", token)).resolves.toEqual({
      id: "document-12345678",
      status: "OCR_PROCESSING",
      progress: 40,
    });
    expect(repository.findStatusOwned).toHaveBeenCalledWith(
      "document-12345678",
      sessionId,
    );
  });

  it("supersedes AYUSH projections when their source document is removed", async () => {
    const repository = {
      findOwned: vi.fn(async () => record()),
      cancel: vi.fn(async () => undefined),
    } as unknown as DocumentRepository;
    const timeline = {
      projectDocument: vi.fn(async () => undefined),
      removeDocument: vi.fn(async () => undefined),
    };
    const ayush = {
      projectDocument: vi.fn(async () => undefined),
      removeDocument: vi.fn(async () => undefined),
    };
    const service = new DocumentService(
      repository,
      { store: vi.fn(), read: vi.fn(), remove: vi.fn() },
      { name: "test", recognize: vi.fn(async () => []) },
      new HeuristicDocumentClassifier(),
      new RuleBasedDocumentUnderstandingProvider(),
      proof,
      timeline,
      ayush,
    );

    await service.remove("document-12345678", token);

    expect(ayush.removeDocument).toHaveBeenCalledWith("document-12345678");
    expect(timeline.removeDocument).toHaveBeenCalledWith("document-12345678");
  });

  it("blocks a duplicate hash without writing another private file", async () => {
    const storage = {
      store: vi.fn(),
      read: vi.fn(),
      remove: vi.fn(),
    } satisfies DocumentStorage;
    const repository = {
      sessionContext: vi.fn(async () => ({
        patient: { id: patientId },
        visit: null,
      })),
      findDuplicate: vi.fn(async () => record()),
    } as unknown as DocumentRepository;
    const service = createService(repository, storage);
    await expect(
      service.upload(
        {
          sessionId,
          patientId,
          file: {
            buffer: Buffer.from([
              0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
            ]),
            mimetype: "image/png",
            originalname: "duplicate.png",
            size: 8,
          } as Express.Multer.File,
        },
        token,
      ),
    ).rejects.toMatchObject({ code: "DOCUMENT_DUPLICATE" });
    expect(storage.store).not.toHaveBeenCalled();
  });

  it("quarantines a patient-name mismatch and creates no safety-eligible fact", async () => {
    let current = record();
    let processedIdentity = "";
    const repository = {
      findOwned: vi.fn(async () => current),
      claimProcessing: vi.fn(async () => ({ id: "job-12345678" })),
      setStatus: vi.fn(async () => true),
      sessionContext: vi.fn(async () => ({
        patient: { id: patientId, fullName: "Aarav Sharma" },
        visit: { id: "visit-12345678" },
      })),
      saveProcessed: vi.fn(async (input) => {
        processedIdentity = input.identityStatus;
        current = record({
          identityStatus: input.identityStatus,
          processingStatus: "REVIEW_REQUIRED",
        });
        return current;
      }),
      fail: vi.fn(async () => undefined),
    } as unknown as DocumentRepository;
    const ocr: OCRProvider = {
      name: "test-ocr",
      recognize: vi.fn(async () => [
        {
          pageNumber: 1,
          text: "PRESCRIPTION\nPatient: Priya Patel\nMetformin 500 mg",
          blocks: [],
          confidence: 0.95,
        },
      ]),
    };
    const storage = {
      store: vi.fn(),
      read: vi.fn(async () => Buffer.from("private")),
      remove: vi.fn(),
    } satisfies DocumentStorage;
    const service = createService(repository, storage, ocr);
    const result = await service.processNow(current.id, token);
    expect(processedIdentity).toBe("IDENTITY_MISMATCH");
    expect(result.identityStatus).toBe("IDENTITY_MISMATCH");
    await expect(
      service.safetyEligibleFacts(current.id, token),
    ).resolves.toEqual([]);
  });

  it("rejects a duplicate processing start after the repository claim loses", async () => {
    const current = record();
    const repository = {
      findOwned: vi.fn(async () => current),
      claimProcessing: vi
        .fn()
        .mockResolvedValueOnce({ id: "job-12345678" })
        .mockResolvedValueOnce(null),
      findStatusOwned: vi.fn(async () => ({
        id: current.id,
        processingStatus: "PREPROCESSING" as const,
        jobs: [],
      })),
      setStatus: vi.fn(async () => false),
      fail: vi.fn(async () => false),
    } as unknown as DocumentRepository;
    const service = createService(repository, {
      store: vi.fn(),
      read: vi.fn(),
      remove: vi.fn(),
    });

    await service.processNow(current.id, token);
    await expect(service.processNow(current.id, token)).rejects.toMatchObject({
      code: "DOCUMENT_ALREADY_PROCESSING",
    });
    expect(repository.claimProcessing).toHaveBeenCalledTimes(2);
  });

  it("does not project or retain staged images when cancellation wins before the terminal save", async () => {
    const current = record();
    const repository = {
      findOwned: vi.fn(async () => current),
      claimProcessing: vi.fn(async () => ({ id: "job-12345678" })),
      setStatus: vi.fn(async () => true),
      sessionContext: vi.fn(async () => ({
        patient: { id: patientId, fullName: "Aarav Sharma" },
        visit: { id: "visit-12345678" },
      })),
      saveProcessed: vi.fn(async () => null),
      fail: vi.fn(async () => false),
    } as unknown as DocumentRepository;
    const storage = {
      store: vi.fn(async () => undefined),
      read: vi.fn(async () => Buffer.from("private")),
      remove: vi.fn(async () => undefined),
    } satisfies DocumentStorage;
    const ocr: OCRProvider = {
      name: "test-ocr",
      recognize: vi.fn(async () => [
        {
          pageNumber: 1,
          text: "PRESCRIPTION\nPatient: Aarav Sharma",
          blocks: [],
          confidence: 0.95,
          processedImage: Buffer.from("processed"),
        },
      ]),
    };
    const timeline = {
      projectDocument: vi.fn(async () => undefined),
      removeDocument: vi.fn(async () => undefined),
    };
    const ayush = {
      projectDocument: vi.fn(async () => undefined),
      removeDocument: vi.fn(async () => undefined),
    };
    const service = new DocumentService(
      repository,
      storage,
      ocr,
      new HeuristicDocumentClassifier(),
      new RuleBasedDocumentUnderstandingProvider(),
      proof,
      timeline,
      ayush,
    );

    await service.processNow(current.id, token);

    expect(repository.saveProcessed).toHaveBeenCalledTimes(1);
    expect(storage.remove).toHaveBeenCalledWith(
      `${patientId}/${current.id}/processed/job-12345678-page-1.png`,
    );
    expect(ayush.projectDocument).not.toHaveBeenCalled();
    expect(timeline.projectDocument).not.toHaveBeenCalled();
    expect(repository.fail).not.toHaveBeenCalled();
  });

  it("exposes only patient-confirmed or doctor-verified facts to the safety boundary", async () => {
    const current = record({
      identityStatus: "MATCHED",
      facts: [
        {
          id: "fact-1",
          documentId: "document-12345678",
          patientId,
          visitId: null,
          factType: "medication",
          originalValue: "Metformin 500 mg",
          normalizedValue: { name: "Metformin", dose: 500, unit: "mg" },
          source: "DOCUMENT_EXTRACTED",
          confidence: 0.95,
          status: "CONFIRMED",
          createdAt: new Date(0),
          updatedAt: new Date(0),
          evidence: [],
        },
        {
          id: "fact-2",
          documentId: "document-12345678",
          patientId,
          visitId: null,
          factType: "allergy",
          originalValue: "uncertain",
          normalizedValue: null,
          source: "DOCUMENT_EXTRACTED",
          confidence: 0.4,
          status: "NEEDS_REVIEW",
          createdAt: new Date(0),
          updatedAt: new Date(0),
          evidence: [],
        },
      ],
    });
    const repository = {
      findOwned: vi.fn(async () => current),
    } as unknown as DocumentRepository;
    const service = createService(repository, {
      store: vi.fn(),
      read: vi.fn(),
    });
    const facts = await service.safetyEligibleFacts(current.id, token);
    expect(facts).toEqual([
      expect.objectContaining({ id: "fact-1", source: "DOCUMENT_EXTRACTED" }),
    ]);
  });
});

function createService(
  repository: DocumentRepository,
  storage: DocumentStorage,
  ocr: OCRProvider = { name: "test", recognize: vi.fn(async () => []) },
) {
  return new DocumentService(
    repository,
    storage,
    ocr,
    new HeuristicDocumentClassifier(),
    new RuleBasedDocumentUnderstandingProvider(),
    proof,
  );
}
