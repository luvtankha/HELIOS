import { ClinicalBriefBuilder } from "../../src/clinical-brief/clinical-brief-builder.js";
import { BriefNarrativeRenderer } from "../../src/clinical-brief/narrative-renderer.js";
import type { BriefInput } from "../../src/clinical-brief/types.js";
import { describe, expect, it } from "vitest";

const input = (overrides: Partial<BriefInput> = {}): BriefInput => ({
  patient: {
    id: "patient",
    fullName: "Aarav Sharma",
    patientCode: "SYNTHETIC-1",
    age: 24,
    sex: "MALE",
    preferredLanguage: "hi",
  },
  visit: {
    id: "current",
    startedAt: new Date("2026-09-09T04:00:00Z"),
    clinicalHistory: {
      id: "history",
      chiefComplaint: "Stomach pain for 3 days with vomiting.",
      duration: { value: "3 days" },
      location: { value: "Upper abdomen" },
      source: "PATIENT_REPORTED",
    },
  },
  symptoms: [
    {
      id: "pain",
      name: "Upper abdominal pain",
      duration: { value: "3 days" },
      location: { value: "Upper abdomen" },
      status: "YES",
      source: "PATIENT_REPORTED",
    },
    {
      id: "breathing",
      name: "Breathing difficulty",
      status: "YES",
      source: "PATIENT_REPORTED",
    },
  ],
  medications: [
    {
      id: "metformin-current",
      name: "Metformin",
      dose: "1000 mg",
      frequency: "twice daily",
      visitId: "current",
      source: "PATIENT_REPORTED",
    },
  ],
  allergies: [],
  observations: [
    {
      id: "hb-current",
      display: "Hemoglobin",
      value: 8.9,
      unit: "g/dL",
      state: "YES",
      source: "DOCUMENT_EXTRACTED",
      effectiveAt: new Date("2026-09-01T00:00:00Z"),
    },
  ],
  documents: [
    {
      id: "lab",
      fileName: "SYNTHETIC-lab.png",
      documentType: "LAB_REPORT",
      documentDate: new Date("2026-09-01T00:00:00Z"),
      processingStatus: "REVIEW_REQUIRED",
      facts: [
        {
          id: "hb-fact",
          factType: "lab_result",
          normalizedValue: { value: 8.9, unit: "g/dL" },
          confidence: 0.98,
          status: "CONFIRMED",
          evidence: [{ pageNumber: 1, sourceText: "Hemoglobin 8.9 g/dL" }],
        },
      ],
    },
  ],
  history: [],
  comparison: {
    id: "comparison",
    changes: [
      {
        id: "hb-change",
        entityType: "OBSERVATION",
        entityKey: "hemoglobin",
        changeType: "CHANGED",
        fieldChanges: [
          { field: "value", previousValue: 10.4, currentValue: 8.9 },
        ],
        previousValue: { value: 10.4 },
        currentValue: { value: 8.9 },
        previousEvidence: {
          timelineEventId: "hb-old",
          documentId: "old-lab",
          pageNumber: 1,
          sourceText: "Hemoglobin 10.4 g/dL",
        },
        currentEvidence: {
          timelineEventId: "hb-new",
          documentId: "lab",
          pageNumber: 1,
          sourceText: "Hemoglobin 8.9 g/dL",
        },
        needsReview: false,
        explanation: "Hemoglobin changed from 10.4 to 8.9 g/dL.",
        currentVerificationStatus: "DOCUMENT_EXTRACTED",
      },
      {
        id: "med-change",
        entityType: "MEDICATION",
        entityKey: "metformin",
        changeType: "CONFLICTED",
        fieldChanges: [
          { field: "dose", previousValue: "500 mg", currentValue: "1000 mg" },
        ],
        previousValue: { dose: "500 mg" },
        currentValue: { dose: "1000 mg" },
        needsReview: true,
        explanation: "Metformin has conflicting records and needs review.",
        previousVerificationStatus: "DOCTOR_VERIFIED",
        currentVerificationStatus: "CAPTURED",
      },
    ],
  },
  safetyAvailable: false,
  riskSignals: [],
  ...overrides,
});

describe("ClinicalBriefBuilder", () => {
  it("builds an evidence-linked brief from native intake without legacy symptoms", () => {
    const source = input({
      visit: { id: "current", startedAt: new Date("2026-10-04T00:00:00Z") },
      symptoms: [], medications: [], documents: [], observations: [], comparison: undefined,
      liveFacts: [
        { id: "chief", field: "chiefComplaint", value: "fatigue", knowledgeState: "KNOWN", evidenceTurnIds: ["turn-1"] },
        { id: "severity", field: "severity", value: "3/10", knowledgeState: "KNOWN", evidenceTurnIds: ["turn-3"] },
        { id: "allergy", field: "allergies", value: "none reported", knowledgeState: "KNOWN", evidenceTurnIds: ["turn-3"] },
        { id: "history", field: "pastMedicalHistory", value: null, knowledgeState: "UNKNOWN", evidenceTurnIds: ["turn-3"] },
      ],
    });
    const builder = new ClinicalBriefBuilder();
    const brief = builder.build(source);
    expect(brief.narrative).toContain("fatigue");
    expect(brief.narrative).toContain("3/10");
    expect(brief.claims.find((claim) => claim.claimKey === "live:history")?.sectionType).toBe("NEEDS_VERIFICATION");
    expect(brief.claims.filter((claim) => claim.sectionType === "ALLERGIES")).toHaveLength(1);
    expect(brief.sourceReferences.find((item) => item.sourceId === "chief")?.sourceText).toContain("turn-1");
    expect(builder.revision(source)).not.toBe(builder.revision({ ...source, liveFacts: [] }));
  });
  it("builds the doctor-first brief from existing structured sources", () => {
    const brief = new ClinicalBriefBuilder().build(input());
    expect(
      brief.claims.some(
        (claim) =>
          claim.sectionType === "TODAYS_REASON" &&
          claim.text.includes("Stomach pain"),
      ),
    ).toBe(true);
    expect(
      brief.claims.some(
        (claim) =>
          claim.sectionType === "CURRENT_SYMPTOMS" &&
          claim.text.includes("Upper abdominal pain"),
      ),
    ).toBe(true);
    expect(
      brief.claims.some(
        (claim) =>
          claim.sectionType === "WHAT_CHANGED" &&
          claim.text.includes("10.4 to 8.9"),
      ),
    ).toBe(true);
    expect(
      brief.claims.some(
        (claim) =>
          claim.sectionType === "MEDICATIONS" && claim.text.includes("1000 mg"),
      ),
    ).toBe(true);
    expect(
      brief.claims.some(
        (claim) =>
          claim.sectionType === "INVESTIGATIONS" &&
          claim.text.includes("8.9 g/dL"),
      ),
    ).toBe(true);
    expect(
      brief.claims.some(
        (claim) => claim.sectionType === "SUPPORTING_DOCUMENTS",
      ),
    ).toBe(true);
  });

  it("requires provenance for every persisted claim", () => {
    const brief = new ClinicalBriefBuilder().build(input());
    expect(brief.claims.length).toBeGreaterThan(0);
    expect(
      brief.claims.every(
        (claim) => claim.sourceId && claim.evidence.length > 0,
      ),
    ).toBe(true);
  });

  it("preserves medication conflict in changes and needs verification", () => {
    const claims = new ClinicalBriefBuilder().build(input()).claims;
    expect(
      claims.some(
        (claim) =>
          claim.claimKey === "change:med-change" &&
          claim.sectionType === "WHAT_CHANGED",
      ),
    ).toBe(true);
    expect(
      claims.some(
        (claim) =>
          claim.claimKey === "verify-change:med-change" &&
          claim.needsVerification,
      ),
    ).toBe(true);
  });

  it("says allergy information is not documented instead of no allergies", () => {
    const claim = new ClinicalBriefBuilder()
      .build(input())
      .claims.find((item) => item.sectionType === "ALLERGIES");
    expect(claim?.text).toBe("Allergy information not documented.");
    expect(claim?.text).not.toMatch(/no allergies/i);
  });

  it("omits explicitly not-asked symptoms and preserves unknown symptoms", () => {
    const symptoms = [
      {
        id: "one",
        name: "Not asked symptom",
        status: "NOT_ASKED",
        source: "SYSTEM_GENERATED",
      },
      {
        id: "two",
        name: "Uncertain symptom",
        status: "UNKNOWN",
        source: "PATIENT_REPORTED",
      },
    ];
    const claims = new ClinicalBriefBuilder().build(input({ symptoms })).claims;
    expect(
      claims.some((claim) => claim.text.includes("Not asked symptom")),
    ).toBe(false);
    expect(
      claims.find((claim) => claim.text.includes("Uncertain symptom"))
        ?.needsVerification,
    ).toBe(true);
  });

  it("does not fabricate change or safety availability", () => {
    const brief = new ClinicalBriefBuilder().build(
      input({ comparison: undefined, safetyAvailable: false }),
    );
    expect(
      brief.sections.find((section) => section.sectionType === "WHAT_CHANGED")
        ?.availability,
    ).toBe("UNAVAILABLE");
    expect(
      brief.claims.find((claim) => claim.claimKey === "safety:unavailable")
        ?.text,
    ).toBe("Safety attention status unavailable.");
    expect(brief.narrative).not.toMatch(/no safety (concerns|signals)/i);
  });

  it("only consumes active existing safety signals", () => {
    const riskSignals = [
      {
        id: "risk",
        title: "Clinical attention",
        description: "Chest discomfort and breathing difficulty reported",
        category: "HIGH_PRIORITY_REVIEW",
        severity: "HIGH",
        status: "OPEN",
        createdAt: new Date("2026-09-09T04:00:00Z"),
      },
    ];
    const brief = new ClinicalBriefBuilder().build(
      input({ safetyAvailable: true, riskSignals }),
    );
    expect(
      brief.claims.find((claim) => claim.sectionType === "SAFETY_ATTENTION")
        ?.sourceType,
    ).toBe("RISK_SIGNAL");
  });

  it("deduplicates claims and bounds large histories deterministically", () => {
    const history = Array.from({ length: 40 }, (_, index) => ({
      id: `history-${index}`,
      title: `History ${index}`,
      source: "CLINICAL_RECORD" as const,
      verificationStatus: "CAPTURED" as const,
    }));
    const brief = new ClinicalBriefBuilder().build(input({ history }));
    expect(
      brief.claims.filter((claim) => claim.sectionType === "RELEVANT_HISTORY"),
    ).toHaveLength(4);
    expect(new Set(brief.claims.map((claim) => claim.claimKey)).size).toBe(
      brief.claims.length,
    );
  });

  it("preserves multilingual patient wording without translating facts", () => {
    const value = input();
    value.visit.clinicalHistory = {
      id: "hi",
      chiefComplaint: "Kal se pet mein bahut pain hai.",
      source: "PATIENT_REPORTED",
    };
    const claim = new ClinicalBriefBuilder()
      .build(value)
      .claims.find((item) => item.sectionType === "TODAYS_REASON");
    expect(claim?.text).toBe("Kal se pet mein bahut pain hai.");
    expect(value.patient.preferredLanguage).toBe("hi");
  });

  it("produces the same source revision and structured output for the same input", () => {
    const builder = new ClinicalBriefBuilder();
    expect(builder.revision(input())).toBe(builder.revision(input()));
    expect(builder.build(input())).toEqual(builder.build(input()));
  });

  it("clears review markers for verified voice facts and excludes rejected facts from the brief", () => {
    const value = input({ liveFacts: [
      { id: "live", field: "severity", value: "4/10", knowledgeState: "KNOWN", verificationStatus: "DOCTOR_CORRECTED", verificationVersion: 1, evidenceTurnIds: ["turn-1"] },
      { id: "rejected", field: "chiefComplaint", value: "Unsupported symptom", knowledgeState: "KNOWN", verificationStatus: "DOCTOR_REJECTED", evidenceTurnIds: ["turn-2"] },
    ] });
    const builder = new ClinicalBriefBuilder();
    const brief = builder.build(value);
    expect(brief.claims.find((claim) => claim.claimKey === "live:live")).toMatchObject({ needsVerification: false, verificationStatus: "DOCTOR_VERIFIED", sourceType: "PATIENT_REPORTED" });
    expect(brief.claims.some((claim) => claim.claimKey === "live:rejected")).toBe(false);
    expect(builder.revision(value)).not.toBe(builder.revision({ ...value, liveFacts: value.liveFacts!.map((fact) => ({ ...fact, verificationStatus: "PATIENT_REPORTED" })) }));
  });
});

describe("optional narrative boundary", () => {
  const renderer = new BriefNarrativeRenderer();
  const claims = new ClinicalBriefBuilder().build(input()).claims;
  it.each([
    "Patient has severe anemia.",
    "Abdominal pain is likely gastritis.",
    "Continue Metformin and increase the dose.",
    "The patient deteriorated after hemoglobin changed.",
  ])("rejects unsupported AI wording: %s", (candidate) => {
    expect(renderer.validate(candidate, claims)).toBe(false);
    expect(renderer.renderOptional(candidate, claims)).toBe(
      renderer.render(claims),
    );
  });
  it("falls back deterministically when no AI narrative is available", () => {
    expect(renderer.renderOptional(undefined, claims)).toBe(
      renderer.render(claims),
    );
  });
});
