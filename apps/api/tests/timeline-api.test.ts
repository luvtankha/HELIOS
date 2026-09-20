import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { errorHandler } from "../src/middleware/error-handler.js";
import { requestContext } from "../src/middleware/request-context.js";
import { createTimelineRouter } from "../src/routes/timeline.js";
import type { TimelineOperations } from "../src/timeline/timeline-service.js";

function appWith(service: TimelineOperations) {
  const app = express();
  app.use(express.json());
  app.use(requestContext);
  app.use("/api/v1", createTimelineRouter(service));
  app.use(errorHandler);
  return app;
}

describe("timeline API", () => {
  it("parses bounded server-side filters and pagination", async () => {
    const list = vi.fn().mockResolvedValue({ groups: [], nextCursor: "next" });
    const service = {
      list,
      detail: vi.fn(),
      rebuild: vi.fn(),
      projectDocument: vi.fn(),
      removeDocument: vi.fn(),
    } satisfies TimelineOperations;
    const response = await request(appWith(service))
      .get(
        "/api/v1/patients/patient-123/timeline?eventType=LAB_RESULT&sourceType=DOCUMENT_EXTRACTED&limit=10&sort=asc",
      )
      .set("x-session-token", "session.proof");
    expect(response.status).toBe(200);
    expect(response.body.data.nextCursor).toBe("next");
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: "patient-123",
        eventType: "LAB_RESULT",
        source: "DOCUMENT_EXTRACTED",
        limit: 10,
        sort: "asc",
      }),
      "session.proof",
      expect.stringMatching(/^req_/),
    );
  });

  it("rejects an invalid range before reaching the service", async () => {
    const service = {
      list: vi.fn(),
      detail: vi.fn(),
      rebuild: vi.fn(),
      projectDocument: vi.fn(),
      removeDocument: vi.fn(),
    } satisfies TimelineOperations;
    const response = await request(appWith(service)).get(
      "/api/v1/patients/patient-123/timeline?from=2026-09-09T00:00:00Z&to=2026-01-01T00:00:00Z",
    );
    expect(response.status).toBe(400);
    expect(service.list).not.toHaveBeenCalled();
  });
});
