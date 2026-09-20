import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { errorHandler } from "../../src/middleware/error-handler.js";
import { requestContext } from "../../src/middleware/request-context.js";
import { createVerificationRouter } from "../../src/routes/verification.js";
import type { VerificationOperations } from "../../src/verification/verification-service.js";

function operations(): VerificationOperations {
  return {
    queue: vi.fn(async () => ({
      items: [],
      metrics: {
        needsReview: 0,
        conflicts: 0,
        verifiedToday: 0,
        correctedToday: 0,
        rejectedToday: 0,
      },
    })),
    detail: vi.fn(async () => ({
      reviewId: "review",
      patientId: "patient",
      patientName: "Synthetic",
      patientCode: "SYNTHETIC",
      factType: "MEDICATION",
      factId: "fact",
      label: "Metformin",
      value: { dose: "1000 mg" },
      sourceType: "PATIENT_REPORTED",
      verificationStatus: "PATIENT_REPORTED",
      version: 0,
      workflowPriority: 2,
      conflict: true,
      bulkEligible: false,
      evidenceAvailable: true,
      evidence: [],
      history: [],
      safetySignalCount: 0,
    })),
    act: vi.fn(async () => ({
      verification: {
        id: "verification",
        action: "CONFIRM_CURRENT",
        previousStatus: "PATIENT_REPORTED",
        newStatus: "DOCTOR_VERIFIED",
        originalValue: {},
        verifiedValue: {},
        doctorName: "Dr Meera",
        verifiedAt: new Date().toISOString(),
        factVersion: 1,
      },
      review: {} as never,
      dependentRefreshPending: false,
      message: "Verification saved.",
    })),
    history: vi.fn(async () => []),
    bulkVerify: vi.fn(async () => []),
    document: vi.fn(async () => ({}) as never),
    documentContent: vi.fn(async () => ({
      buffer: Buffer.from("demo"),
      mimeType: "text/plain",
      fileName: "demo.txt",
    })),
  };
}

function app(service: VerificationOperations) {
  const value = express();
  value.use(express.json());
  value.use(requestContext);
  value.use("/api/v1", createVerificationRouter(service));
  value.use(errorHandler);
  return value;
}

describe("verification API", () => {
  it("routes global and patient-bound queues with doctor proof", async () => {
    const service = operations();
    const instance = app(service);
    expect(
      (
        await request(instance)
          .get("/api/v1/verification-queue")
          .set("x-doctor-token", "signed")
      ).status,
    ).toBe(200);
    expect(
      (
        await request(instance)
          .get("/api/v1/patients/patient/verification-queue?conflictsOnly=true")
          .set("x-doctor-token", "signed")
      ).status,
    ).toBe(200);
    expect(service.queue).toHaveBeenCalledWith(
      "patient",
      expect.objectContaining({ conflictsOnly: true }),
      "signed",
    );
  });

  it("forwards an explicit conflict decision without accepting doctorId", async () => {
    const service = operations();
    const response = await request(app(service))
      .post("/api/v1/verification/review/confirm-current")
      .set("x-doctor-token", "signed")
      .send({
        expectedVersion: 0,
        idempotencyKey: "00000000-0000-4000-8000-000000000001",
        reason: "Patient confirms current prescription.",
      });
    expect(response.status).toBe(201);
    expect(service.act).toHaveBeenCalledWith(
      "review",
      "CONFIRM_CURRENT",
      expect.not.objectContaining({ doctorId: expect.anything() }),
      "signed",
      expect.any(String),
    );
  });

  it("rejects tampered and incomplete action payloads before service execution", async () => {
    const service = operations();
    const response = await request(app(service))
      .post("/api/v1/verification/review/verify")
      .send({ expectedVersion: 0, doctorId: "forged" });
    expect(response.status).toBe(400);
    expect(service.act).not.toHaveBeenCalled();
  });

  it("supports history, safe bulk review, and doctor document evidence", async () => {
    const service = operations();
    const instance = app(service);
    expect(
      (
        await request(instance).get(
          "/api/v1/patients/patient/verification-history",
        )
      ).status,
    ).toBe(200);
    expect(
      (await request(instance).get("/api/v1/verification/documents/document"))
        .status,
    ).toBe(200);
    expect(
      (
        await request(instance).get(
          "/api/v1/verification/documents/document/content",
        )
      ).text,
    ).toBe("demo");
    expect(
      (
        await request(instance)
          .post("/api/v1/verification/bulk-verify")
          .send({
            reviewIds: ["review"],
            expectedVersions: { review: 0 },
            idempotencyKey: "00000000-0000-4000-8000-000000000002",
          })
      ).status,
    ).toBe(201);
  });
});
