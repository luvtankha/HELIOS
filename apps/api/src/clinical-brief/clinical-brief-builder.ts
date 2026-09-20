import { createHash } from "node:crypto";
import type { BriefSectionType, TimelineEventStatus } from "@prisma/client";
import { BriefNarrativeRenderer } from "./narrative-renderer.js";
import { briefConfig, type BriefConfig } from "./brief-config.js";
import type {
  BriefClaimDraft,
  BriefEvidence,
  BriefInput,
  BriefSectionDraft,
  BuiltBrief,
} from "./types.js";

export const CLINICAL_BRIEF_GENERATOR_VERSION = "phase11-ayush-v1";

const sectionDefinitions: Array<[BriefSectionType, string, boolean, boolean]> =
  [
    ["PATIENT_SNAPSHOT", "Patient snapshot", false, true],
    ["TODAYS_REASON", "Why today?", false, true],
    ["SAFETY_ATTENTION", "Safety attention", false, true],
    ["WHAT_CHANGED", "What changed", false, true],
    ["NEEDS_VERIFICATION", "Needs verification", false, true],
    ["CURRENT_SYMPTOMS", "Current symptoms", false, true],
    ["MEDICATIONS", "Medications", true, true],
    ["AYUSH_USE", "AYUSH / other healthcare use", true, true],
    ["ALLERGIES", "Allergies", true, true],
    ["INVESTIGATIONS", "Recent investigations", true, true],
    ["RELEVANT_HISTORY", "Relevant history", true, false],
    ["SUPPORTING_DOCUMENTS", "Supporting documents", true, false],
    ["SOURCE_EVIDENCE", "Source and evidence", true, false],
  ];

export class ClinicalBriefBuilder {
  constructor(
    private readonly renderer = new BriefNarrativeRenderer(),
    private readonly config: BriefConfig = briefConfig,
  ) {}

  build(input: BriefInput): BuiltBrief {
    const claims: BriefClaimDraft[] = [];
    const add = (claim: Omit<BriefClaimDraft, "position">) => {
      if (
        !claim.evidence.length ||
        claims.some((item) => item.claimKey === claim.claimKey)
      )
        return;
      claims.push({
        ...claim,
        position: claims.filter(
          (item) => item.sectionType === claim.sectionType,
        ).length,
      });
    };
    add(this.patientClaim(input));
    if (input.visit.clinicalHistory?.chiefComplaint)
      add(this.reasonClaim(input));
    input.symptoms
      .filter((item) => !["NO", "NOT_ASKED"].includes(item.status ?? "YES"))
      .slice(0, this.config.maxSymptoms)
      .forEach((item) =>
        add({
          claimKey: `symptom:${item.id}`,
          sectionType: "CURRENT_SYMPTOMS",
          text: join([
            item.name,
            readable(item.duration),
            readable(item.location),
            item.severity && `Severity: ${item.severity}`,
          ]),
          structuredValue: item,
          sourceType: item.source,
          sourceId: item.id,
          verificationStatus: verifiedStatus(
            item.verificationStatus ?? item.source,
            item.source,
          ),
          needsVerification:
            item.status === "UNKNOWN" ||
            !doctorVerified(item.verificationStatus ?? item.source),
          evidence: [
            {
              kind: "SYMPTOM",
              sourceId: item.id,
              label: sourceLabel(item.source),
              eventDate: input.visit.startedAt.toISOString(),
            },
          ],
        }),
      );
    this.changeClaims(input).forEach(add);
    this.medicationClaims(input).forEach(add);
    this.ayushClaims(input).forEach(add);
    this.allergyClaims(input).forEach(add);
    input.observations
      .filter((item) => item.state !== "NOT_ASKED")
      .slice(0, 5)
      .forEach((item) =>
        add({
          claimKey: `observation:${item.id}`,
          sectionType: "INVESTIGATIONS",
          text: `${item.display}: ${display(item.value)}${item.unit ? ` ${item.unit}` : ""}${item.effectiveAt ? ` · ${date(item.effectiveAt)}` : ""}.`,
          structuredValue: item,
          sourceType: item.source,
          sourceId: item.id,
          verificationStatus: verifiedStatus(
            item.verificationStatus ?? item.source,
            item.source,
          ),
          needsVerification:
            item.state === "UNKNOWN" ||
            !doctorVerified(item.verificationStatus ?? item.source),
          evidence: [
            {
              kind: "OBSERVATION",
              sourceId: item.id,
              label: sourceLabel(item.source),
              ...(item.effectiveAt && {
                eventDate: item.effectiveAt.toISOString(),
              }),
            },
          ],
        }),
      );
    input.history.slice(0, 4).forEach((item) =>
      add({
        claimKey: `history:${item.id}`,
        sectionType: "RELEVANT_HISTORY",
        text: join([item.title, item.description]),
        sourceType: item.source,
        sourceId: item.id,
        verificationStatus: item.verificationStatus,
        needsVerification: false,
        evidence: [
          {
            kind: "TIMELINE_EVENT",
            sourceId: item.id,
            timelineEventId: item.id,
            label: sourceLabel(item.source),
            ...(item.eventDate && {
              eventDate: item.eventDate.toISOString(),
            }),
          },
        ],
      }),
    );
    input.documents.slice(0, this.config.maxDocuments).forEach((item) =>
      add({
        claimKey: `document:${item.id}`,
        sectionType: "SUPPORTING_DOCUMENTS",
        text: `${human(item.documentType)} · ${item.documentDate ? date(item.documentDate) : "Date not documented"}.`,
        structuredValue: {
          fileName: item.fileName,
          summary: item.summary,
          processingStatus: item.processingStatus,
        },
        sourceType: "DOCUMENT",
        sourceId: item.id,
        verificationStatus:
          item.processingStatus === "VERIFIED"
            ? "DOCTOR_VERIFIED"
            : "DOCUMENT_EXTRACTED",
        needsVerification: item.processingStatus === "REVIEW_REQUIRED",
        evidence: [
          {
            kind: "DOCUMENT",
            sourceId: item.id,
            documentId: item.id,
            label: item.fileName,
            ...(item.documentDate && {
              eventDate: item.documentDate.toISOString(),
            }),
          },
        ],
      }),
    );
    this.safetyClaims(input).forEach(add);
    this.documentVerificationClaims(input).forEach(add);
    const sections: BriefSectionDraft[] = sectionDefinitions.map(
      ([sectionType, title, collapsible, defaultExpanded]) => ({
        sectionType,
        title,
        collapsible,
        defaultExpanded,
        availability: availability(sectionType, claims, input),
      }),
    );
    const sourceReferences = uniqueEvidence(
      claims.flatMap((claim) => claim.evidence),
    );
    return {
      sections,
      claims,
      sourceReferences,
      narrative: this.renderer.render(claims),
    };
  }

  revision(input: BriefInput) {
    return createHash("sha256")
      .update(
        stable({
          patient: input.patient,
          visit: input.visit,
          symptoms: input.symptoms,
          medications: input.medications,
          allergies: input.allergies,
          observations: input.observations,
          ayushRecords: input.ayushRecords,
          documents: input.documents,
          history: input.history,
          comparison: input.comparison,
          safetyAvailable: input.safetyAvailable,
          riskSignals: input.riskSignals,
        }),
      )
      .digest("hex");
  }

  private patientClaim(input: BriefInput): Omit<BriefClaimDraft, "position"> {
    return {
      claimKey: `patient:${input.patient.id}`,
      sectionType: "PATIENT_SNAPSHOT",
      text: `${input.patient.fullName} · ${input.patient.age} years · ${human(input.patient.sex)} · Current visit ${date(input.visit.startedAt)}.`,
      structuredValue: input.patient,
      sourceType: "PATIENT",
      sourceId: input.patient.id,
      verificationStatus: "CAPTURED",
      needsVerification: false,
      evidence: [
        {
          kind: "PATIENT",
          sourceId: input.patient.id,
          label: input.patient.patientCode,
        },
        {
          kind: "VISIT",
          sourceId: input.visit.id,
          label: "Current visit",
          eventDate: input.visit.startedAt.toISOString(),
        },
      ],
    };
  }
  private reasonClaim(input: BriefInput): Omit<BriefClaimDraft, "position"> {
    const history = input.visit.clinicalHistory!;
    const complaint =
      history.chiefComplaint ?? "Reason for visit not documented.";
    return {
      claimKey: `reason:${history.id}`,
      sectionType: "TODAYS_REASON",
      text: complaint,
      structuredValue: {
        chiefComplaint: history.chiefComplaint,
        duration: history.duration,
        location: history.location,
        associatedSymptoms: history.associatedSymptoms,
      },
      sourceType: history.source,
      sourceId: history.id,
      verificationStatus: verifiedStatus(
        history.verificationStatus ?? history.source,
        history.source,
      ),
      needsVerification: !doctorVerified(
        history.verificationStatus ?? history.source,
      ),
      evidence: [
        {
          kind: "INTERVIEW",
          sourceId: history.id,
          label: sourceLabel(history.source),
          eventDate: input.visit.startedAt.toISOString(),
          sourceText: complaint,
        },
      ],
    };
  }
  private changeClaims(
    input: BriefInput,
  ): Array<Omit<BriefClaimDraft, "position">> {
    if (!input.comparison) return [];
    return input.comparison.changes
      .filter((item) => item.changeType !== "UNCHANGED")
      .slice(0, this.config.maxChanges)
      .flatMap((item) => {
        const needsVerification =
          item.needsReview || item.changeType === "CONFLICTED";
        const base = {
          structuredValue: {
            entityType: item.entityType,
            entityKey: item.entityKey,
            changeType: item.changeType,
            fieldChanges: item.fieldChanges,
            previousValue: item.previousValue,
            currentValue: item.currentValue,
          },
          sourceType: "COMPARISON",
          sourceId: item.id,
          verificationStatus:
            item.currentVerificationStatus ??
            item.previousVerificationStatus ??
            ("CAPTURED" as const),
          needsVerification,
          evidence: comparisonEvidence(input.comparison!.id, item),
        };
        const result: Array<Omit<BriefClaimDraft, "position">> = [
          {
            ...base,
            claimKey: `change:${item.id}`,
            sectionType: "WHAT_CHANGED",
            text: item.explanation,
          },
        ];
        if (needsVerification)
          result.push({
            ...base,
            claimKey: `verify-change:${item.id}`,
            sectionType: "NEEDS_VERIFICATION",
            text: `${item.entityKey} has conflicting or unverified recorded information.`,
          });
        return result;
      });
  }
  private medicationClaims(
    input: BriefInput,
  ): Array<Omit<BriefClaimDraft, "position">> {
    const current = input.medications
      .filter((item) => item.visitId === input.visit.id)
      .slice(0, this.config.maxSymptoms);
    return current.map((item) => ({
      claimKey: `medication:${item.id}`,
      sectionType: "MEDICATIONS",
      text: join([item.name, item.dose, item.frequency, item.route]),
      structuredValue: item,
      sourceType: item.source,
      sourceId: item.id,
      verificationStatus: verifiedStatus(
        item.verificationStatus ??
          (item.verifiedAt ? "DOCTOR_VERIFIED" : item.source),
        item.source,
      ),
      needsVerification: !doctorVerified(
        item.verificationStatus ??
          (item.verifiedAt ? "DOCTOR_VERIFIED" : item.source),
      ),
      evidence: [
        {
          kind: "MEDICATION",
          sourceId: item.id,
          label: sourceLabel(item.source),
          eventDate: input.visit.startedAt.toISOString(),
        },
      ],
    }));
  }
  private allergyClaims(
    input: BriefInput,
  ): Array<Omit<BriefClaimDraft, "position">> {
    if (!input.allergies.length)
      return [
        {
          claimKey: "allergy:not-documented",
          sectionType: "ALLERGIES",
          text: "Allergy information not documented.",
          structuredValue: { state: "NOT_DOCUMENTED" },
          sourceType: "VISIT",
          sourceId: input.visit.id,
          verificationStatus: "CAPTURED",
          needsVerification: true,
          evidence: [
            {
              kind: "VISIT",
              sourceId: input.visit.id,
              label: "Current visit record",
            },
          ],
        },
      ];
    return input.allergies.slice(0, 5).map((item) => ({
      claimKey: `allergy:${item.id}`,
      sectionType: "ALLERGIES",
      text: join([item.allergen, item.reaction, item.severity]),
      structuredValue: item,
      sourceType: item.source,
      sourceId: item.id,
      verificationStatus: verifiedStatus(
        item.verificationStatus ??
          (item.verifiedAt ? "DOCTOR_VERIFIED" : item.source),
        item.source,
      ),
      needsVerification: !doctorVerified(
        item.verificationStatus ??
          (item.verifiedAt ? "DOCTOR_VERIFIED" : item.source),
      ),
      evidence: [
        {
          kind: "ALLERGY",
          sourceId: item.id,
          label: sourceLabel(item.source),
        },
      ],
    }));
  }
  private ayushClaims(
    input: BriefInput,
  ): Array<Omit<BriefClaimDraft, "position">> {
    return (input.ayushRecords ?? []).slice(0, 8).map((item) => {
      const verified = verifiedStatus(
        item.verificationStatus ?? item.source,
        item.source,
      );
      const effect = item.reportedEffect
        ? `Reported after treatment use: ${item.reportedEffect}`
        : undefined;
      return {
        claimKey: `ayush:${item.id}`,
        sectionType: "AYUSH_USE",
        text: join([
          human(item.system),
          item.normalizedName ?? item.originalName,
          human(item.useStatus),
          item.dosage,
          item.frequency,
          item.indicationAsReported &&
            `Reported reason: ${item.indicationAsReported}`,
          effect,
        ]),
        structuredValue: item,
        sourceType: item.source,
        sourceId: item.id,
        verificationStatus: verified,
        needsVerification: !doctorVerified(
          item.verificationStatus ?? item.source,
        ),
        evidence: [
          {
            kind: "AYUSH_RECORD",
            sourceId: item.id,
            label: sourceLabel(item.source),
            ...(item.startDate && { eventDate: item.startDate.toISOString() }),
          },
        ],
      };
    });
  }
  private safetyClaims(
    input: BriefInput,
  ): Array<Omit<BriefClaimDraft, "position">> {
    if (!input.safetyAvailable)
      return [
        {
          claimKey: "safety:unavailable",
          sectionType: "SAFETY_ATTENTION",
          text: "Safety attention status unavailable.",
          sourceType: "SYSTEM_AVAILABILITY",
          sourceId: input.visit.id,
          verificationStatus: "CAPTURED",
          needsVerification: true,
          evidence: [
            {
              kind: "SYSTEM_AVAILABILITY",
              sourceId: input.visit.id,
              label: "Safety engine unavailable",
            },
          ],
        },
      ];
    return input.riskSignals
      .filter(
        (item) => item.status === "OPEN" || item.status === "ACKNOWLEDGED",
      )
      .slice(0, 3)
      .map((item) => ({
        claimKey: `risk:${item.id}`,
        sectionType: "SAFETY_ATTENTION",
        text: `${item.title}. ${item.description}`,
        structuredValue: {
          category: item.category,
          severity: item.severity,
          status: item.status,
        },
        sourceType: "RISK_SIGNAL",
        sourceId: item.id,
        verificationStatus: "AI_STRUCTURED",
        needsVerification: item.status === "OPEN",
        evidence: [
          {
            kind: "RISK_SIGNAL",
            sourceId: item.id,
            riskSignalId: item.id,
            label: "Existing safety signal",
            eventDate: item.createdAt.toISOString(),
          },
        ],
      }));
  }
  private documentVerificationClaims(
    input: BriefInput,
  ): Array<Omit<BriefClaimDraft, "position">> {
    return input.documents.flatMap((document) =>
      document.facts
        .filter(
          (fact) =>
            fact.status === "NEEDS_REVIEW" || (fact.confidence ?? 1) < 0.7,
        )
        .slice(0, 3)
        .map((fact) => ({
          claimKey: `verify-document:${fact.id}`,
          sectionType: "NEEDS_VERIFICATION" as const,
          text: `${human(fact.factType)} from ${document.fileName} needs verification.`,
          structuredValue: fact.normalizedValue,
          sourceType: "DOCUMENT_FACT",
          sourceId: fact.id,
          verificationStatus: verifiedStatus(
            fact.verificationStatus ??
              (fact.status === "VERIFIED"
                ? "DOCTOR_VERIFIED"
                : "DOCUMENT_EXTRACTED"),
            "DOCUMENT_EXTRACTED",
          ),
          ...(fact.confidence !== undefined && {
            confidence: fact.confidence,
          }),
          needsVerification: true,
          evidence: [
            {
              kind: "DOCUMENT_FACT" as const,
              sourceId: fact.id,
              documentId: document.id,
              documentFactId: fact.id,
              label: document.fileName,
              ...(fact.evidence[0] && {
                pageNumber: fact.evidence[0].pageNumber,
                sourceText: fact.evidence[0].sourceText,
              }),
            },
          ],
        })),
    );
  }
}

type ComparisonChange = NonNullable<
  BriefInput["comparison"]
>["changes"][number];

function comparisonEvidence(
  comparisonId: string,
  item: ComparisonChange,
): BriefEvidence[] {
  const base: BriefEvidence[] = [
    {
      kind: "CHANGE_RECORD",
      sourceId: item.id,
      comparisonId,
      changeRecordId: item.id,
      label: "What changed",
    },
  ];
  for (const [label, value] of [
    ["Previous evidence", item.previousEvidence],
    ["Current evidence", item.currentEvidence],
  ] as const) {
    if (value && typeof value === "object") {
      const evidence = value as Record<string, unknown>;
      base.push({
        kind: "TIMELINE_EVENT",
        sourceId:
          typeof evidence.timelineEventId === "string"
            ? evidence.timelineEventId
            : item.id,
        label,
        ...(typeof evidence.timelineEventId === "string" && {
          timelineEventId: evidence.timelineEventId,
        }),
        ...(typeof evidence.documentId === "string" && {
          documentId: evidence.documentId,
        }),
        ...(typeof evidence.documentFactId === "string" && {
          documentFactId: evidence.documentFactId,
        }),
        ...(typeof evidence.pageNumber === "number" && {
          pageNumber: evidence.pageNumber,
        }),
        ...(typeof evidence.sourceText === "string" && {
          sourceText: evidence.sourceText,
        }),
        ...(typeof evidence.eventDate === "string" && {
          eventDate: evidence.eventDate,
        }),
      });
    }
  }
  return base;
}
function status(source: string): TimelineEventStatus {
  if (source === "DOCTOR_VERIFIED") return "DOCTOR_VERIFIED";
  if (source === "DOCUMENT_EXTRACTED") return "DOCUMENT_EXTRACTED";
  if (source === "AI_STRUCTURED") return "AI_STRUCTURED";
  return "CAPTURED";
}
function doctorVerified(statusValue: string) {
  return ["DOCTOR_VERIFIED", "DOCTOR_CORRECTED", "VERIFIED", "EDITED"].includes(
    statusValue,
  );
}
function verifiedStatus(
  statusValue: string,
  source: string,
): TimelineEventStatus {
  if (doctorVerified(statusValue)) return "DOCTOR_VERIFIED";
  if (
    statusValue === "DOCTOR_REJECTED" ||
    statusValue === "SUPERSEDED" ||
    statusValue === "REJECTED"
  )
    return "REJECTED";
  return status(source);
}
function availability(
  type: BriefSectionType,
  claims: BriefClaimDraft[],
  input: BriefInput,
): BriefSectionDraft["availability"] {
  if (type === "WHAT_CHANGED" && !input.comparison) return "UNAVAILABLE";
  if (type === "SAFETY_ATTENTION" && !input.safetyAvailable)
    return "UNAVAILABLE";
  return claims.some((claim) => claim.sectionType === type)
    ? "AVAILABLE"
    : "EMPTY";
}
function uniqueEvidence(items: BriefEvidence[]) {
  return [
    ...new Map(
      items.map((item) => [`${item.kind}:${item.sourceId}`, item]),
    ).values(),
  ];
}
function readable(value: unknown) {
  if (!value || typeof value !== "object")
    return typeof value === "string" ? value : undefined;
  const nested = (value as Record<string, unknown>).value;
  return typeof nested === "string" || typeof nested === "number"
    ? String(nested)
    : undefined;
}
function display(value: unknown) {
  if (value === undefined || value === null) return "Not documented";
  if (typeof value === "object") {
    const nested = (value as Record<string, unknown>).value;
    if (nested === undefined) return JSON.stringify(value);
    if (typeof nested === "string" || typeof nested === "number")
      return String(nested);
    if (typeof nested === "boolean") return nested ? "Yes" : "No";
    return JSON.stringify(nested);
  }
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return "Not documented";
}
function join(values: Array<string | undefined>) {
  return `${values.filter(Boolean).join(" · ")}.`;
}
function date(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}
function human(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}
function sourceLabel(value: string) {
  return human(value);
}
function stable(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
    .join(",")}}`;
}
