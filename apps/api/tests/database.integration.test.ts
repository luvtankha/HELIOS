import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RoutingRepository } from "../src/routing/routing-repository.js";
import { seedRoutingDataset } from "../src/routing/routing-dataset.js";
import { QueueRepository } from "../src/queue/queue-repository.js";
import { QueueService } from "../src/queue/queue-service.js";
import { sessionProof } from "../src/security/session-proof.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integration = describe.skipIf(!testDatabaseUrl);
let prisma: PrismaClient;
let patientId = "";
let sessionId = "";
let visitId = "";
let doctorId = "";
let documentId = "";

integration("PostgreSQL domain integration", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    prisma = new PrismaClient();
    await seedRoutingDataset(prisma);
    const suffix = crypto.randomUUID();
    const doctor = await prisma.user.create({
      data: {
        username: `synthetic-doctor-${suffix}`,
        displayName: "Synthetic Test Doctor",
        role: "DOCTOR",
        specializationId: "internal-medicine",
        acceptingRouting: true,
      },
    });
    doctorId = doctor.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    if (visitId) {
      const tokens = await prisma.queueEntry.findMany({
        where: { visitId },
        select: { id: true },
      });
      await prisma.queueEvent.deleteMany({
        where: { tokenId: { in: tokens.map((token) => token.id) } },
      });
      await prisma.queueEntry.deleteMany({ where: { visitId } });
    }
    if (visitId)
      await prisma.doctorVerification.deleteMany({ where: { visitId } });
    if (documentId)
      await prisma.medicalDocument.delete({ where: { id: documentId } });
    if (sessionId)
      await prisma.routingDecision.deleteMany({ where: { sessionId } });
    if (sessionId)
      await prisma.patientSession.delete({ where: { id: sessionId } });
    if (visitId) await prisma.visit.delete({ where: { id: visitId } });
    if (patientId)
      await prisma.doctorPatientAssignment.deleteMany({ where: { patientId } });
    if (patientId)
      await prisma.patientProfile.delete({ where: { id: patientId } });
    if (doctorId) await prisma.user.delete({ where: { id: doctorId } });
    await prisma.$disconnect();
  });

  it("creates a patient", async () => {
    const patient = await prisma.patientProfile.create({
      data: {
        patientCode: `TEST-${crypto.randomUUID()}`,
        fullName: "Synthetic Test Patient",
        age: 24,
        sex: "MALE",
      },
    });
    patientId = patient.id;
    expect(patient.patientCode).toContain("TEST-");
  });

  it("creates a session, visit, and clinical history", async () => {
    const visit = await prisma.visit.create({ data: { patientId } });
    visitId = visit.id;
    const session = await prisma.patientSession.create({
      data: { patientId, visitId, currentStep: "CHIEF_COMPLAINT" },
    });
    sessionId = session.id;
    const history = await prisma.clinicalHistory.create({
      data: { visitId, chiefComplaint: "Synthetic integration-test complaint" },
    });
    expect(history.source).toBe("PATIENT_REPORTED");
  });

  it("persists a database-backed routing decision from patient-reported input", async () => {
    await prisma.clinicalHistory.update({
      where: { visitId },
      data: { chiefComplaint: "Persistent migraine with aura" },
    });
    const assessment = await new RoutingRepository(prisma).assess(sessionId);
    expect(assessment.recommendation.primarySpecialization).toBe("neurology");
    expect(assessment.reviewStatus).toBe("CLINICIAN_REVIEW_REQUIRED");
    expect(await prisma.routingDecision.count({ where: { sessionId } })).toBe(1);
    expect(
      await prisma.medicalConditionSpecialization.count({ where: { active: true } }),
    ).toBeGreaterThanOrEqual(34);
  });

  it("uses a patient-selected available provider in the existing queue workflow", async () => {
    await prisma.visit.update({
      where: { id: visitId },
      data: { preferredDoctorId: doctorId },
    });
    const status = await new QueueService(
      new QueueRepository(prisma),
    ).checkIn(sessionProof.create(sessionId));
    expect(status.tokenNumber).toMatch(/^A-\d{3}$/);
    expect(
      await prisma.queueEntry.findUnique({
        where: { visitId },
        select: { doctorId: true },
      }),
    ).toMatchObject({ doctorId });
    expect(
      await prisma.doctorPatientAssignment.findUnique({
        where: { doctorId_patientId: { doctorId, patientId } },
      }),
    ).toMatchObject({ active: true });
  });

  it("creates consent and timeline provenance", async () => {
    const consent = await prisma.consentRecord.create({
      data: {
        patientId,
        sessionId,
        consentType: "PRE_CONSULTATION",
        accepted: true,
        version: "test-1.0",
      },
    });
    const timeline = await prisma.timelineEvent.create({
      data: {
        patientId,
        visitId,
        eventType: "PATIENT_VISIT",
        title: "Synthetic test event",
        eventDate: new Date(),
        source: "SYSTEM_GENERATED",
        sourceType: "INTEGRATION_TEST",
        sourceId: "integration-test-event",
        normalizedKey: "integration-test",
        fingerprint: `integration-${crypto.randomUUID()}`,
        datePrecision: "EXACT_DATE",
        temporalState: "NOT_APPLICABLE",
        verificationStatus: "CAPTURED",
      },
    });
    expect(consent.accepted).toBe(true);
    expect(timeline.source).toBe("SYSTEM_GENERATED");
  });

  it("keeps doctor verification separate", async () => {
    const verification = await prisma.doctorVerification.create({
      data: {
        patientId,
        visitId,
        factType: "CLINICAL_HISTORY",
        factId: visitId,
        action: "VERIFY",
        previousStatus: "PATIENT_REPORTED",
        newStatus: "DOCTOR_VERIFIED",
        originalValue: { source: "PATIENT_REPORTED" },
        verifiedValue: { source: "DOCTOR_VERIFIED" },
        status: "DOCTOR_VERIFIED",
        sourceType: "PATIENT_REPORTED",
        evidenceReferences: [],
        verifiedBy: doctorId,
        verifiedAt: new Date(),
        factVersion: 1,
        idempotencyKey: crypto.randomUUID(),
      },
    });
    expect(verification.status).toBe("DOCTOR_VERIFIED");
  });

  it("persists document pages, facts, evidence, jobs, and timeline provenance", async () => {
    const document = await prisma.medicalDocument.create({
      data: {
        patientId,
        visitId,
        sessionId,
        fileName: "synthetic-lab.pdf",
        mimeType: "application/pdf",
        storagePath: "integration/private/synthetic-lab.pdf",
        fileSize: 128,
        fileHash: crypto.randomUUID().replaceAll("-", ""),
        documentType: "LAB_REPORT",
        uploadedBy: sessionId,
        processingStatus: "REVIEW_REQUIRED",
        pages: {
          create: {
            pageNumber: 1,
            ocrText: "Hemoglobin 9.2 g/dL",
            processingStatus: "REVIEW_REQUIRED",
          },
        },
        facts: {
          create: {
            patientId,
            visitId,
            factType: "lab_result",
            originalValue: "Hemoglobin 9.2 g/dL",
            normalizedValue: {
              testName: "Hemoglobin",
              result: 9.2,
              unit: "g/dL",
            },
            source: "DOCUMENT_EXTRACTED",
            evidence: {
              create: {
                pageNumber: 1,
                sourceText: "Hemoglobin 9.2 g/dL",
                confidence: 0.98,
              },
            },
          },
        },
        jobs: {
          create: {
            status: "REVIEW_REQUIRED",
            progress: 100,
            attempts: 1,
          },
        },
      },
      include: {
        pages: true,
        facts: { include: { evidence: true } },
        jobs: true,
      },
    });
    documentId = document.id;
    const timeline = await prisma.timelineEvent.create({
      data: {
        patientId,
        visitId,
        documentId,
        eventType: "MEDICAL_DOCUMENT",
        title: "Lab report",
        eventDate: new Date(),
        source: "DOCUMENT_EXTRACTED",
        sourceType: "MEDICAL_DOCUMENT",
        sourceId: documentId,
        normalizedKey: "document",
        fingerprint: `integration-${crypto.randomUUID()}`,
        datePrecision: "EXACT_DATE",
        temporalState: "HISTORICAL",
        verificationStatus: "DOCUMENT_EXTRACTED",
      },
    });
    const factTimeline = await prisma.timelineEvent.create({
      data: {
        patientId,
        visitId,
        documentId,
        documentFactId: document.facts[0]?.id,
        eventType: "LAB_RESULT",
        title: "Hemoglobin",
        description: "9.2 g/dL",
        eventDate: new Date(),
        source: "DOCUMENT_EXTRACTED",
        sourceType: "DOCUMENT_FACT",
        sourceId: document.facts[0]?.id ?? "missing-fact",
        normalizedKey: "hemoglobin",
        fingerprint: `integration-${crypto.randomUUID()}`,
        datePrecision: "EXACT_DATE",
        temporalState: "HISTORICAL",
        verificationStatus: "DOCUMENT_EXTRACTED",
      },
    });
    await prisma.timelineEventVersion.create({
      data: {
        timelineEventId: factTimeline.id,
        version: 1,
        snapshot: { value: "9.2 g/dL" },
        changeReason: "INTEGRATION_TEST",
      },
    });
    const documentEvents = await prisma.timelineEvent.count({
      where: { documentId },
    });
    expect(document.pages).toHaveLength(1);
    expect(document.facts[0]?.source).toBe("DOCUMENT_EXTRACTED");
    expect(document.facts[0]?.evidence).toHaveLength(1);
    expect(document.jobs[0]?.progress).toBe(100);
    expect(timeline.documentId).toBe(documentId);
    expect(documentEvents).toBe(2);
    expect(
      await prisma.timelineEventVersion.count({
        where: { timelineEventId: factTimeline.id },
      }),
    ).toBe(1);
  });
});
