import { ClinicalBriefService } from "../../src/clinical-brief/clinical-brief-service.js";
import type { ClinicalBriefRepository } from "../../src/repositories/clinical-brief-repository.js";
import { DoctorProofService } from "../../src/security/doctor-proof.js";
import { describe, expect, it, vi } from "vitest";

const proof = new DoctorProofService("phase-nine-test-secret-long-enough");
const token = proof.create("doctor");
const source = {
  patient: {
    id: "patient",
    fullName: "Synthetic",
    patientCode: "SYN",
    age: 24,
    sex: "MALE",
    preferredLanguage: "en",
    allergies: [],
    medications: [],
    observations: [],
    documents: [],
  },
  visit: {
    id: "visit",
    patientId: "patient",
    startedAt: new Date("2026-09-09T00:00:00Z"),
    clinicalHistory: null,
    symptoms: [],
    riskSignals: [],
  },
  history: [],
  comparison: null,
};
const row = {
  id: "brief",
  patientId: "patient",
  visitId: "visit",
  comparisonId: null,
  generatedAt: new Date("2026-09-09T00:00:00Z"),
  generatorVersion: "phase9-v1",
  sourceRevision: "old-revision",
  cacheKey: "cache",
  version: 1,
  status: "GENERATED",
  sections: {
    definitions: [],
    narrative:
      "Not enough information has been collected to generate a complete clinical brief.",
  },
  sourceReferences: [],
  createdBy: "doctor",
  previousVersionId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  reviewedAt: null,
  archivedAt: null,
  patient: {
    fullName: "Synthetic",
    patientCode: "SYN",
    age: 24,
    sex: "MALE",
    preferredLanguage: "en",
  },
  visit: { startedAt: new Date("2026-09-09T00:00:00Z") },
  claims: [],
} as const;

function repository(overrides: Record<string, unknown> = {}) {
  return {
    doctor: vi.fn(async () => ({ id: "doctor", role: "DOCTOR" })),
    assigned: vi.fn(async () => true),
    source: vi.fn(async () => source),
    detail: vi.fn(async () => row),
    markStale: vi.fn(async () => ({ ...row, status: "STALE" })),
    audit: vi.fn(async () => undefined),
    ...overrides,
  } as unknown as ClinicalBriefRepository;
}

describe("ClinicalBriefService security and freshness", () => {
  it("requires a valid signed doctor identity", async () => {
    const service = new ClinicalBriefService(repository(), proof);
    await expect(service.detail("brief", "tampered")).rejects.toMatchObject({
      code: "DOCTOR_TOKEN_INVALID",
    });
  });
  it("rejects a visit that does not resolve under the requested patient", async () => {
    const repo = repository({ source: vi.fn(async () => null) });
    const service = new ClinicalBriefService(repo, proof);
    await expect(
      service.generate("other-patient", "visit", token),
    ).rejects.toMatchObject({ code: "BRIEF_VISIT_NOT_FOUND" });
  });
  it("marks a brief stale when its structured source revision changes", async () => {
    const repo = repository();
    const service = new ClinicalBriefService(repo, proof);
    const result = await service.detail("brief", token);
    expect(result.status).toBe("STALE");
    expect(repo.markStale).toHaveBeenCalledWith("brief");
  });
});
