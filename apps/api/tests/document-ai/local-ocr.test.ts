import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LocalOCRProvider } from "../../src/document-ai/providers.js";

const fixture = fileURLToPath(
  new URL(
    "../../../../dataset/documents/phase6-fixtures/discharge-summary.pdf",
    import.meta.url,
  ),
);

describe("local PDF OCR provider", () => {
  it("preserves pages and embedded text from a multi-page PDF", async () => {
    const pages = await new LocalOCRProvider().recognize({
      buffer: await readFile(fixture),
      mimeType: "application/pdf",
      fileName: "discharge-summary.pdf",
    });
    expect(pages).toHaveLength(2);
    expect(pages[0]?.text).toContain("DISCHARGE SUMMARY");
    expect(pages[1]?.text).toContain("Metformin 500 mg");
    expect(pages.every((page) => page.blocks.length > 0)).toBe(true);
  }, 15_000);
});
