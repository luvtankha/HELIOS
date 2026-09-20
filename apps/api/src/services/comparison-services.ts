import type { PrismaClient } from "@prisma/client";
import { ComparisonService } from "../comparison/comparison-service.js";
import { ComparisonRepository } from "../repositories/comparison-repository.js";
export const createComparisonService = (prisma: PrismaClient) =>
  new ComparisonService(new ComparisonRepository(prisma));
