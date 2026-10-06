import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DoctorProofService } from "../../src/security/doctor-proof.js";
import { createVerificationService } from "../../src/services/verification-services.js";
import { createDoctorDashboardService } from "../../src/services/doctor-dashboard-services.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
describe.skipIf(!databaseUrl)("native intake clinician review persistence", () => {
  let db: PrismaClient;
  let patientId = "";
  let doctorId = "";
  let visitId = "";
  let sessionId = "";
  let factId = "";
  let token = "";
  const reviewId = () => Buffer.from(`LIVE_INTAKE_FACT:${factId}`).toString("base64url");

  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (!url.pathname.endsWith("_test") && !url.searchParams.get("schema")?.includes("test"))
      throw new Error("An isolated test database or schema is required");
    db = new PrismaClient({ datasourceUrl: databaseUrl });
    const patient = await db.patientProfile.create({ data: {
      patientCode: `NATIVE-REVIEW-TEST-${crypto.randomUUID()}`, fullName: "Synthetic Native Review",
      age: 32, sex: "OTHER", preferredLanguage: "hi-Hinglish",
    } });
    patientId = patient.id;
    const doctor = await db.user.create({ data: { username: `native-review-${crypto.randomUUID()}`, role: "DOCTOR", displayName: "Synthetic Review Doctor" } });
    doctorId = doctor.id;
    await db.doctorPatientAssignment.create({ data: { doctorId, patientId } });
    const visit = await db.visit.create({ data: { patientId, status: "READY_FOR_DOCTOR" } });
    visitId = visit.id;
    const session = await db.patientSession.create({ data: { patientId, visitId, language: "hi-Hinglish" } });
    sessionId = session.id;
    factId = `native-${crypto.randomUUID()}`;
    await db.heliosIntakeFact.create({ data: {
      id: factId, patientSessionId: sessionId, field: "chiefComplaint", value: "fatigue",
      knowledgeState: "KNOWN", confidence: "HIGH", source: "PATIENT_REPORTED",
      evidenceTurnIds: ["synthetic-turn-1"], model: "synthetic-integration", conversationPolicyVersion: "test",
    } });
    token = new DoctorProofService().create(doctorId);
  });

  afterAll(async () => {
    if (!db) return;
    if (patientId) {
      await db.doctorVerification.deleteMany({ where: { patientId } });
      await db.clinicalBrief.deleteMany({ where: { patientId } });
      await db.comparison.deleteMany({ where: { patientId } });
      await db.patientSnapshot.deleteMany({ where: { patientId } });
      await db.timelineEvent.deleteMany({ where: { patientId } });
      await db.patientSession.deleteMany({ where: { patientId } });
      await db.visit.deleteMany({ where: { patientId } });
      await db.patientProfile.deleteMany({ where: { id: patientId } });
    }
    if (doctorId) {
      await db.auditLog.deleteMany({ where: { actorUserId: doctorId } });
      await db.user.deleteMany({ where: { id: doctorId } });
    }
    await db.$disconnect();
  });

  it("finds native facts, preserves turn evidence and clears pending review after verify", async () => {
    const service = createVerificationService(db);
    const dashboard = createDoctorDashboardService(db);
    const queue = await service.queue(patientId, { limit: 100 }, token);
    expect(queue.items).toEqual([expect.objectContaining({ factId, factType: "LIVE_INTAKE_FACT", version: 0 })]);
    expect((await service.detail(reviewId(), patientId, token)).evidence[0]?.sourceId).toBe("synthetic-turn-1");
    const before = await dashboard.workspace(patientId, visitId, token);
    expect(before.aiInsights.pendingVerificationCount).toBe(1);
    const key = crypto.randomUUID();
    await service.act(reviewId(), "VERIFY", { expectedVersion: 0, idempotencyKey: key }, token);
    const replay = await service.act(reviewId(), "VERIFY", { expectedVersion: 0, idempotencyKey: key }, token);
    expect(replay.message).toContain("already saved");
    const fact = await db.heliosIntakeFact.findUniqueOrThrow({ where: { id: factId } });
    expect(fact).toMatchObject({ verificationStatus: "DOCTOR_VERIFIED", verificationVersion: 1, source: "PATIENT_REPORTED" });
    expect(await db.doctorVerification.count({ where: { patientId } })).toBe(1);
    const after = await dashboard.workspace(patientId, visitId, token);
    expect(after.aiInsights.pendingVerificationCount).toBe(0);
    expect(after.liveIntake?.facts[0]?.verificationStatus).toBe("DOCTOR_VERIFIED");
    expect((await service.queue(patientId, { limit: 100 }, token)).items).toHaveLength(0);
  });

  it("corrects, rejects stale writes, refreshes the brief, and rejects without losing history", async () => {
    const service = createVerificationService(db);
    await service.act(reviewId(), "CORRECT", { expectedVersion: 1, idempotencyKey: crypto.randomUUID(),
      reason: "Patient clarifies main symptom", correctedValue: { value: "intermittent fatigue", knowledgeState: "KNOWN" } }, token);
    await expect(service.act(reviewId(), "CORRECT", { expectedVersion: 1, idempotencyKey: crypto.randomUUID(),
      reason: "Stale correction must fail", correctedValue: { value: "stale", knowledgeState: "KNOWN" } }, token))
      .rejects.toMatchObject({ code: "VERIFICATION_STALE_REVIEW" });
    const workspace = await createDoctorDashboardService(db).workspace(patientId, visitId, token);
    expect(workspace.clinicalBrief?.narrative).toContain("intermittent fatigue");
    await service.act(reviewId(), "REJECT", { expectedVersion: 2, idempotencyKey: crypto.randomUUID(), reason: "Patient retracts symptom" }, token);
    const rejected = await createDoctorDashboardService(db).workspace(patientId, visitId, token);
    expect(rejected.clinicalBrief?.narrative).not.toContain("intermittent fatigue");
    expect(rejected.aiInsights.pendingVerificationCount).toBe(0);
    expect(await db.doctorVerification.count({ where: { patientId } })).toBe(3);
  });
});
