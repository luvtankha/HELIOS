import type { DocumentType } from "@helios/shared";
import sharp from "sharp";
import { createWorker } from "tesseract.js";
import { AppError } from "../utils/app-error.js";
import type {
  DocumentClassification,
  DocumentClassifier,
  DocumentUnderstandingProvider,
  DocumentUnderstandingResult,
  ExtractedDocumentFact,
  MedicalEntityExtractor,
  OCRProvider,
  OcrBlock,
  OcrInput,
  OcrPage,
} from "./types.js";

export class HeuristicDocumentClassifier implements DocumentClassifier {
  classify(pages: OcrPage[]): DocumentClassification {
    const text = pages
      .map((page) => page.text)
      .join("\n")
      .toLowerCase();
    const candidates: Array<[DocumentType, RegExp[]]> = [
      [
        "PRESCRIPTION",
        [/\bprescription\b/, /\brx\b/, /twice daily|once daily|tablet/],
      ],
      [
        "LAB_REPORT",
        [/lab(?:oratory)? report/, /reference range/, /ha?emoglobin|\bhb\b/],
      ],
      [
        "DISCHARGE_SUMMARY",
        [/discharge summary/, /admission date/, /discharge date/],
      ],
      [
        "CONSULTATION_NOTE",
        [/consultation note/, /chief complaint/, /assessment|investigations/],
      ],
    ];
    const scored = candidates
      .map(([type, patterns]) => ({
        type,
        score: patterns.filter((pattern) => pattern.test(text)).length,
        reasons: patterns.filter((pattern) => pattern.test(text)).map(String),
      }))
      .sort((left, right) => right.score - left.score);
    const best = scored[0];
    if (!best || best.score === 0)
      return { type: "UNKNOWN", confidence: 0, reasons: [] };
    const tied = scored.filter((candidate) => candidate.score === best.score);
    if (tied.length > 1 && best.score === 1)
      return {
        type: "UNKNOWN",
        confidence: 0.4,
        reasons: ["ambiguous keywords"],
      };
    return {
      type: best.type,
      confidence: Math.min(0.98, 0.55 + best.score * 0.14),
      reasons: best.reasons,
    };
  }
}

export class MockOCRProvider implements OCRProvider {
  readonly name = "mock-document-ocr";
  readonly model = "deterministic-v1";

  recognize(input: OcrInput): Promise<OcrPage[]> {
    const name = input.fileName.toLowerCase();
    const text = name.includes("lab")
      ? "LAB REPORT\nPatient: Aarav Sharma\nDate: 2026-09-01\nHemoglobin 9.2 g/dL 12-16"
      : name.includes("discharge")
        ? "DISCHARGE SUMMARY\nPatient: Aarav Sharma\nAdmission date: 2026-08-20\nDischarge date: 2026-08-22\nDiagnosis: Synthetic documented condition\nMedication: Metformin 500 mg twice daily\nDoctor: Dr Synthetic\nFacility: HELIOS Demo Hospital"
        : name.includes("consultation")
          ? "CONSULTATION NOTE\nPatient: Aarav Sharma\nDate: 2026-09-01\nChief complaint: abdominal pain\nAssessment: documented gastritis\nInvestigations: Hemoglobin 10.4 g/dL"
          : name.includes("ayush")
            ? "PRESCRIPTION\nPatient: Aarav Sharma\nDate: 2026-09-01\nAyurvedic medicine: Patient-documented formulation\nPractitioner: Dr Synthetic AYUSH\nFacility: HELIOS Demo Clinic"
            : "PRESCRIPTION\nPatient: Aarav Sharma\nDate: 2026-09-01\nTab Metformin 500 mg, take one tablet twice daily after food\nDoctor: Dr Synthetic\nFacility: HELIOS Demo Clinic";
    return Promise.resolve([
      {
        pageNumber: 1,
        text,
        blocks: text.split("\n").map((line, index) => ({
          text: line,
          confidence: 0.98,
          boundingBox: { x: 40, y: 40 + index * 32, width: 520, height: 24 },
        })),
        width: 800,
        height: 1100,
        confidence: 0.98,
      },
    ]);
  }
}

export class LocalOCRProvider implements OCRProvider {
  readonly name = "local-document-ocr";
  readonly model = "pdfjs+tesseract-v1";

  async recognize(input: OcrInput): Promise<OcrPage[]> {
    return input.mimeType === "application/pdf"
      ? this.readPdf(input.buffer)
      : this.readImage(input.buffer);
  }

  private async readPdf(buffer: Buffer): Promise<OcrPage[]> {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const document = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
    }).promise;
    const pages: OcrPage[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const blocks: OcrBlock[] = content.items.flatMap((item) => {
        if (!("str" in item) || !item.str.trim()) return [];
        const transformValue: unknown = (item as { transform?: unknown })
          .transform;
        const transform = Array.isArray(transformValue) ? transformValue : [];
        return [
          {
            text: item.str,
            confidence: 1,
            boundingBox: {
              x: typeof transform[4] === "number" ? transform[4] : 0,
              y:
                viewport.height -
                (typeof transform[5] === "number" ? transform[5] : 0),
              width: item.width,
              height: item.height,
            },
          },
        ];
      });
      pages.push({
        pageNumber,
        text: blocks.map((block) => block.text).join("\n"),
        blocks,
        width: Math.round(viewport.width),
        height: Math.round(viewport.height),
        confidence: blocks.length ? 1 : 0,
      });
    }
    if (pages.every((page) => !page.text.trim()))
      throw new AppError(
        "This scanned PDF needs image OCR and could not be read locally",
        422,
        "SCANNED_PDF_OCR_UNAVAILABLE",
      );
    return pages;
  }

  private async readImage(buffer: Buffer): Promise<OcrPage[]> {
    const image = sharp(buffer, { failOn: "error" }).rotate();
    const metadata = await image.metadata();
    const processed = await image
      .resize({ width: 2000, withoutEnlargement: true })
      .normalise()
      .sharpen()
      .png()
      .toBuffer();
    const worker = await createWorker("eng");
    try {
      const result = await worker.recognize(processed);
      return [
        {
          pageNumber: 1,
          text: result.data.text.trim(),
          blocks: result.data.text
            .split(/\r?\n/)
            .filter(Boolean)
            .map((text) => ({
              text,
              confidence: result.data.confidence / 100,
            })),
          width: metadata.width,
          height: metadata.height,
          confidence: result.data.confidence / 100,
          processedImage: processed,
        },
      ];
    } finally {
      await worker.terminate();
    }
  }
}

export class RuleBasedMedicalEntityExtractor implements MedicalEntityExtractor {
  extract(pages: OcrPage[], type: DocumentType): ExtractedDocumentFact[] {
    const facts: ExtractedDocumentFact[] = [];
    for (const page of pages) {
      const lines = page.text.split(/\r?\n|(?<=\.)\s+/).filter(Boolean);
      for (const line of lines) {
        this.extractCommon(line, page, facts);
        this.extractMedication(line, page, facts);
        this.extractLab(line, page, facts);
        this.extractAyush(line, page, facts);
        this.extractLocalizedInstruction(line, page, facts);
      }
    }
    return deduplicate(facts).filter((fact) =>
      type === "UNKNOWN"
        ? [
            "patient_name",
            "document_date",
            "ayush_treatment",
            "medication_instruction",
          ].includes(fact.factType)
        : true,
    );
  }

  private extractCommon(
    line: string,
    page: OcrPage,
    facts: ExtractedDocumentFact[],
  ) {
    for (const [factType, pattern] of [
      ["patient_name", /patient\s*:\s*([^\n]+)/i],
      ["document_date", /^\s*date\s*:\s*(\d{4}-\d{2}-\d{2})/i],
      ["admission_date", /admission date\s*:\s*(\d{4}-\d{2}-\d{2})/i],
      ["discharge_date", /discharge date\s*:\s*(\d{4}-\d{2}-\d{2})/i],
      ["documented_diagnosis", /(?:diagnosis|assessment)\s*:\s*([^\n]+)/i],
      ["doctor", /doctor\s*:\s*([^\n]+)/i],
      ["facility", /facility\s*:\s*([^\n]+)/i],
      ["chief_complaint", /chief complaint\s*:\s*([^\n]+)/i],
      ["patient_identifier", /patient (?:id|identifier)\s*:\s*([^\n]+)/i],
      ["procedure", /procedure\s*:\s*([^\n]+)/i],
      ["examination_finding", /examination finding\s*:\s*([^\n]+)/i],
      ["follow_up_instructions", /follow[- ]?up instructions\s*:\s*([^\n]+)/i],
      ["plan", /plan\s*:\s*([^\n]+)/i],
    ] as const) {
      const match = line.match(pattern);
      if (match?.[1]) {
        const value = match[1].trim();
        facts.push(
          this.fact(
            factType,
            value,
            line,
            page,
            Math.min(0.96, page.confidence ?? 0.96),
            factType.endsWith("_date") ? value : undefined,
          ),
        );
      }
    }
    const allergy = line.match(/allerg(?:y|ies)\s*:\s*([^\n]+)/i)?.[1]?.trim();
    if (allergy)
      facts.push(
        this.fact(
          "allergy",
          allergy,
          line,
          page,
          Math.min(0.96, page.confidence ?? 0.96),
          { allergen: allergy },
        ),
      );
  }

  private extractMedication(
    line: string,
    page: OcrPage,
    facts: ExtractedDocumentFact[],
  ) {
    const match = line.match(
      /(?:\btab(?:let)?\.?\s+|medication\s*:\s*)?([A-Z][a-zA-Z]+)\s+(\d+(?:\.\d+)?)\s*(mg|mcg|g(?!\/)|mL)\b/i,
    );
    if (!match?.[1] || !match[2] || !match[3]) return;
    const frequency = line.match(
      /(once daily|twice daily|three times daily)/i,
    )?.[1];
    const timing = line.match(/(after food|before food)/i)?.[1];
    facts.push(
      this.fact(
        "medication",
        line.trim(),
        line,
        page,
        page.confidence && page.confidence < 0.8 ? page.confidence : 0.94,
        {
          name: titleCase(match[1]),
          dose: Number(match[2]),
          unit: match[3],
          ...(frequency && { frequency: frequency.toLowerCase() }),
          ...(timing && { timing: timing.toLowerCase() }),
          route: "UNKNOWN",
          historyStatus: "HISTORICAL",
        },
      ),
    );
  }

  private extractLocalizedInstruction(
    line: string,
    page: OcrPage,
    facts: ExtractedDocumentFact[],
  ) {
    const frequency = /दिन\s*में\s*दो\s*बार/u.test(line)
      ? "twice daily"
      : /दिन\s*में\s*एक\s*बार/u.test(line)
        ? "once daily"
        : undefined;
    if (!frequency) return;
    facts.push(
      this.fact(
        "medication_instruction",
        line.trim(),
        line,
        page,
        Math.min(0.94, page.confidence ?? 0.94),
        { frequency },
      ),
    );
  }

  private extractLab(
    line: string,
    page: OcrPage,
    facts: ExtractedDocumentFact[],
  ) {
    const match = line.match(
      /\b(ha?emoglobin|hb)\s+(\d+(?:\.\d+)?)\s*(g\/dL)(?:\s+([\d.]+\s*[-–]\s*[\d.]+))?(?:\s+(LOW|HIGH))?/i,
    );
    if (!match?.[1] || !match[2] || !match[3]) return;
    facts.push(
      this.fact(
        "lab_result",
        line.trim(),
        line,
        page,
        Math.min(0.96, page.confidence ?? 0.96),
        {
          testName: "Hemoglobin",
          result: Number(match[2]),
          unit: match[3],
          ...(match[4] && { referenceRange: match[4].replace("-", "–") }),
          ...(match[5] && { abnormalFlag: match[5].toUpperCase() }),
        },
      ),
    );
  }

  private extractAyush(
    line: string,
    page: OcrPage,
    facts: ExtractedDocumentFact[],
  ) {
    const systemMatch = line.match(
      /\b(ayurvedic|ayurveda|yoga|naturopath(?:y|ic)?|unani|siddha|homoeopath(?:y|ic)?|homeopath(?:y|ic)?)\b/i,
    );
    if (!systemMatch?.[1]) return;
    const system = ayushSystem(systemMatch[1]);
    const documented = line
      .match(/(?:medicine|medication|treatment|therapy)\s*:\s*(.+)$/i)?.[1]
      ?.trim();
    const originalName = documented || "NOT_SPECIFIED";
    facts.push(
      this.fact(
        "ayush_treatment",
        line.trim(),
        line,
        page,
        Math.min(0.9, page.confidence ?? 0.9),
        {
          system,
          originalName,
          ...(documented && { medicineName: documented }),
          useStatus: "HISTORICAL",
          ingredients: "NOT_DOCUMENTED",
        },
      ),
    );
  }

  private fact(
    factType: string,
    originalValue: unknown,
    sourceText: string,
    page: OcrPage,
    confidence: number,
    normalizedValue?: unknown,
  ): ExtractedDocumentFact {
    const block = page.blocks.find((candidate) =>
      candidate.text.toLowerCase().includes(sourceText.toLowerCase()),
    );
    return {
      factType,
      originalValue,
      ...(normalizedValue !== undefined && { normalizedValue }),
      confidence,
      pageNumber: page.pageNumber,
      sourceText,
      ...(block?.boundingBox && { boundingBox: block.boundingBox }),
    };
  }
}

export class RuleBasedDocumentUnderstandingProvider implements DocumentUnderstandingProvider {
  readonly name = "helios-rules";
  readonly model = "phase6-v1";

  constructor(
    private readonly extractor: MedicalEntityExtractor = new RuleBasedMedicalEntityExtractor(),
  ) {}

  understand(
    pages: OcrPage[],
    type: DocumentType,
  ): Promise<DocumentUnderstandingResult> {
    const facts = this.extractor.extract(pages, type);
    const date = facts.find(
      (fact) => fact.factType === "document_date",
    )?.normalizedValue;
    const patient = facts.find(
      (fact) => fact.factType === "patient_name",
    )?.originalValue;
    const count = facts.filter((fact) =>
      [
        "medication",
        "lab_result",
        "documented_diagnosis",
        "ayush_treatment",
      ].includes(fact.factType),
    ).length;
    return Promise.resolve({
      facts,
      ...(typeof date === "string" && { documentDate: date }),
      ...(typeof patient === "string" && { patientName: patient }),
      summary: `${humanType(type)} containing ${count} extracted clinical ${count === 1 ? "detail" : "details"}.`,
    });
  }
}

function ayushSystem(value: string) {
  const text = value.toLowerCase();
  if (text.startsWith("ayur")) return "AYURVEDA";
  if (text.startsWith("yoga") || text.startsWith("naturopath"))
    return "YOGA_NATUROPATHY";
  if (text.startsWith("unani")) return "UNANI";
  if (text.startsWith("siddha")) return "SIDDHA";
  if (text.includes("homeopath") || text.includes("homoeopath"))
    return "HOMOEOPATHY";
  return "UNKNOWN";
}

function deduplicate(facts: ExtractedDocumentFact[]) {
  const seen = new Set<string>();
  return facts.filter((fact) => {
    const key = `${fact.factType}:${JSON.stringify(fact.normalizedValue ?? fact.originalValue)}:${fact.pageNumber}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function humanType(type: DocumentType) {
  return type
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}
