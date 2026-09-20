import { describe, expect, it, vi } from "vitest";
import type { TimelineRepository } from "../src/repositories/timeline-repository.js";
import { TimelineRebuildService } from "../src/timeline/timeline-rebuild-service.js";

describe("timeline rebuildability", () => {
  it("reconstructs grouped document and fact events from source records", async () => {
    const upsertProjected = vi.fn().mockResolvedValue(undefined);
    const rejectMissing = vi.fn().mockResolvedValue({ count: 0 });
    const repository = {
      sourceSnapshot: vi.fn().mockResolvedValue({
        id: "patient-123",
        visits: [],
        medications: [],
        allergies: [],
        observations: [],
        documents: [
          {
            id: "document-123",
            patientId: "patient-123",
            visitId: null,
            documentType: "LAB_REPORT",
            summary: "Synthetic lab report",
            documentDate: new Date("2026-05-10T00:00:00Z"),
            uploadedAt: new Date("2026-09-09T00:00:00Z"),
            facts: [
              {
                id: "fact-123",
                patientId: "patient-123",
                visitId: null,
                documentId: "document-123",
                factType: "lab_result",
                originalValue: "Hemoglobin 10.4 g/dL",
                normalizedValue: {
                  testName: "Hemoglobin",
                  result: 10.4,
                  unit: "g/dL",
                },
                confidence: 0.98,
                status: "CONFIRMED",
                createdAt: new Date("2026-09-09T00:00:00Z"),
                evidence: [
                  {
                    pageNumber: 1,
                    sourceText: "Hemoglobin 10.4 g/dL",
                  },
                ],
              },
            ],
          },
        ],
      }),
      upsertProjected,
      rejectMissing,
    } as unknown as TimelineRepository;

    const result = await new TimelineRebuildService(repository).rebuild(
      "patient-123",
    );
    expect(result.projectedEventCount).toBe(2);
    const projected = upsertProjected.mock.calls[0]?.[0] as Array<{
      eventType: string;
      groupKey: string;
      eventDate: Date;
    }>;
    expect(projected.map((event) => event.eventType)).toEqual([
      "MEDICAL_DOCUMENT",
      "LAB_RESULT",
    ]);
    expect(
      projected.every((event) => event.groupKey === "document:document-123"),
    ).toBe(true);
    expect(projected[1]?.eventDate.toISOString()).toContain("2026-05-10");
    expect(rejectMissing).toHaveBeenCalledWith(
      "patient-123",
      expect.arrayContaining([expect.any(String)]),
    );
  });
});
