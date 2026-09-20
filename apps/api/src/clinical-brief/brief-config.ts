import { env } from "../config/env.js";

export interface BriefConfig {
  recentMonths: number;
  maxSymptoms: number;
  maxChanges: number;
  maxDocuments: number;
}

export const briefConfig: BriefConfig = Object.freeze({
  recentMonths: env.BRIEF_RECENT_MONTHS,
  maxSymptoms: env.BRIEF_MAX_SYMPTOMS,
  maxChanges: env.BRIEF_MAX_CHANGES,
  maxDocuments: env.BRIEF_MAX_DOCUMENTS,
});
