import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "dataset", "documents", "phase6-fixtures");
await mkdir(output, { recursive: true });

const fixtures = [
  await pdf("demo-previous-lab-report.pdf", [
    [
      "SYNTHETIC LAB REPORT",
      "Patient: Aarav Sharma",
      "Date: 2026-05-10",
      "Hemoglobin 10.4 g/dL 12-16 LOW",
    ],
  ]),
  await pdf("demo-current-lab-report.pdf", [
    [
      "SYNTHETIC LAB REPORT",
      "Patient: Aarav Sharma",
      "Date: 2026-09-01",
      "Hemoglobin 8.9 g/dL 12-16 LOW",
    ],
  ]),
  await pdf("demo-allergy-note.pdf", [
    [
      "SYNTHETIC CONSULTATION NOTE",
      "Patient: Aarav Sharma",
      "Date: 2024-02-12",
      "Allergy: Penicillin",
      "For demonstration only",
    ],
  ]),
  await pdf("prescription.pdf", [
    [
      "SYNTHETIC PRESCRIPTION",
      "Patient: Aarav Sharma",
      "Date: 2026-09-01",
      "Tab Metformin 500 mg, take one tablet twice daily after food",
      "Doctor: Dr Synthetic",
      "Facility: HELIOS Demo Clinic",
    ],
  ]),
  await image("lab-report.png", [
    "SYNTHETIC LAB REPORT",
    "Patient: Aarav Sharma",
    "Date: 2026-09-01",
    "Hemoglobin 9.2 g/dL 12-16 LOW",
  ]),
  await pdf("discharge-summary.pdf", [
    [
      "SYNTHETIC DISCHARGE SUMMARY",
      "Patient: Aarav Sharma",
      "Admission date: 2026-08-20",
      "Discharge date: 2026-08-22",
      "Diagnosis: Synthetic documented condition",
    ],
    [
      "Medication: Metformin 500 mg twice daily",
      "Follow-up instructions: review with the documented clinician",
      "Doctor: Dr Synthetic",
      "Facility: HELIOS Demo Hospital",
    ],
  ]),
  await image(
    "low-quality-scan.jpg",
    [
      "SYNTHETIC LOW QUALITY SCAN",
      "Patient: Aarav Sharma",
      "Hemoglobin 10.4 g/dL 12-16",
    ],
    { format: "jpeg", blur: 1.1 },
  ),
  await image(
    "rotated-prescription.jpg",
    [
      "SYNTHETIC PRESCRIPTION",
      "Patient: Aarav Sharma",
      "Tab Metformin 500 mg twice daily",
    ],
    { format: "jpeg", rotate: 90 },
  ),
  await image(
    "handwritten-like-note.png",
    [
      "SYNTHETIC HANDWRITTEN-LIKE NOTE",
      "Patient: Aarav Sharma",
      "Consultation note: abdominal pain",
    ],
    { italic: true },
  ),
  await image(
    "ambiguous-ocr.png",
    [
      "SYNTHETIC AMBIGUOUS OCR",
      "Patient: Aarav Sharma",
      "Tab Metfornin 5OO mg",
    ],
    { blur: 0.8 },
  ),
  await pdf("missing-date.pdf", [
    [
      "SYNTHETIC LAB REPORT",
      "Patient: Aarav Sharma",
      "Hemoglobin 9.2 g/dL 12-16",
    ],
  ]),
  await pdf("multiple-medications.pdf", [
    [
      "SYNTHETIC PRESCRIPTION",
      "Patient: Aarav Sharma",
      "Date: 2026-09-01",
      "Metformin 500 mg twice daily",
      "Amlodipine 5 mg once daily",
    ],
  ]),
  await pdf("multiple-lab-values.pdf", [
    [
      "SYNTHETIC LAB REPORT",
      "Patient: Aarav Sharma",
      "Date: 2026-09-01",
      "Hemoglobin 9.2 g/dL 12-16 LOW",
      "Hemoglobin 10.4 g/dL 12-16 LOW",
    ],
  ]),
];
await copyFile(
  join(output, "prescription.pdf"),
  join(output, "duplicate-upload.pdf"),
);

await writeFile(
  join(output, "manifest.json"),
  `${JSON.stringify(
    {
      synthetic: true,
      generatedAt: "2026-09-09T00:00:00.000Z",
      disclaimer:
        "Synthetic test documents only; no clinical validation or real patient data.",
      fixtures: [
        ...fixtures,
        {
          fileName: "duplicate-upload.pdf",
          difficulty: "duplicate",
          duplicateOf: "prescription.pdf",
        },
      ],
    },
    null,
    2,
  )}\n`,
);

console.log(
  JSON.stringify({ syntheticDocuments: fixtures.length + 1, output }),
);

async function pdf(fileName, pages) {
  const document = await PDFDocument.create();
  const fixtureDate = new Date("2026-01-01T00:00:00.000Z");
  document.setCreationDate(fixtureDate);
  document.setModificationDate(fixtureDate);
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (const lines of pages) {
    const page = document.addPage([595, 842]);
    lines.forEach((line, index) =>
      page.drawText(line, {
        x: 55,
        y: 780 - index * 42,
        size: index === 0 ? 18 : 12,
        font,
        color: rgb(0.05, 0.15, 0.28),
      }),
    );
  }
  await writeFile(join(output, fileName), await document.save());
  return {
    fileName,
    difficulty: pages.length > 1 ? "multi-page" : "clean-digital",
    pages: pages.length,
  };
}

async function image(fileName, lines, options = {}) {
  const style = options.italic
    ? "font-style:italic;font-family:cursive"
    : "font-family:Arial";
  const svg =
    Buffer.from(`<svg width="1200" height="1600" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#fff"/>
    ${lines.map((line, index) => `<text x="80" y="${140 + index * 90}" font-size="${index === 0 ? 38 : 30}" fill="#172a3f" style="${style}">${escapeXml(line)}</text>`).join("")}
  </svg>`);
  let pipeline = sharp(svg);
  if (options.rotate) pipeline = pipeline.rotate(options.rotate);
  if (options.blur) pipeline = pipeline.blur(options.blur);
  const format = options.format ?? "png";
  const buffer =
    format === "jpeg"
      ? await pipeline.jpeg({ quality: 60 }).toBuffer()
      : await pipeline.png().toBuffer();
  await writeFile(join(output, fileName), buffer);
  return {
    fileName,
    difficulty: options.rotate
      ? "rotated"
      : options.italic
        ? "handwritten-like"
        : options.blur
          ? "degraded"
          : "clean-image",
    pages: 1,
  };
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
