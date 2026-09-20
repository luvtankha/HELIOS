import type { PrismaClient } from "@prisma/client";

export async function validateDemoState(prisma: PrismaClient) {
  const patients = await prisma.patientProfile.findMany({
    where: { patientCode: { startsWith: "DEMO-" } },
    select: { id: true },
  });
  const patientIds = patients.map((patient) => patient.id);
  const visitWhere = { patientId: { in: patientIds } } as const;
  const [
    visits,
    documents,
    timelineEvents,
    conversations,
    verifications,
    goldenVisits,
    goldenDocuments,
    goldenTimeline,
    queue,
    counter,
    foreignPatients,
  ] = await Promise.all([
    prisma.visit.count({ where: visitWhere }),
    prisma.medicalDocument.count({ where: { patientId: { in: patientIds } } }),
    prisma.timelineEvent.count({ where: { patientId: { in: patientIds } } }),
    prisma.interviewResponse.count({
      where: { interview: { visit: visitWhere } },
    }),
    prisma.doctorVerification.count({
      where: { patientId: { in: patientIds } },
    }),
    prisma.visit.count({ where: { patientId: "demo-patient-aarav" } }),
    prisma.medicalDocument.count({
      where: { patientId: "demo-patient-aarav" },
    }),
    prisma.timelineEvent.count({ where: { patientId: "demo-patient-aarav" } }),
    prisma.queueEntry.findMany({
      where: { id: { startsWith: "demo-queue-" } },
      select: {
        id: true,
        tokenNumber: true,
        sequence: true,
        status: true,
        patientId: true,
        visitId: true,
        queueDate: true,
        queueKey: true,
      },
    }),
    prisma.queueCounter.findFirst({
      where: { queueKey: "A" },
      orderBy: { queueDate: "desc" },
      select: { queueDate: true, nextValue: true, paused: true },
    }),
    prisma.patientProfile.count({
      where: { patientCode: { not: { startsWith: "DEMO-" } } },
    }),
  ]);
  const golden = queue.find((item) => item.id === "demo-queue-aarav");
  const tokenNumbers = queue.map((item) => item.tokenNumber);
  const sequences = queue.map((item) => item.sequence);
  const checks = {
    isolated: foreignPatients === 0,
    patients:
      patients.length === 12 && patientIds.includes("demo-patient-aarav"),
    visits: visits === 13 && goldenVisits === 2,
    documents: documents === 3 && goldenDocuments >= 1,
    timeline: timelineEvents === 9 && goldenTimeline >= 1,
    interviews: conversations === 5,
    verification: verifications === 1,
    queue:
      queue.length === 6 &&
      new Set(tokenNumbers).size === 6 &&
      new Set(sequences).size === 6 &&
      ["A-001", "A-002", "A-003", "A-004", "A-005", "A-006"].every((token) =>
        tokenNumbers.includes(token),
      ),
    goldenToken:
      golden?.tokenNumber === "A-001" &&
      golden.sequence === 1 &&
      golden.status === "WAITING" &&
      golden.patientId === "demo-patient-aarav" &&
      golden.visitId === "demo-visit-aarav-current" &&
      golden.queueKey === "A" &&
      golden.queueDate.getTime() === counter?.queueDate.getTime(),
    counter: counter?.nextValue === 7 && counter.paused === false,
  };
  return {
    state: Object.values(checks).every(Boolean)
      ? ("READY" as const)
      : ("INVALID" as const),
    checks,
    counts: {
      patients: patients.length,
      visits,
      documents,
      timelineEvents,
      conversations,
      queueTokens: queue.length,
      verifications,
    },
    capabilities: { safetyEngine: "UNAVAILABLE" as const },
  };
}
