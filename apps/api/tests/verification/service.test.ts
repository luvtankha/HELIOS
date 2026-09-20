import { describe, expect, it, vi } from "vitest";
import type { VerificationRepository } from "../../src/repositories/verification-repository.js";
import { DoctorProofService } from "../../src/security/doctor-proof.js";
import type { TimelineRebuildService } from "../../src/timeline/timeline-rebuild-service.js";
import type { ReviewableFact } from "../../src/verification/types.js";
import { VerificationService } from "../../src/verification/verification-service.js";

const proof = new DoctorProofService("phase-ten-test-secret-long-enough");
const token = proof.create("doctor");
const reviewId = Buffer.from("MEDICATION:current", "utf8").toString(
  "base64url",
);

function medication(overrides: Partial<ReviewableFact> = {}): ReviewableFact {
  return {
    factType: "MEDICATION",
    factId: "current",
    patientId: "patient",
    patientName: "Aarav Sharma",
    patientCode: "SYNTHETIC",
    visitId: "current-visit",
    visitDate: new Date("2026-09-09T00:00:00Z"),
    label: "Metformin",
    value: { name: "Metformin", dose: "1000 mg", frequency: "twice daily" },
    sourceType: "PATIENT_REPORTED",
    verificationStatus: "PATIENT_REPORTED",
    version: 0,
    createdAt: new Date("2026-09-09T00:00:00Z"),
    updatedAt: new Date("2026-09-09T00:00:00Z"),
    normalizedKey: "metformin",
    evidence: [
      {
        kind: "INTERVIEW",
        sourceId: "response",
        label: "Current patient interview",
        sourceText: "I take 1000 mg",
        language: "en",
      },
    ],
    ...overrides,
  };
}

function harness(overrides: Record<string, unknown> = {}) {
  const facts = [
    medication(),
    medication({
      factId: "previous",
      visitId: "previous-visit",
      value: { name: "Metformin", dose: "500 mg", frequency: "twice daily" },
      sourceType: "DOCUMENT_EXTRACTED",
      verificationStatus: "DOCTOR_VERIFIED",
      createdAt: new Date("2026-05-10T00:00:00Z"),
    }),
  ];
  const created = {
    id: "verification",
    patientId: "patient",
    visitId: "current-visit",
    factType: "MEDICATION" as const,
    factId: "current",
    action: "CONFIRM_CURRENT" as const,
    previousStatus: "PATIENT_REPORTED" as const,
    newStatus: "DOCTOR_VERIFIED" as const,
    status: "DOCTOR_VERIFIED" as const,
    originalValue: facts[0]!.value,
    verifiedValue: facts[0]!.value,
    sourceType: "PATIENT_REPORTED" as const,
    evidenceReferences: [],
    reason: "Patient confirms current prescription.",
    comment: null,
    verifiedBy: "doctor",
    verifiedAt: new Date("2026-09-10T00:00:00Z"),
    factVersion: 1,
    idempotencyKey: "00000000-0000-4000-8000-000000000001",
    createdAt: new Date("2026-09-10T00:00:00Z"),
    verifier: { displayName: "Dr Meera Singh" },
  };
  const repository = {
    doctor: vi.fn(async () => ({
      id: "doctor",
      displayName: "Dr Meera Singh",
      role: "DOCTOR",
    })),
    assigned: vi.fn(async () => true),
    assignedPatientIds: vi.fn(async () => ["patient"]),
    listFacts: vi.fn(async (patientId?: string) =>
      patientId ? facts.filter((fact) => fact.patientId === patientId) : facts,
    ),
    riskVisitIds: vi.fn(async () => []),
    history: vi.fn(async () => []),
    metrics: vi.fn(async () => ({
      verifiedToday: 0,
      correctedToday: 0,
      rejectedToday: 0,
    })),
    idempotent: vi.fn(async () => null),
    apply: vi.fn(async (input: { action: string }) => {
      facts[0]!.verificationStatus =
        input.action === "MARK_UNCERTAIN"
          ? "NEEDS_REVIEW"
          : input.action === "KEEP_PREVIOUS"
            ? "DOCTOR_REJECTED"
            : input.action === "CORRECT"
              ? "DOCTOR_CORRECTED"
              : "DOCTOR_VERIFIED";
      facts[0]!.version += 1;
      return {
        row: {
          ...created,
          action: input.action,
          newStatus: facts[0]!.verificationStatus,
          status: facts[0]!.verificationStatus,
        },
        replayed: false,
      };
    }),
    ...overrides,
  };
  const timeline = { rebuild: vi.fn(async () => ({ projectedEventCount: 1 })) };
  const storage = { store: vi.fn(), read: vi.fn() };
  return {
    repository,
    timeline,
    service: new VerificationService(
      repository as unknown as VerificationRepository,
      timeline as unknown as TimelineRebuildService,
      storage,
      proof,
    ),
  };
}

describe("VerificationService", () => {
  it("requires a signed doctor and never accepts browser doctor identity", async () => {
    const { service } = harness();
    await expect(
      service.queue(undefined, { limit: 100 }, "tampered"),
    ).rejects.toMatchObject({ code: "DOCTOR_TOKEN_INVALID" });
  });

  it("denies an unassigned doctor before returning or changing clinical facts", async () => {
    const { service, repository } = harness({
      assigned: vi.fn(async () => false),
      assignedPatientIds: vi.fn(async () => []),
    });
    await expect(
      service.queue("patient", { limit: 100 }, token),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      service.detail(reviewId, "patient", token),
    ).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(
      service.act(
        reviewId,
        "CONFIRM_CURRENT",
        {
          expectedVersion: 0,
          idempotencyKey: "00000000-0000-4000-8000-000000000010",
          reason: "This request must be rejected.",
        },
        token,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(repository.apply).not.toHaveBeenCalled();
  });

  it("detects the Aarav medication conflict without choosing a value", async () => {
    const { service } = harness();
    const queue = await service.queue("patient", { limit: 100 }, token);
    expect(queue.items[0]).toMatchObject({
      conflict: true,
      label: "Metformin",
      verificationStatus: "PATIENT_REPORTED",
    });
    const review = await service.detail(reviewId, "patient", token);
    expect(review.previous?.value).toMatchObject({ dose: "500 mg" });
    expect(review.value).toMatchObject({ dose: "1000 mg" });
  });

  it("confirms current with explicit reason and preserves patient source", async () => {
    const { service, repository, timeline } = harness();
    const result = await service.act(
      reviewId,
      "CONFIRM_CURRENT",
      {
        expectedVersion: 0,
        idempotencyKey: "00000000-0000-4000-8000-000000000001",
        reason: "Patient confirms current prescription.",
      },
      token,
    );
    expect(repository.apply).toHaveBeenCalledWith(
      expect.objectContaining({
        doctorId: "doctor",
        action: "CONFIRM_CURRENT",
        expectedVersion: 0,
      }),
      expect.objectContaining({ sourceType: "PATIENT_REPORTED" }),
    );
    expect(result.verification.newStatus).toBe("DOCTOR_VERIFIED");
    expect(timeline.rebuild).toHaveBeenCalledWith("patient");
  });

  it("requires a reason for corrections and conflict decisions", async () => {
    const { service } = harness();
    await expect(
      service.act(
        reviewId,
        "CONFIRM_CURRENT",
        {
          expectedVersion: 0,
          idempotencyKey: "00000000-0000-4000-8000-000000000002",
        },
        token,
      ),
    ).rejects.toMatchObject({ code: "VERIFICATION_REASON_REQUIRED" });
    await expect(
      service.act(
        reviewId,
        "CORRECT",
        {
          expectedVersion: 0,
          idempotencyKey: "00000000-0000-4000-8000-000000000003",
          correctedValue: { dose: "750 mg" },
        },
        token,
      ),
    ).rejects.toMatchObject({ code: "VERIFICATION_REASON_REQUIRED" });
  });

  it("keeps unknown information in needs-review state", async () => {
    const { service } = harness();
    const result = await service.act(
      reviewId,
      "MARK_UNCERTAIN",
      {
        expectedVersion: 0,
        idempotencyKey: "00000000-0000-4000-8000-000000000004",
      },
      token,
    );
    expect(result.verification.newStatus).toBe("NEEDS_REVIEW");
  });

  it("records correction and rejection as distinct immutable outcomes", async () => {
    const correction = harness();
    const corrected = await correction.service.act(
      reviewId,
      "CORRECT",
      {
        expectedVersion: 0,
        idempotencyKey: "00000000-0000-4000-8000-000000000007",
        reason: "Current prescription reviewed.",
        correctedValue: { name: "Metformin", dose: "750 mg" },
      },
      token,
    );
    expect(corrected.verification.newStatus).toBe("DOCTOR_CORRECTED");

    const rejection = harness();
    const rejected = await rejection.service.act(
      reviewId,
      "KEEP_PREVIOUS",
      {
        expectedVersion: 0,
        idempotencyKey: "00000000-0000-4000-8000-000000000008",
        reason: "Previous prescription remains current.",
      },
      token,
    );
    expect(rejected.verification.newStatus).toBe("DOCTOR_REJECTED");
  });

  it("never permits blind verification when evidence is missing", async () => {
    const { service } = harness({
      listFacts: vi.fn(async () => [medication({ evidence: [] })]),
    });
    await expect(
      service.act(
        reviewId,
        "VERIFY",
        {
          expectedVersion: 0,
          idempotencyKey: "00000000-0000-4000-8000-000000000009",
        },
        token,
      ),
    ).rejects.toMatchObject({ code: "VERIFICATION_EVIDENCE_UNAVAILABLE" });
  });

  it("prevents generic verify on a conflict", async () => {
    const { service } = harness();
    await expect(
      service.act(
        reviewId,
        "VERIFY",
        {
          expectedVersion: 0,
          idempotencyKey: "00000000-0000-4000-8000-000000000005",
        },
        token,
      ),
    ).rejects.toMatchObject({
      code: "VERIFICATION_CONFLICT_DECISION_REQUIRED",
    });
  });

  it("blocks cross-patient detail access", async () => {
    const { service } = harness();
    await expect(
      service.detail(reviewId, "another-patient", token),
    ).rejects.toMatchObject({ code: "VERIFICATION_NOT_FOUND" });
  });

  it("returns a retry-safe prior action and rejects key reuse for another action", async () => {
    const first = harness();
    const prior = (first.repository.apply as ReturnType<typeof vi.fn>)
      .getMockImplementation;
    void prior;
    const base = harness();
    const row = (await base.repository.apply({ action: "CONFIRM_CURRENT" }))
      .row;
    const replay = harness({ idempotent: vi.fn(async () => row) });
    const result = await replay.service.act(
      reviewId,
      "CONFIRM_CURRENT",
      {
        expectedVersion: 0,
        idempotencyKey: row.idempotencyKey,
        reason: "Patient confirms current prescription.",
      },
      token,
    );
    expect(result.message).toMatch(/already saved/i);
    await expect(
      replay.service.act(
        reviewId,
        "REJECT",
        {
          expectedVersion: 0,
          idempotencyKey: row.idempotencyKey,
          reason: "Incorrect source",
        },
        token,
      ),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED" });
  });

  it("reports dependent refresh failure without rolling back verification", async () => {
    const timeline = {
      rebuild: vi.fn(async () => {
        throw new Error("unavailable");
      }),
    };
    const base = harness();
    const service = new VerificationService(
      base.repository as unknown as VerificationRepository,
      timeline as unknown as TimelineRebuildService,
      { store: vi.fn(), read: vi.fn() },
      proof,
    );
    const result = await service.act(
      reviewId,
      "CONFIRM_CURRENT",
      {
        expectedVersion: 0,
        idempotencyKey: "00000000-0000-4000-8000-000000000006",
        reason: "Patient confirms current prescription.",
      },
      token,
    );
    expect(result.dependentRefreshPending).toBe(true);
    expect(result.message).toMatch(/related views may need refresh/i);
  });
});
