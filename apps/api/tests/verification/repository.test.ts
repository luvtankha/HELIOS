import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { VerificationRepository } from "../../src/repositories/verification-repository.js";
import type { ReviewableFact } from "../../src/verification/types.js";

const fact: ReviewableFact = {
  factType: "MEDICATION",
  factId: "fact",
  patientId: "patient",
  patientName: "Synthetic",
  patientCode: "SYNTHETIC",
  visitId: "visit",
  label: "Metformin",
  value: { name: "Metformin", dose: "500 mg" },
  sourceType: "DOCUMENT_EXTRACTED",
  verificationStatus: "DOCUMENT_EXTRACTED",
  version: 2,
  createdAt: new Date(),
  updatedAt: new Date(),
  evidence: [{ kind: "DOCUMENT", sourceId: "evidence", label: "Prescription" }],
};
const mutation = {
  patientId: "patient",
  factType: "MEDICATION" as const,
  factId: "fact",
  action: "CORRECT" as const,
  expectedVersion: 2,
  idempotencyKey: "00000000-0000-4000-8000-000000000001",
  doctorId: "doctor",
  reason: "Current prescription reviewed.",
  correctedValue: { name: "Metformin", dose: "1000 mg" },
  evidenceReferences: fact.evidence,
};

function repository(transaction: Record<string, unknown>) {
  const prisma = {
    $transaction: vi.fn(async (callback: (value: unknown) => unknown) =>
      callback(transaction),
    ),
  } as unknown as PrismaClient;
  return new VerificationRepository(prisma);
}

describe("VerificationRepository transaction integrity", () => {
  it("filters every fact source by exact identity before its history limit", async () => {
    const models = [
      "medication",
      "allergy",
      "observation",
      "documentFact",
      "symptom",
      "clinicalHistory",
      "interviewResponse",
      "ayushRecord",
      "heliosIntakeFact",
    ];
    const delegates = Object.fromEntries(
      models.map((name) => [name, { findMany: vi.fn(async () => []) }]),
    );
    await new VerificationRepository(
      delegates as unknown as PrismaClient,
    ).listFacts("patient", undefined, "older-live");
    for (const model of models)
      expect(delegates[model]!.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: "older-live" }),
        }),
      );
  });

  it("rejects another doctor's idempotency key even inside the transaction", async () => {
    const value = repository({
      doctorVerification: {
        findUnique: vi.fn(async () => ({
          ...mutation,
          verifiedBy: "another-doctor",
        })),
      },
    });
    await expect(value.apply(mutation, fact)).rejects.toMatchObject({
      code: "IDEMPOTENCY_KEY_REUSED",
    });
  });

  it("versions native intake corrections and preserves immutable voice provenance", async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const create = vi.fn(async ({ data }) => ({ ...data, id: "verification" }));
    const value = repository({
      heliosIntakeFact: { updateMany },
      doctorVerification: { findUnique: vi.fn(async () => null), create },
      auditLog: { create: vi.fn() },
      clinicalBrief: { updateMany: vi.fn() },
      comparison: { updateMany: vi.fn() },
    });
    const native = {
      ...fact,
      factType: "LIVE_INTAKE_FACT" as const,
      sourceType: "PATIENT_REPORTED" as const,
      value: { value: "3/10", knowledgeState: "KNOWN" },
    };
    await value.apply(
      {
        ...mutation,
        factType: "LIVE_INTAKE_FACT",
        correctedValue: { value: "4/10", knowledgeState: "KNOWN" },
      },
      native,
    );
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "fact",
          patientSession: { patientId: "patient" },
          verificationVersion: 2,
        },
        data: expect.objectContaining({
          value: "4/10",
          knowledgeState: "KNOWN",
          verificationStatus: "DOCTOR_CORRECTED",
          verificationVersion: { increment: 1 },
        }),
      }),
    );
    expect(updateMany.mock.calls[0]?.[0].data).not.toHaveProperty(
      "evidenceTurnIds",
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          originalValue: native.value,
          factType: "LIVE_INTAKE_FACT",
        }),
      }),
    );
  });
  it("uses optimistic fact versioning and rejects a stale concurrent action", async () => {
    const updateMany = vi.fn(async () => ({ count: 0 }));
    const value = repository({
      doctorVerification: { findUnique: vi.fn(async () => null) },
      medication: { updateMany },
    });
    await expect(value.apply(mutation, fact)).rejects.toMatchObject({
      code: "VERIFICATION_STALE_REVIEW",
      statusCode: 409,
    });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ verificationVersion: 2 }),
      }),
    );
  });

  it("writes fact, immutable history, audit, and dependent invalidation in one transaction", async () => {
    const updateFact = vi.fn(async () => ({ count: 1 }));
    const createVerification = vi.fn(async ({ data }) => ({
      id: "verification",
      ...data,
      verifiedAt: new Date(),
      createdAt: new Date(),
      verifier: { displayName: "Dr Meera" },
    }));
    const createAudit = vi.fn(async () => ({}));
    const staleBriefs = vi.fn(async () => ({ count: 1 }));
    const staleComparisons = vi.fn(async () => ({ count: 1 }));
    const value = repository({
      doctorVerification: {
        findUnique: vi.fn(async () => null),
        create: createVerification,
      },
      medication: { updateMany: updateFact },
      auditLog: { create: createAudit },
      clinicalBrief: { updateMany: staleBriefs },
      comparison: { updateMany: staleComparisons },
    });
    const result = await value.apply(mutation, fact);
    expect(result.replayed).toBe(false);
    expect(createVerification).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          originalValue: fact.value,
          verifiedValue: mutation.correctedValue,
          sourceType: "DOCUMENT_EXTRACTED",
          action: "CORRECT",
        }),
      }),
    );
    expect(createAudit).toHaveBeenCalledOnce();
    expect(staleBriefs).toHaveBeenCalledOnce();
    expect(staleComparisons).toHaveBeenCalledOnce();
  });
});
