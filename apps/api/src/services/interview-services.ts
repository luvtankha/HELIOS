import type { PrismaClient } from "@prisma/client";
import { ClinicalNLUService } from "../interview/clinical-nlu.js";
import { createClinicalNLUProvider } from "../providers/clinical-nlu-provider-factory.js";
import { InterviewRepository } from "../repositories/interview-repository.js";
import { SessionRepository } from "../repositories/session-repository.js";
import { sessionProof } from "../security/session-proof.js";
import {
  InterviewService,
  type InterviewOperations,
} from "./interview-service.js";

export function createInterviewService(
  prisma: PrismaClient,
): InterviewOperations {
  return new InterviewService(
    new InterviewRepository(prisma),
    new SessionRepository(prisma),
    sessionProof,
    new ClinicalNLUService(createClinicalNLUProvider()),
  );
}
