import type { InterviewDto, InterviewResponsePreviewDto } from "@helios/shared";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import type { DatabaseService } from "../src/repositories/database.js";
import type { InterviewOperations } from "../src/services/interview-service.js";
import type { PatientFlowOperations } from "../src/services/patient-flow-service.js";
import type { VoiceOperations } from "../src/services/voice-service.js";

const interviewId = "cm423456789012345678901234";
const sessionId = "cm123456789012345678901234";
const responseId = "cm523456789012345678901234";
const dto: InterviewDto = {
  id: interviewId,
  sessionId,
  visitId: "cm323456789012345678901234",
  pathway: "abdominal_pain",
  status: "ACTIVE",
  completeness: 50,
  completenessMessage: "Building your health history…",
  currentQuestion: {
    id: "abdominal_pain.location",
    category: "HPI",
    text: "Where do you feel it?",
    inputType: "CHOICE",
    required: true,
    priority: 100,
  },
  state: {
    pathway: "abdominal_pain",
    facts: {},
    unknownFields: [],
    conflicts: [],
  },
  responses: [],
  startedAt: new Date(0).toISOString(),
};
const preview: InterviewResponsePreviewDto = {
  interview: dto,
  response: {
    id: responseId,
    questionId: "abdominal_pain.location",
    rawAnswer: "Upper abdomen",
    normalizedAnswer: { field: "location", value: "Upper abdomen" },
    language: "en",
    source: "PATIENT_REPORTED",
    confidenceBand: "HIGH",
    status: "STRUCTURED",
    createdAt: new Date(0).toISOString(),
  },
  needsConfirmation: true,
};
const interview = {
  create: vi.fn(async () => dto),
  get: vi.fn(async () => dto),
  currentQuestion: vi.fn(async () => ({ question: dto.currentQuestion })),
  respond: vi.fn(async () => preview),
  confirm: vi.fn(async () => ({ ...dto, status: "REVIEW" })),
  revise: vi.fn(async () => dto),
  complete: vi.fn(async () => ({ ...dto, status: "COMPLETED" })),
} satisfies InterviewOperations;
const database: DatabaseService = {
  checkConnection: async () => "up",
  disconnect: async () => undefined,
};

describe("interview API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates and retrieves an interview through the DTO boundary", async () => {
    const app = createApp(
      database,
      {} as PatientFlowOperations,
      {} as VoiceOperations,
      interview,
    );
    const created = await request(app)
      .post("/api/v1/interviews")
      .set("x-session-token", "proof")
      .send({
        sessionId,
        chiefComplaint: "Stomach pain for 3 days",
        language: "en",
      });
    expect(created.status).toBe(201);
    expect(created.body.data.pathway).toBe("abdominal_pain");
    const loaded = await request(app)
      .get(`/api/v1/interviews/${interviewId}`)
      .set("x-session-token", "proof");
    expect(loaded.status).toBe(200);
  });

  it("validates answers before calling the service", async () => {
    const response = await request(
      createApp(
        database,
        {} as PatientFlowOperations,
        {} as VoiceOperations,
        interview,
      ),
    )
      .post(`/api/v1/interviews/${interviewId}/response`)
      .set("x-session-token", "proof")
      .send({ questionId: "x", rawAnswer: "", language: "en" });
    expect(response.status).toBe(400);
    expect(interview.respond).not.toHaveBeenCalled();
  });

  it("supports response confirmation and completion", async () => {
    const app = createApp(
      database,
      {} as PatientFlowOperations,
      {} as VoiceOperations,
      interview,
    );
    const confirmed = await request(app)
      .post(`/api/v1/interviews/${interviewId}/confirm`)
      .set("x-session-token", "proof")
      .send({ responseId });
    expect(confirmed.status).toBe(200);
    const completed = await request(app)
      .post(`/api/v1/interviews/${interviewId}/complete`)
      .set("x-session-token", "proof");
    expect(completed.status).toBe(200);
  });
});
