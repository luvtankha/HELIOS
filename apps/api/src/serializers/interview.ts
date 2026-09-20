import type {
  ConfidenceBand,
  InterviewDto,
  InterviewResponseDto,
  InterviewStateDto,
} from "@helios/shared";
import { InterviewEngine } from "../interview/interview-engine.js";

const engine = new InterviewEngine();

export function serializeResponse(response: {
  id: string;
  questionId: string;
  rawAnswer: string;
  normalizedAnswer: unknown;
  language: string;
  originalLanguage?: string | null;
  detectedLanguages?: unknown;
  displayLanguage?: string | null;
  displayText?: string | null;
  source: string;
  confidence: number | null;
  status: string;
  createdAt: Date;
}): InterviewResponseDto {
  return {
    id: response.id,
    questionId: response.questionId,
    rawAnswer: response.rawAnswer,
    originalText: response.rawAnswer,
    originalLanguage:
      response.originalLanguage === "hi"
        ? "hi"
        : response.language === "hi"
          ? "hi"
          : "en",
    ...(response.displayLanguage && {
      displayLanguage: response.displayLanguage === "hi" ? "hi" : "en",
    }),
    ...(response.displayText && { displayText: response.displayText }),
    ...(response.normalizedAnswer !== null && {
      normalizedAnswer: response.normalizedAnswer,
    }),
    language: response.language === "hi" ? "hi" : "en",
    source:
      response.source === "AI_STRUCTURED"
        ? "AI_STRUCTURED"
        : "PATIENT_REPORTED",
    confidenceBand: band(response.confidence),
    status: response.status as InterviewResponseDto["status"],
    createdAt: response.createdAt.toISOString(),
  };
}

export function serializeInterview(record: {
  id: string;
  sessionId: string;
  visitId: string;
  pathway: string;
  state: unknown;
  status: string;
  completeness: number;
  responses: Array<{
    id: string;
    questionId: string;
    rawAnswer: string;
    normalizedAnswer: unknown;
    language: string;
    source: string;
    confidence: number | null;
    status: string;
    createdAt: Date;
  }>;
  startedAt: Date;
  completedAt: Date | null;
  session?: { language: string };
}): InterviewDto {
  const state = record.state as InterviewStateDto;
  const language = record.session?.language === "hi" ? "hi" : "en";
  const currentQuestion = engine.getCurrentQuestion(state, language);
  const percent = Math.round(record.completeness * 100);
  return {
    id: record.id,
    sessionId: record.sessionId,
    visitId: record.visitId,
    pathway: record.pathway,
    status: record.status as InterviewDto["status"],
    completeness: percent,
    completenessMessage:
      language === "hi"
        ? percent >= 80
          ? "आपकी स्वास्थ्य जानकारी लगभग पूरी है।"
          : "आपकी स्वास्थ्य जानकारी तैयार की जा रही है…"
        : percent >= 80
          ? "Your health history is almost complete."
          : "Building your health history…",
    ...(currentQuestion && { currentQuestion }),
    state,
    responses: record.responses.map(serializeResponse),
    startedAt: record.startedAt.toISOString(),
    ...(record.completedAt && {
      completedAt: record.completedAt.toISOString(),
    }),
  };
}

function band(value: number | null): ConfidenceBand {
  if (value === null) return "UNKNOWN";
  if (value >= 0.8) return "HIGH";
  if (value >= 0.55) return "MEDIUM";
  return "LOW";
}
