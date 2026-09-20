import type { PrismaClient } from "@prisma/client";
import { ConsentRepository } from "../repositories/consent-repository.js";
import { IntakeRepository } from "../repositories/intake-repository.js";
import { PatientRepository } from "../repositories/patient-repository.js";
import { SessionRepository } from "../repositories/session-repository.js";
import { VisitRepository } from "../repositories/visit-repository.js";
import { QueueRepository } from "../queue/queue-repository.js";
import { QueueService } from "../queue/queue-service.js";
import { env } from "../config/env.js";
import { sessionProof } from "../security/session-proof.js";
import {
  PatientFlowService,
  type PatientFlowOperations,
} from "./patient-flow-service.js";
import { RoutingService } from "../routing/routing-service.js";

export function createPatientFlowService(
  prisma: PrismaClient,
): PatientFlowOperations {
  return new PatientFlowService(
    new PatientRepository(prisma),
    new SessionRepository(prisma),
    new VisitRepository(prisma),
    new ConsentRepository(prisma),
    new IntakeRepository(prisma),
    sessionProof,
    new QueueService(new QueueRepository(prisma)),
    env.ENABLE_SPECIALIZATION_ROUTING
      ? new RoutingService(prisma)
      : undefined,
  );
}
