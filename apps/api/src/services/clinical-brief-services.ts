import type { PrismaClient } from "@prisma/client";
import { ClinicalBriefService } from "../clinical-brief/clinical-brief-service.js";
import { ClinicalBriefRepository } from "../repositories/clinical-brief-repository.js";

export const createClinicalBriefService = (prisma: PrismaClient) =>
  new ClinicalBriefService(new ClinicalBriefRepository(prisma));
