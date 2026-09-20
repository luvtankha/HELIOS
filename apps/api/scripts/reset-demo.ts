import { PrismaClient } from "@prisma/client";
import { rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { assertDemoSeedAllowed } from "../prisma/demo-guard.js";

assertDemoSeedAllowed(process.env);
const prisma = new PrismaClient();

try {
  const foreignPatientCount = await prisma.patientProfile.count({
    where: { patientCode: { not: { startsWith: "DEMO-" } } },
  });
  if (foreignPatientCount)
    throw new Error(
      "Demo reset refuses a database containing non-demo patients",
    );
  const patients = await prisma.patientProfile.findMany({
    where: { patientCode: { startsWith: "DEMO-" } },
    select: { id: true },
  });
  const patientIds = patients.map((patient) => patient.id);
  const tokens = await prisma.queueEntry.findMany({
    where: { patientId: { in: patientIds } },
    select: { id: true, queueDate: true, queueKey: true },
  });
  await prisma.$transaction(async (transaction) => {
    // Routing decisions retain visit/session references and must be cleared before
    // deleting synthetic sessions. The routing taxonomy itself is retained.
    await transaction.routingDecision.deleteMany({
      where: { visit: { patientId: { in: patientIds } } },
    });
    await transaction.queueEvent.deleteMany({
      where: { tokenId: { in: tokens.map((token) => token.id) } },
    });
    await transaction.queueEntry.deleteMany({
      where: { patientId: { in: patientIds } },
    });
    await transaction.doctorVerification.deleteMany({
      where: { patientId: { in: patientIds } },
    });
    await transaction.clinicalBrief.deleteMany({
      where: { patientId: { in: patientIds } },
    });
    await transaction.comparison.deleteMany({
      where: { patientId: { in: patientIds } },
    });
    // Documents restrict session deletion; visit-linked briefs/comparisons restrict visits.
    await transaction.medicalDocument.deleteMany({
      where: { patientId: { in: patientIds } },
    });
    await transaction.patientSession.deleteMany({
      where: { patientId: { in: patientIds } },
    });
    await transaction.visit.deleteMany({
      where: { patientId: { in: patientIds } },
    });
    await transaction.patientProfile.deleteMany({
      where: { id: { in: patientIds } },
    });
    await transaction.user.deleteMany({
      where: { username: { startsWith: "demo." } },
    });
    for (const token of tokens) {
      await transaction.queueCounter.deleteMany({
        where: { queueKey: token.queueKey, queueDate: token.queueDate },
      });
    }
  });
  const storageRoot = resolve(
    process.cwd(),
    process.env.STORAGE_PATH ?? "./uploads",
  );
  const demoStorage = resolve(storageRoot, "demo-synthetic");
  if (!demoStorage.startsWith(`${storageRoot}${sep}`))
    throw new Error("Demo storage cleanup escaped the configured storage root");
  await rm(demoStorage, { recursive: true, force: true });
  console.log(JSON.stringify({ removedSyntheticPatients: patientIds.length }));
} finally {
  await prisma.$disconnect();
}
