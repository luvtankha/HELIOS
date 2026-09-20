import { PrismaClient } from "@prisma/client";
import { assertDemoSeedAllowed } from "../prisma/demo-guard.js";
import { validateDemoState } from "../src/demo/validate-demo-state.js";

assertDemoSeedAllowed(process.env);
const prisma = new PrismaClient();

try {
  const strictResult = await validateDemoState(prisma);
  if (strictResult.state !== "READY")
    throw new Error(
      `Demo invariant check failed: ${JSON.stringify(strictResult.checks)}`,
    );
  const patientWhere = { patientCode: { startsWith: "DEMO-" } } as const;
  const patients = await prisma.patientProfile.findMany({
    where: patientWhere,
    select: { id: true },
  });
  const patientIds = patients.map((patient) => patient.id);
  const visitWhere = { patientId: { in: patientIds } } as const;
  const [
    visits,
    documents,
    timelineEvents,
    conversations,
    queueTokens,
    symptoms,
    medications,
    allergies,
    observations,
    documentFacts,
    ayushRecords,
    verifications,
  ] = await Promise.all([
    prisma.visit.count({ where: visitWhere }),
    prisma.medicalDocument.count({ where: { patientId: { in: patientIds } } }),
    prisma.timelineEvent.count({ where: { patientId: { in: patientIds } } }),
    prisma.interviewResponse.count({
      where: { interview: { visit: visitWhere } },
    }),
    prisma.queueEntry.count({ where: { patientId: { in: patientIds } } }),
    prisma.symptom.count({ where: { visit: visitWhere } }),
    prisma.medication.count({ where: { patientId: { in: patientIds } } }),
    prisma.allergy.count({ where: { patientId: { in: patientIds } } }),
    prisma.observation.count({ where: { patientId: { in: patientIds } } }),
    prisma.documentFact.count({ where: { patientId: { in: patientIds } } }),
    prisma.ayushRecord.count({ where: { patientId: { in: patientIds } } }),
    prisma.doctorVerification.count({
      where: { patientId: { in: patientIds } },
    }),
  ]);
  const result = {
    patients: patients.length,
    visits,
    clinicalFacts:
      symptoms +
      medications +
      allergies +
      observations +
      documentFacts +
      ayushRecords,
    documents,
    timelineEvents,
    conversations,
    queueTokens,
    verifications,
    goldenPatientPresent: patientIds.includes("demo-patient-aarav"),
  };
  if (
    result.patients < 10 ||
    !result.goldenPatientPresent ||
    result.queueTokens < 4
  )
    throw new Error(`Demo consistency check failed: ${JSON.stringify(result)}`);
  console.log(JSON.stringify(result, null, 2));
} finally {
  await prisma.$disconnect();
}
