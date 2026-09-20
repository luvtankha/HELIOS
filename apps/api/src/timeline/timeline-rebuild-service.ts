import { AppError } from "../utils/app-error.js";
import type { TimelineRepository } from "../repositories/timeline-repository.js";
import { TimelineEventBuilder } from "./timeline-event-builder.js";
import type { ProjectedTimelineEvent } from "./types.js";

export class TimelineRebuildService {
  constructor(
    private readonly repository: TimelineRepository,
    private readonly builder = new TimelineEventBuilder(),
  ) {}

  async rebuild(patientId: string) {
    const snapshot = await this.repository.sourceSnapshot(patientId);
    if (!snapshot)
      throw new AppError("Patient not found", 404, "PATIENT_NOT_FOUND");
    const events: ProjectedTimelineEvent[] = [];

    for (const visit of snapshot.visits) {
      events.push(this.builder.visit(visit));
      if (visit.clinicalHistory?.chiefComplaint) {
        const history = visit.clinicalHistory;
        events.push(
          this.builder.build({
            patientId,
            visitId: visit.id,
            eventType: "CLINICAL_HISTORY_UPDATE",
            title: history.chiefComplaint,
            description: [
              readable(history.duration),
              readable(history.location),
            ]
              .filter(Boolean)
              .join(" · "),
            eventDate: visit.startedAt,
            source:
              history.source === "PATIENT_REPORTED"
                ? "PATIENT_REPORTED"
                : "CLINICAL_RECORD",
            sourceType: "CLINICAL_HISTORY",
            sourceId: history.id,
            verificationStatus:
              history.verificationStatus === "DOCTOR_VERIFIED" ||
              history.verificationStatus === "DOCTOR_CORRECTED" ||
              history.source === "DOCTOR_VERIFIED"
                ? "DOCTOR_VERIFIED"
                : history.verificationStatus === "DOCTOR_REJECTED" ||
                    history.verificationStatus === "SUPERSEDED"
                  ? "REJECTED"
                  : "CAPTURED",
            temporalState: "CURRENT",
            originalValue: { chiefComplaint: history.chiefComplaint },
            groupKey: `visit:${visit.id}`,
            normalizedKey: "chief-complaint",
            recordedAt: history.createdAt,
          }),
        );
      }
      events.push(
        ...visit.symptoms.map((symptom) =>
          this.builder.symptom({ ...symptom, patientId }),
        ),
      );
      events.push(
        ...visit.riskSignals.map((risk) =>
          this.builder.risk({ ...risk, patientId }),
        ),
      );
      events.push(
        ...visit.verifications.map((verification) =>
          this.builder.verification({ ...verification, patientId }),
        ),
      );
      for (const response of visit.interview?.responses ?? []) {
        if (!response.rawAnswer.trim()) continue;
        events.push(
          this.builder.build({
            patientId,
            visitId: visit.id,
            eventType: "CLINICAL_HISTORY_UPDATE",
            title: "Patient interview response",
            description: response.rawAnswer,
            source: "VOICE_INTERVIEW",
            sourceType: "INTERVIEW_RESPONSE",
            sourceId: response.id,
            verificationStatus:
              response.verificationStatus === "DOCTOR_VERIFIED" ||
              response.verificationStatus === "DOCTOR_CORRECTED"
                ? "DOCTOR_VERIFIED"
                : response.verificationStatus === "DOCTOR_REJECTED" ||
                    response.verificationStatus === "SUPERSEDED"
                  ? "REJECTED"
                  : response.status === "CONFIRMED"
                    ? "PATIENT_CONFIRMED"
                    : "AI_STRUCTURED",
            temporalState: "UNKNOWN",
            confidence: response.confidence,
            originalValue: response.rawAnswer,
            normalizedValue: response.normalizedAnswer,
            groupKey: `visit:${visit.id}`,
            normalizedKey: response.questionId,
            recordedAt: response.createdAt,
          }),
        );
      }
    }
    events.push(
      ...snapshot.medications.map((item) => this.builder.medication(item)),
      ...snapshot.allergies.map((item) => this.builder.allergy(item)),
      ...snapshot.observations.map((item) => this.builder.observation(item)),
      ...(snapshot.ayushRecords ?? []).map((item) => this.builder.ayush(item)),
    );
    for (const document of snapshot.documents) {
      events.push(this.builder.document(document));
      events.push(
        ...document.facts.map((fact) =>
          this.builder.documentFact({
            ...fact,
            documentDate: document.documentDate,
          }),
        ),
      );
    }

    await this.repository.upsertProjected(events, "SOURCE_REBUILD");
    await this.repository.rejectMissing(
      patientId,
      events.map((event) => event.fingerprint),
    );
    return { projectedEventCount: events.length };
  }
}

function readable(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const nested = (value as Record<string, unknown>).value;
  return typeof nested === "string" || typeof nested === "number"
    ? String(nested)
    : undefined;
}
