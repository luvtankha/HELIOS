import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

describe("patient-only API", () => {
  const app = createApp();

  it.each([
    ["post", "/doctor-sessions"],
    ["get", "/doctor/dashboard"],
    ["get", "/doctor/patients"],
    ["get", "/doctor/patients/patient-1/workspace"],
    ["get", "/doctor/patients/patient-1/notes"],
    ["post", "/doctor/patients/patient-1/notes"],
    ["patch", "/doctor/patients/patient-1/notes/note-1"],
    ["post", "/doctor/visits/visit-1/status"],
    ["get", "/doctor/queue"],
    ["post", "/doctor/queue/call-next"],
    ["post", "/doctor/queue/pause"],
    ["post", "/doctor/queue/resume"],
    ["post", "/doctor/tokens/token-1/start"],
    ["put", "/doctor/language"],
    ["get", "/doctor/patients/patient-1/ayush"],
    ["post", "/doctor/patients/patient-1/ayush"],
    ["get", "/doctor/ayush/record-1"],
    ["get", "/doctor/visits/visit-1/routing"],
    ["post", "/patients/patient-1/comparisons"],
    ["post", "/patients/patient-1/comparisons/quick"],
    ["get", "/patients/patient-1/comparisons"],
    ["get", "/comparisons/comparison-1"],
    ["get", "/comparisons/comparison-1/changes"],
    ["get", "/comparisons/comparison-1/changes/change-1"],
    ["post", "/patients/patient-1/briefs"],
    ["get", "/patients/patient-1/briefs"],
    ["get", "/patients/patient-1/clinical-brief"],
    ["get", "/briefs/brief-1"],
    ["get", "/briefs/brief-1/evidence"],
    ["get", "/briefs/brief-1/claims/claim-1"],
    ["post", "/briefs/brief-1/refresh"],
    ["post", "/briefs/brief-1/review"],
    ["post", "/briefs/brief-1/archive"],
    ["get", "/verification-queue"],
    ["get", "/patients/patient-1/verification-queue"],
    ["get", "/patients/patient-1/verification-history"],
    ["post", "/verification/bulk-verify"],
    ["get", "/verification/documents/document-1/content"],
    ["get", "/verification/documents/document-1"],
    ["get", "/verification/verification-1"],
    ["post", "/verification/verification-1/verify"],
    ["post", "/verification/verification-1/correct"],
    ["post", "/verification/verification-1/reject"],
    ["post", "/verification/verification-1/uncertain"],
    ["post", "/verification/verification-1/confirm-current"],
    ["post", "/verification/verification-1/keep-previous"],
    ["post", "/demo/reset"],
  ] as const)("does not expose removed %s %s", async (method, path) => {
    const response = await request(app)
      [method](`/api/v1${path}`)
      .set("x-doctor-token", "removed-credential")
      .send(method === "get" ? undefined : {});
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });
});
