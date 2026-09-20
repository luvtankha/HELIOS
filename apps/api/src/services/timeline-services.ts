import type { PrismaClient } from "@prisma/client";
import { TimelineRepository } from "../repositories/timeline-repository.js";
import { TimelineService } from "../timeline/timeline-service.js";

export function createTimelineService(prisma: PrismaClient) {
  return new TimelineService(new TimelineRepository(prisma));
}
