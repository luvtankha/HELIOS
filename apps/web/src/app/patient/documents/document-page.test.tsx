import type { MedicalDocumentDto } from "@helios/shared";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DocumentsPage from "./page";

const push = vi.fn();
const documentApi = vi.hoisted(() => ({
  upload: vi.fn(),
  get: vi.fn(),
  status: vi.fn(),
  list: vi.fn(),
  process: vi.fn(),
  factAction: vi.fn(),
  overrideIdentity: vi.fn(),
  remove: vi.fn(),
  content: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));

vi.mock("@/hooks/use-session-guard", () => ({
  useSessionGuard: () => ({
    state: {
      hydrated: true,
      sessionId: "session-12345678",
      sessionToken: "token",
      patientId: "patient-12345678",
      visitId: "visit-12345678",
    },
  }),
}));

vi.mock("@/services/documents", () => ({ documentApi }));

const processingDocument: MedicalDocumentDto = {
  id: "document-12345678",
  patientId: "patient-12345678",
  visitId: "visit-12345678",
  fileName: "report.png",
  mimeType: "image/png",
  fileSize: 8,
  documentType: "LAB_REPORT",
  processingStatus: "OCR_PROCESSING",
  progress: 40,
  identityStatus: "PENDING",
  pageCount: 0,
  pages: [],
  facts: [],
  uploadedAt: new Date(0).toISOString(),
};

describe("patient document flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:document-preview"),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("presents camera, upload, and optional skip actions", () => {
    render(<DocumentsPage />);
    expect(
      screen.getByRole("heading", { name: "Add a previous medical document" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Take a photo/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Upload a PDF or file/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    expect(push).toHaveBeenCalledWith("/patient/review");
  });

  it("does not expose provider or OCR terminology to the patient", () => {
    render(<DocumentsPage />);
    expect(screen.queryByText(/OCR|model|API/i)).not.toBeInTheDocument();
  });

  it("polls lightweight status and fetches the full document only after processing finishes", async () => {
    vi.useFakeTimers();
    documentApi.upload.mockResolvedValue({
      ...processingDocument,
      processingStatus: "UPLOADED",
      progress: 10,
    });
    documentApi.process.mockResolvedValue(processingDocument);
    documentApi.status.mockResolvedValue({
      id: processingDocument.id,
      status: "REVIEW_REQUIRED",
      progress: 100,
    });
    documentApi.get.mockResolvedValue({
      ...processingDocument,
      processingStatus: "REVIEW_REQUIRED",
      progress: 100,
    });

    const { container } = render(<DocumentsPage />);
    const inputs = container.querySelectorAll<HTMLInputElement>(
      'input[type="file"]',
    );
    fireEvent.change(inputs[2]!, {
      target: {
        files: [new File(["document"], "report.png", { type: "image/png" })],
      },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm and upload" }),
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(documentApi.process).toHaveBeenCalledWith(
      processingDocument.id,
      "token",
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(documentApi.status).toHaveBeenCalledWith(
      processingDocument.id,
      "token",
    );
    expect(documentApi.get).toHaveBeenCalledTimes(1);
    expect(documentApi.get).toHaveBeenCalledWith(processingDocument.id, "token");
  });
});
