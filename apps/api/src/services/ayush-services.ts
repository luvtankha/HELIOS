import type { PrismaClient } from "@prisma/client";
import { AyushService } from "../ayush/ayush-service.js";
import { DoctorProofService } from "../security/doctor-proof.js";
import { sessionProof } from "../security/session-proof.js";
import { AyushRepository } from "../repositories/ayush-repository.js";
import { TimelineRepository } from "../repositories/timeline-repository.js";
import { TimelineRebuildService } from "../timeline/timeline-rebuild-service.js";

export function createAyushService(prisma: PrismaClient) {
  return new AyushService(
    new AyushRepository(prisma),
    new TimelineRebuildService(new TimelineRepository(prisma)),
    sessionProof,
    new DoctorProofService(),
  );
}
