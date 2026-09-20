import { PrismaClient } from "@prisma/client";
import { seedRoutingDataset, routingDataset } from "../src/routing/routing-dataset.js";
const prisma = new PrismaClient();
try {
  await seedRoutingDataset(prisma);
  console.log(JSON.stringify({ version: routingDataset.version, specializations: routingDataset.specializations.length, mappings: routingDataset.mappings.length, reviewStatus: routingDataset.reviewStatus }));
} finally { await prisma.$disconnect(); }
