export interface SpecializationDto { id: string; displayName: string; providerType: string }
export interface RoutingRecommendationDto {
  primarySpecialization: string; alternativeSpecializations: string[]; confidence: number;
  confidenceBand: "low" | "medium" | "high"; confidenceMeaning: "heuristic_match_not_probability";
  urgency: "routine" | "soon" | "urgent" | "emergency"; emergencyEscalation: boolean;
  matchedConditions: string[]; matchedSymptoms: string[]; emergencyRuleIds: string[];
  reason: string; limitations: string; version: string;
}
export interface RoutingAssessmentDto {
  decisionId: string; createdAt: string; recommendation: RoutingRecommendationDto;
  specializations: SpecializationDto[]; selectedProviderId: string | null;
  reviewStatus: "CLINICIAN_REVIEW_REQUIRED";
}
export interface RoutingProviderDto {
  id: string; displayName: string; specialization: SpecializationDto;
  acceptingRouting: boolean;
}
export interface RoutingProviderListDto { providers: RoutingProviderDto[]; specializationId: string | null; availabilityNote: string }
