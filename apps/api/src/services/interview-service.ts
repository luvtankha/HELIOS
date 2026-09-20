import { performance } from "node:perf_hooks";
import type {
  InterviewResponsePreviewDto,
  InterviewStateDto,
  LanguageCode,
} from "@helios/shared";
import { ClinicalNLUService } from "../interview/clinical-nlu.js";
import {
  InterviewEngine,
  type NormalizedAnswer,
} from "../interview/interview-engine.js";
import type { InterviewRepository } from "../repositories/interview-repository.js";
import type { SessionRepository } from "../repositories/session-repository.js";
import type { SessionProofService } from "../security/session-proof.js";
import {
  serializeInterview,
  serializeResponse,
} from "../serializers/interview.js";
import { AppError } from "../utils/app-error.js";
import { DeterministicLanguageDetectionProvider } from "../language/language-detection.js";

export interface InterviewOperations {
  create(
    input: {
      sessionId: string;
      chiefComplaint: string;
      language: LanguageCode;
    },
    token?: string,
  ): Promise<unknown>;
  get(id: string, token?: string): Promise<unknown>;
  currentQuestion(id: string, token?: string): Promise<unknown>;
  respond(
    id: string,
    input: { questionId: string; rawAnswer: string; language: LanguageCode },
    token?: string,
  ): Promise<InterviewResponsePreviewDto>;
  confirm(id: string, responseId: string, token?: string): Promise<unknown>;
  revise(id: string, field: string, token?: string): Promise<unknown>;
  complete(id: string, token?: string): Promise<unknown>;
}

export class InterviewService implements InterviewOperations {
  constructor(
    private readonly repository: InterviewRepository,
    private readonly sessions: SessionRepository,
    private readonly proof: SessionProofService,
    private readonly nlu: ClinicalNLUService,
    private readonly engine = new InterviewEngine(),
    private readonly detector = new DeterministicLanguageDetectionProvider(),
  ) {}

  async create(
    input: {
      sessionId: string;
      chiefComplaint: string;
      language: LanguageCode;
    },
    token?: string,
  ) {
    const sessionId = this.proof.verify(token);
    if (sessionId !== input.sessionId) this.denied();
    const session = await this.sessions.findById(sessionId);
    if (!session?.visitId)
      throw new AppError("Visit is not ready", 409, "VISIT_NOT_READY");
    const state = this.engine.initialize(input.chiefComplaint);
    const current = this.engine.getCurrentQuestion(state, input.language);
    const record = await this.repository.upsert({
      sessionId,
      visitId: session.visitId,
      pathway: state.pathway,
      state: state as unknown as import("@prisma/client").Prisma.InputJsonValue,
      ...(current && { currentQuestionId: current.id }),
      completeness: this.engine.completeness(state),
    });
    return serializeInterview(record);
  }

  async get(id: string, token?: string) {
    return serializeInterview(await this.owned(id, token));
  }

  async currentQuestion(id: string, token?: string) {
    const record = await this.ownedForResponse(id, token);
    return {
      question: this.engine.getCurrentQuestion(
        record.state as unknown as InterviewStateDto,
        record.session?.language === "hi" ? "hi" : "en",
      ),
      completeness: Math.round(record.completeness * 100),
    };
  }

  async respond(
    id: string,
    input: { questionId: string; rawAnswer: string; language: LanguageCode },
    token?: string,
  ) {
    const record = await this.ownedForResponse(id, token);
    if (record.status !== "ACTIVE")
      throw new AppError(
        "This interview is not accepting answers",
        409,
        "INTERVIEW_NOT_ACTIVE",
      );
    const state = record.state as unknown as InterviewStateDto;
    const sessionLanguage = record.session?.language === "hi" ? "hi" : "en";
    if (input.language !== sessionLanguage)
      throw new AppError(
        "The answer language does not match the active session",
        400,
        "INTERVIEW_LANGUAGE_MISMATCH",
      );
    const current = this.engine.getCurrentQuestion(state, sessionLanguage);
    if (!current || current.id !== input.questionId)
      throw new AppError(
        "Please answer the current question",
        409,
        "QUESTION_OUT_OF_SEQUENCE",
      );
    const deterministic = this.engine.processAnswer(
      state,
      input.questionId,
      input.rawAnswer,
    );
    const started = performance.now();
    const interpreted = await this.nlu.interpret({
      question: current,
      rawAnswer: input.rawAnswer,
      deterministic,
      relevantFact: state.facts[deterministic.field]?.value,
    });
    const detection = this.detector.detectFromText(
      input.rawAnswer,
      sessionLanguage,
    );
    const response = await this.repository.createResponse({
      interviewId: id,
      questionId: input.questionId,
      rawAnswer: input.rawAnswer,
      normalizedAnswer:
        interpreted.answer as unknown as import("@prisma/client").Prisma.InputJsonValue,
      language: input.language,
      originalLanguage: detection.primaryLanguage,
      detectedLanguages: detection.detectedLanguages,
      displayLanguage: sessionLanguage,
      displayText: input.rawAnswer,
      source: interpreted.answer.source,
      confidence: confidenceValue(interpreted.answer.confidence),
      status:
        interpreted.answer.state === "CONFLICT" || interpreted.answer.ambiguous
          ? "NEEDS_CLARIFICATION"
          : "STRUCTURED",
    });
    await this.repository.recordAI({
      interviewId: id,
      responseId: response.id,
      provider: interpreted.provider,
      ...(interpreted.model && { model: interpreted.model }),
      inputType: current.inputType,
      validationStatus: interpreted.validationStatus,
      ...(interpreted.inputTokens !== undefined && {
        inputTokens: interpreted.inputTokens,
      }),
      ...(interpreted.outputTokens !== undefined && {
        outputTokens: interpreted.outputTokens,
      }),
      latencyMs: Math.round(performance.now() - started),
    });
    return {
      interview: serializeInterview({ ...record, responses: [] }),
      response: serializeResponse(response),
      needsConfirmation: true as const,
      ...((interpreted.answer.ambiguous ||
        interpreted.answer.state === "CONFLICT") && {
        clarificationMessage:
          "Please confirm this answer. We may need one short clarification.",
      }),
    };
  }

  async confirm(id: string, responseId: string, token?: string) {
    const record = await this.owned(id, token);
    const response = await this.repository.findResponse(responseId);
    if (!response || response.interviewId !== id) this.denied();
    const normalized = response.normalizedAnswer as unknown as NormalizedAnswer;
    const updated = this.engine.updateState(
      record.state as unknown as InterviewStateDto,
      normalized,
      response.rawAnswer,
    );
    const next = this.engine.getCurrentQuestion(
      updated,
      record.session?.language === "hi" ? "hi" : "en",
    );
    const review = this.engine.isComplete(updated);
    const confirmed = await this.repository.confirmResponse({
      responseId,
      interviewId: id,
      sessionId: record.sessionId,
      expectedQuestionId: record.currentQuestionId ?? response.questionId,
      state:
        updated as unknown as import("@prisma/client").Prisma.InputJsonValue,
      ...(next && { currentQuestionId: next.id }),
      completeness: this.engine.completeness(updated),
      review,
    });
    return serializeInterview(confirmed);
  }

  async complete(id: string, token?: string) {
    const record = await this.owned(id, token);
    const state = record.state as unknown as InterviewStateDto;
    if (!this.engine.isComplete(state))
      throw new AppError(
        "Please complete the required history first",
        409,
        "INTERVIEW_INCOMPLETE",
      );
    await this.repository.complete(
      id,
      record.visitId,
      this.engine.getSummary(state),
    );
    return this.get(id, token);
  }

  async revise(id: string, field: string, token?: string) {
    const record = await this.owned(id, token);
    if (record.status !== "REVIEW")
      throw new AppError(
        "Answers can only be changed from review",
        409,
        "INTERVIEW_NOT_IN_REVIEW",
      );
    try {
      const state = this.engine.revise(
        record.state as unknown as InterviewStateDto,
        field,
      );
      const question = this.engine.getCurrentQuestion(state);
      if (!question) throw new Error("No revision question available");
      const updated = await this.repository.revise(
        id,
        state as unknown as import("@prisma/client").Prisma.InputJsonValue,
        question.id,
        this.engine.completeness(state),
      );
      return serializeInterview(updated);
    } catch {
      throw new AppError(
        "That answer cannot be changed here",
        400,
        "FIELD_NOT_REVISABLE",
      );
    }
  }

  private async owned(id: string, token?: string) {
    const sessionId = this.proof.verify(token);
    const record = await this.repository.findById(id);
    if (!record)
      throw new AppError("Interview not found", 404, "INTERVIEW_NOT_FOUND");
    if (record.sessionId !== sessionId) this.denied();
    return record;
  }

  private async ownedForResponse(id: string, token?: string) {
    const sessionId = this.proof.verify(token);
    const record = await this.repository.findForResponse(id);
    if (!record)
      throw new AppError("Interview not found", 404, "INTERVIEW_NOT_FOUND");
    if (record.sessionId !== sessionId) this.denied();
    return record;
  }

  private denied(): never {
    throw new AppError(
      "This interview does not belong to the active session",
      403,
      "INTERVIEW_SESSION_MISMATCH",
    );
  }
}

function confidenceValue(value: NormalizedAnswer["confidence"]) {
  return value === "HIGH" ? 0.9 : value === "MEDIUM" ? 0.65 : 0.35;
}
