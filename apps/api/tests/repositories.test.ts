import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { ClinicalHistoryRepository } from "../src/repositories/clinical-history-repository.js";
import { ConsentRepository } from "../src/repositories/consent-repository.js";
import { ObservationRepository } from "../src/repositories/observation-repository.js";
import { PatientRepository } from "../src/repositories/patient-repository.js";
import { SessionRepository } from "../src/repositories/session-repository.js";
import { TimelineRepository } from "../src/repositories/timeline-repository.js";
import { VisitRepository } from "../src/repositories/visit-repository.js";
function prismaWith(delegate: Record<string, unknown>) {
  return delegate as unknown as PrismaClient;
}
describe("Prisma repositories", () => {
  it("creates a patient with an explicit DTO boundary", async () => {
    const create = vi.fn(async ({ data }) => data);
    const repository = new PatientRepository(
      prismaWith({ patientProfile: { create } }),
    );
    await repository.create({
      patientCode: "DEMO-1",
      fullName: "Synthetic Patient",
      age: 24,
      sex: "MALE",
      preferredLanguage: "en",
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ patientCode: "DEMO-1" }),
    });
  });
  it("creates a persistent session", async () => {
    const create = vi.fn(async ({ data }) => ({ id: "session", ...data }));
    const repository = new SessionRepository(
      prismaWith({ patientSession: { create } }),
    );
    await repository.create("hi");
    expect(create).toHaveBeenCalledWith({
      data: { language: "hi", currentStep: "LANGUAGE" },
    });
  });
  it("creates a visit", async () => {
    const create = vi.fn(async ({ data }) => data);
    const repository = new VisitRepository(prismaWith({ visit: { create } }));
    await repository.create("patient-1");
    expect(create).toHaveBeenCalledWith({
      data: {
        patientId: "patient-1",
        visitType: "PRE_CONSULTATION",
        status: "IN_PROGRESS",
      },
    });
  });
  it("upserts clinical history", async () => {
    const upsert = vi.fn(async (input) => input);
    const repository = new ClinicalHistoryRepository(
      prismaWith({ clinicalHistory: { upsert } }),
    );
    await repository.upsert("visit-1", {
      chiefComplaint: "Synthetic complaint",
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { visitId: "visit-1" } }),
    );
  });
  it("upserts consent by version", async () => {
    const upsert = vi.fn(async () => ({ id: "consent" }));
    const repository = new ConsentRepository(
      prismaWith({ consentRecord: { upsert } }),
    );
    await repository.create({
      sessionId: "session-1",
      consentType: "PRE_CONSULTATION",
      accepted: true,
      version: "1.0",
    });
    expect(upsert).toHaveBeenCalledOnce();
  });
  it("creates a timeline event", async () => {
    const create = vi.fn(async ({ data }) => data);
    const repository = new TimelineRepository(
      prismaWith({ timelineEvent: { create } }),
    );
    await repository.create({
      patientId: "patient-1",
      eventType: "DEMO",
      title: "Synthetic",
      eventDate: new Date(),
      source: "SYSTEM",
    });
    expect(create).toHaveBeenCalledOnce();
  });
  it("creates and retrieves typed observations without losing provenance", async () => {
    const create = vi.fn(async ({ data }) => data);
    const findMany = vi.fn(async () => []);
    const repository = new ObservationRepository(
      prismaWith({ observation: { create, findMany } }),
    );
    await repository.create({
      patientId: "patient-1",
      visitId: "visit-1",
      conceptKey: "haemoglobin",
      display: "Haemoglobin",
      value: { quantity: 12.5 },
      unit: "g/dL",
      state: "YES",
      source: "DOCUMENT_EXTRACTED",
    });
    await repository.listForPatient("patient-1");
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conceptKey: "haemoglobin",
        source: "DOCUMENT_EXTRACTED",
      }),
    });
    expect(findMany).toHaveBeenCalledWith({
      where: { patientId: "patient-1" },
      orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
    });
  });
});
