import { act, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { MedicalDocumentDto } from "@helios/shared";
import { DocumentPreview } from "./document-preview";

afterEach(() => vi.unstubAllGlobals());

it("releases a private preview URL even if loading finishes after navigation", async () => {
  const revokeObjectURL = vi.fn();
  const originalUrl = URL;
  vi.stubGlobal(
    "URL",
    class extends originalUrl {
      static override revokeObjectURL = revokeObjectURL;
    },
  );
  let finish!: (value: string) => void;
  const pending = new Promise<string>((resolve) => {
    finish = resolve;
  });
  const document = {
    id: "synthetic-document",
    mimeType: "application/pdf",
    pages: [],
  } as unknown as MedicalDocumentDto;
  const view = render(
    <DocumentPreview
      document={document}
      token="synthetic-proof"
      contentLoader={() => pending}
    />,
  );
  view.unmount();
  await act(async () => {
    finish("blob:synthetic-preview");
    await pending;
  });
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:synthetic-preview");
});
