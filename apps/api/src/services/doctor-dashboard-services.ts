import type { PrismaClient } from "@prisma/client";
import { DoctorDashboardService } from "../doctor-dashboard/doctor-dashboard-service.js";
import { DocumentRepository } from "../repositories/document-repository.js";
import { DoctorDashboardRepository } from "../repositories/doctor-dashboard-repository.js";
import { TimelineRepository } from "../repositories/timeline-repository.js";
import { createClinicalBriefService } from "./clinical-brief-services.js";
import { createComparisonService } from "./comparison-services.js";
import { createVerificationService } from "./verification-services.js";

export function createDoctorDashboardService(prisma: PrismaClient) {
  return new DoctorDashboardService(
    new DoctorDashboardRepository(prisma),
    createClinicalBriefService(prisma),
    createComparisonService(prisma),
    createVerificationService(prisma),
    new DocumentRepository(prisma),
    new TimelineRepository(prisma),
  );
}
