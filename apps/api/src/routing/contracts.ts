import { z } from "zod";

export const urgencySchema = z.enum(["routine", "soon", "urgent", "emergency"]);
export const specializationSchema = z.object({
  id: z.string().regex(/^[a-z-]+$/), displayName: z.string(), aliases: z.array(z.string()),
  description: z.string(), source: z.string().url(), providerType: z.enum(["physician", "dental", "allied", "unknown"]),
});
export const mappingSchema = z.object({
  id: z.string(), conditionName: z.string(), aliases: z.array(z.string()), category: z.string(), bodySystem: z.string(),
  symptomKeywords: z.array(z.string()), injuryKeywords: z.array(z.string()),
  primarySpecialization: z.string(), secondarySpecializations: z.array(z.string()), urgencyDefault: urgencySchema,
  ageGroup: z.enum(["all", "adult", "child"]), genderContext: z.string().nullable(), description: z.string(), routingNotes: z.string(),
  emergencyRedFlags: z.array(z.string()), sourceOrReference: z.array(z.string().url()), active: z.boolean(),
  // Every group needs at least one match. Empty groups allow disease/alias matches only.
  requiredGroups: z.array(z.array(z.string())), minSignals: z.number().int().min(1), priority: z.number().int(),
});
export const emergencyRuleSchema = z.object({ id: z.string(), groups: z.array(z.array(z.string())).min(1), reason: z.string(), source: z.string().url() });
export const datasetSchema = z.object({ version: z.string(), reviewStatus: z.literal("CLINICIAN_REVIEW_REQUIRED"), specializations: z.array(specializationSchema), mappings: z.array(mappingSchema), emergencyRules: z.array(emergencyRuleSchema) });
export type Mapping = z.infer<typeof mappingSchema>;
export type EmergencyRule = z.infer<typeof emergencyRuleSchema>;
export interface RoutingInput {
  complaint?: string; symptoms?: string[]; knownConditions?: string[]; injury?: string;
  age?: number | null; sex?: string | null; duration?: string; severity?: string;
  clinicalContext?: { anatomicalLocation?: string; pregnant?: boolean; currentEmergencySignal?: boolean };
}
export interface RoutingResult {
  primarySpecialization: string; alternativeSpecializations: string[]; confidence: number;
  confidenceBand: "low" | "medium" | "high"; confidenceMeaning: "heuristic_match_not_probability";
  urgency: z.infer<typeof urgencySchema>; emergencyEscalation: boolean;
  matchedConditions: string[]; matchedSymptoms: string[]; emergencyRuleIds: string[];
  reason: string; limitations: string; version: string;
}
