import type { TimelineGroupDto } from "@helios/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TimelineCard } from "@/components/timeline/timeline-card";
import {
  defaultTimelineFilters,
  TimelineFilters,
} from "@/components/timeline/timeline-filters";

const group: TimelineGroupDto = {
  key: "document:lab",
  label: "Lab report",
  eventDate: "2026-05-10T00:00:00.000Z",
  datePrecision: "EXACT_DATE",
  events: [
    {
      id: "event-lab",
      eventType: "LAB_RESULT",
      title: "Hemoglobin",
      description: "10.4 g/dL",
      eventDate: "2026-05-10T00:00:00.000Z",
      recordedAt: "2026-09-09T00:00:00.000Z",
      datePrecision: "EXACT_DATE",
      temporalState: "HISTORICAL",
      source: "DOCUMENT_EXTRACTED",
      sourceLabel: "Document",
      sourceType: "DOCUMENT_FACT",
      sourceId: "fact-lab",
      documentId: "document-lab",
      verificationStatus: "DOCUMENT_EXTRACTED",
      confidenceBand: "HIGH",
      groupKey: "document:lab",
      hasConflict: false,
      evidence: { documentId: "document-lab", pageNumber: 1 },
    },
  ],
};

describe("patient timeline components", () => {
  it("shows event date, source, status and evidence action without interpretation", () => {
    const onDetails = vi.fn();
    render(<TimelineCard group={group} onDetails={onDetails} />);
    expect(screen.getByText(/10 May 2026/i)).toBeInTheDocument();
    expect(screen.getByText("Source: Document")).toBeInTheDocument();
    expect(screen.getByText("From document")).toBeInTheDocument();
    expect(screen.queryByText(/worsened|diagnosis/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View source" }));
    expect(onDetails).toHaveBeenCalledWith(group.events[0]);
  });

  it("offers patient-friendly server filter controls", () => {
    const onChange = vi.fn();
    render(
      <TimelineFilters value={defaultTimelineFilters} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Lab results" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ category: "LAB_RESULT" }),
    );
    expect(screen.getByLabelText("Time range")).toBeInTheDocument();
    expect(screen.getByLabelText("Source")).toBeInTheDocument();
  });
});
