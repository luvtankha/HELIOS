import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { datasetSchema } from "./contracts.js";

export const routingDataset = datasetSchema.parse(JSON.parse(readFileSync(fileURLToPath(new URL("../../../../dataset/routing/specialization-routing.json", import.meta.url)), "utf8")));
const ids = new Set(routingDataset.specializations.map(s => s.id));
if (ids.size !== routingDataset.specializations.length || new Set(routingDataset.mappings.map(m => m.id)).size !== routingDataset.mappings.length) throw new Error("Duplicate routing dataset identifiers");
for (const mapping of routingDataset.mappings) {
  if (![mapping.primarySpecialization,...mapping.secondarySpecializations].every(id => ids.has(id))) throw new Error("Unknown mapping specialization");
}
export const routingDatasetHash = createHash("sha256").update(JSON.stringify(routingDataset)).digest("hex");

export async function seedRoutingDataset(prisma: PrismaClient) {
  await prisma.$transaction(async tx => {
    for (const item of routingDataset.specializations) {
      await tx.specialization.upsert({ where: { id: item.id }, create: item, update: { ...item, active: true } });
    }
    await tx.medicalConditionSpecialization.updateMany({ data: { active: false } });
    for (const mapping of routingDataset.mappings) {
      const data = { conditionName: mapping.conditionName, primarySpecializationId: mapping.primarySpecialization, definition: mapping, datasetVersion: routingDataset.version, active: mapping.active };
      await tx.medicalConditionSpecialization.upsert({ where: { id: mapping.id }, create: { id: mapping.id,...data }, update: data });
    }
  });
}
