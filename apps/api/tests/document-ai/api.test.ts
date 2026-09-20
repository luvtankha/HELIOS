import type { MedicalDocumentDto } from "@helios/shared";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { resetRateLimitsForTests } from "../../src/middleware/rate-limit.js";
import type { DatabaseService } from "../../src/repositories/database.js";
import { createDocumentRouter } from "../../src/routes/documents.js";
import type { DocumentOperations } from "../../src/services/document-service.js";
import type { InterviewOperations } from "../../src/services/interview-service.js";
import type { PatientFlowOperations } from "../../src/services/patient-flow-service.js";
import type { VoiceOperations } from "../../src/services/voice-service.js";

const id = "document-12345678";
const patientId = "patient-12345678";
const sessionId = "session-12345678";
const token = "session-token";
const document: MedicalDocumentDto = {
  id,
  patientId,
  fileName: "lab.png",
  mimeType: "image/png",
  fileSize: 8,
  documentType: "LAB_REPORT",
  processingStatus: "REVIEW_REQUIRED",
  identityStatus: "MATCHED",
  pageCount: 1,
  pages: [],
  facts: [],
  uploadedAt: new Date(0).toISOString(),
};
const database = {
  checkConnection: async () => "up" as const,
  disconnect: async () => undefined,
} satisfies DatabaseService;
const patient = {} as PatientFlowOperations;
const voice = {} as VoiceOperations;
const interview = {} as InterviewOperations;
const documents = {
  upload: vi.fn(async () => document),
  get: vi.fn(async () => document),
  status: vi.fn(async () => ({ id, status: "REVIEW_REQUIRED" as const })),
  list: vi.fn(async () => [document]),
  content: vi.fn(async () => ({
    buffer: Buffer.from("%PDF"),
    mimeType: "application/pdf",
    fileName: "safe.pdf",
  })),
  startProcessing: vi.fn(async () => document),
  processNow: vi.fn(async () => document),
  updateFact: vi.fn(async () => document),
  overrideIdentity: vi.fn(async () => document),
  remove: vi.fn(async () => undefined),
  safetyEligibleFacts: vi.fn(async () => []),
} satisfies DocumentOperations;

describe("document API", () => {
  beforeEach(() => {
    resetRateLimitsForTests();
    vi.clearAllMocks();
  });

  it("does not apply the document limiter to unrelated API routes", async () => {
    const app = express();
    app.use("/api/v1", createDocumentRouter(documents));
    app.get("/api/v1/queue-probe", (_request, response) =>
      response.status(200).json({ success: true }),
    );
    for (let index = 0; index < 21; index += 1) {
      const response = await request(app).get("/api/v1/queue-probe");
      expect(response.status).toBe(200);
    }
  });

  it("still limits document endpoints after the scope correction", async () => {
    const app = express();
    app.use("/api/v1", createDocumentRouter(documents));
    for (let index = 0; index < 20; index += 1) {
      const response = await request(app).get(`/api/v1/documents/${id}`);
      expect(response.status).toBe(200);
    }
    const limited = await request(app).get(`/api/v1/documents/${id}`);
    expect(limited.status).toBe(429);
  });

  it("accepts a signature-validated private upload and returns immediately", async () => {
    const response = await request(
      createApp(database, patient, voice, interview, documents),
    )
      .post("/api/v1/documents")
      .set("x-session-token", token)
      .field("sessionId", sessionId)
      .field("patientId", patientId)
      .attach(
        "document",
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        {
          filename: "lab.png",
          contentType: "image/png",
        },
      );
    expect(response.status).toBe(201);
    expect(documents.upload).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId, patientId }),
      token,
    );
  });

  it("rejects mismatched file content before service execution", async () => {
    const response = await request(
      createApp(database, patient, voice, interview, documents),
    )
      .post("/api/v1/documents")
      .set("x-session-token", token)
      .field("sessionId", sessionId)
      .field("patientId", patientId)
      .attach("document", Buffer.from("not a png"), {
        filename: "lab.png",
        contentType: "image/png",
      });
    expect(response.status).toBe(415);
    expect(documents.upload).not.toHaveBeenCalled();
  });

  it("starts processing asynchronously and exposes status", async () => {
    const app = createApp(database, patient, voice, interview, documents);
    expect(
      (
        await request(app)
          .post(`/api/v1/documents/${id}/process`)
          .set("x-session-token", token)
      ).status,
    ).toBe(202);
    const status = await request(app)
      .get(`/api/v1/documents/${id}/status`)
      .set("x-session-token", token);
    expect(status.body.data.status).toBe("REVIEW_REQUIRED");
    expect(documents.status).toHaveBeenCalledWith(id, token);
    expect(documents.get).not.toHaveBeenCalled();
  });

  it("supports confirm, correction, rejection, private content and soft removal", async () => {
    const app = createApp(database, patient, voice, interview, documents);
    for (const action of ["confirm", "edit", "reject"] as const) {
      const response = await request(app)
        .post(`/api/v1/documents/${id}/facts/fact-12345678/${action}`)
        .set("x-session-token", token)
        .send(action === "edit" ? { value: "corrected" } : {});
      expect(response.status).toBe(200);
    }
    const content = await request(app)
      .get(`/api/v1/documents/${id}/content`)
      .set("x-session-token", token);
    expect(content.headers["cache-control"]).toBe("private, no-store");
    expect(
      (
        await request(app)
          .delete(`/api/v1/documents/${id}`)
          .set("x-session-token", token)
      ).status,
    ).toBe(204);
  });
});
