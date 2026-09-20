import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { QueueRepository } from "../../src/queue/queue-repository.js";
import { QueueService } from "../../src/queue/queue-service.js";
import { DoctorProofService } from "../../src/security/doctor-proof.js";
import { SessionProofService } from "../../src/security/session-proof.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integration = describe.skipIf(!testDatabaseUrl);
const secret = "phase-fourteen-database-integration-secret";
let prisma: PrismaClient;
let service: QueueService;
let doctorId = "";
let doctorToken = "";
const patientIds: string[] = [];
const sessionIds: string[] = [];
const visitIds: string[] = [];

integration("PostgreSQL queue transaction integration", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    prisma = new PrismaClient({ datasourceUrl: testDatabaseUrl });
    const suffix = crypto.randomUUID();
    const doctor = await prisma.user.create({
      data: {
        username: `queue-doctor-${suffix}`,
        displayName: "Synthetic Queue Doctor",
        role: "DOCTOR",
      },
    });
    doctorId = doctor.id;
    doctorToken = new DoctorProofService(secret).create(doctorId);
    service = new QueueService(
      new QueueRepository(prisma),
      new SessionProofService(secret),
      new DoctorProofService(secret),
    );
    for (const index of [1, 2]) {
      const patient = await prisma.patientProfile.create({
        data: {
          patientCode: `QUEUE-${suffix}-${index}`,
          fullName: `Synthetic Queue Patient ${index}`,
          age: 30 + index,
          sex: "OTHER",
        },
      });
      const visit = await prisma.visit.create({
        data: { patientId: patient.id },
      });
      const session = await prisma.patientSession.create({
        data: {
          patientId: patient.id,
          visitId: visit.id,
          currentStep: "REVIEW",
        },
      });
      await prisma.clinicalHistory.create({
        data: {
          visitId: visit.id,
          chiefComplaint: `Synthetic queue complaint ${index}`,
        },
      });
      await prisma.doctorPatientAssignment.create({
        data: { doctorId, patientId: patient.id },
      });
      patientIds.push(patient.id);
      visitIds.push(visit.id);
      sessionIds.push(session.id);
    }
  });

  afterAll(async () => {
    if (!prisma) return;
    const entries = await prisma.queueEntry.findMany({
      where: { visitId: { in: visitIds } },
      select: { id: true, queueKey: true, queueDate: true },
    });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { actorUserId: doctorId },
          { entityId: { in: entries.map((entry) => entry.id) } },
        ],
      },
    });
    await prisma.queueEntry.deleteMany({
      where: { visitId: { in: visitIds } },
    });
    await prisma.doctorPatientAssignment.deleteMany({
      where: { patientId: { in: patientIds } },
    });
    await prisma.patientSession.deleteMany({
      where: { id: { in: sessionIds } },
    });
    await prisma.visit.deleteMany({ where: { id: { in: visitIds } } });
    await prisma.patientProfile.deleteMany({
      where: { id: { in: patientIds } },
    });
    await prisma.user.deleteMany({ where: { id: doctorId } });
    for (const entry of entries) {
      await prisma.queueCounter.deleteMany({
        where: { queueKey: entry.queueKey, queueDate: entry.queueDate },
      });
    }
    await prisma.$disconnect();
  });

  it("creates one token per visit under retry and unique constraints", async () => {
    const proof = new SessionProofService(secret);
    const token = proof.create(sessionIds[0]!);
    const [first, second] = await Promise.all([
      service.checkIn(token),
      service.checkIn(token),
    ]);
    expect(first.tokenId).toBe(second.tokenId);
    expect(
      await prisma.queueEntry.count({ where: { visitId: visitIds[0] } }),
    ).toBe(1);
  });

  it("allocates distinct daily sequences to concurrent patients", async () => {
    const proof = new SessionProofService(secret);
    await Promise.all([
      service.checkIn(proof.create(sessionIds[0]!)),
      service.checkIn(proof.create(sessionIds[1]!)),
    ]);
    const entries = await prisma.queueEntry.findMany({
      where: { visitId: { in: visitIds } },
      select: { sequence: true, tokenNumber: true },
    });
    expect(new Set(entries.map((entry) => entry.sequence)).size).toBe(2);
    expect(new Set(entries.map((entry) => entry.tokenNumber)).size).toBe(2);
  });

  it("lets concurrent Call Next requests produce one called transition and audit", async () => {
    const [first, second] = await Promise.all([
      service.callNext(doctorToken),
      service.callNext(doctorToken),
    ]);
    expect(first.id).toBe(second.id);
    expect(
      await prisma.queueEntry.count({
        where: { visitId: { in: visitIds }, status: "CALLED" },
      }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: { entityId: first.id, action: "TOKEN_CALLED" },
      }),
    ).toBe(1);
  });
});
