import { readFile } from "node:fs/promises";

import { LocalOCRProvider } from "../src/document-ai/providers.js";

const fixtureUrl = new URL(
  "../../../dataset/documents/phase6-fixtures/lab-report.png",
  import.meta.url,
);
const buffer = await readFile(fixtureUrl);
const pages = await new LocalOCRProvider().recognize({
  buffer,
  mimeType: "image/png",
  fileName: "lab-report.png",
});
const text = pages[0]?.text ?? "";

console.log(
  JSON.stringify({
    pages: pages.length,
    confidence: pages[0]?.confidence,
    hasLabReport: text.toLowerCase().includes("lab report"),
    hasHemoglobin: text.toLowerCase().includes("hemoglobin"),
    text: text.slice(0, 240),
  }),
);
