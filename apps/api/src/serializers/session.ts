import type { Prisma } from "@prisma/client";
import type { PatientSessionDto, VisitDto } from "@helios/shared";
import { serializePatient } from "./patient.js";

type SessionView = Prisma.PatientSessionGetPayload<{
  include: { patient: true; visit: { include: { clinicalHistory: true } } };
}>;

export function serializeSession(session: SessionView): PatientSessionDto {
  const draft = sanitizeDraft(session.draftData);
  const visit: VisitDto | undefined = session.visit
    ? {
        id: session.visit.id,
        status: session.visit.status,
        startedAt: session.visit.startedAt.toISOString(),
        ...(session.visit.tokenNumber && {
          tokenNumber: session.visit.tokenNumber,
        }),
        ...(session.visit.clinicalHistory?.chiefComplaint && {
          chiefComplaint: session.visit.clinicalHistory.chiefComplaint,
        }),
        ...(session.visit.clinicalHistory && {
          healthDetails: {
            ...(readJsonValue(session.visit.clinicalHistory.location) && {
              location: readJsonValue(session.visit.clinicalHistory.location),
            }),
            ...(readJsonValue(session.visit.clinicalHistory.duration) && {
              duration: readJsonValue(session.visit.clinicalHistory.duration),
            }),
            ...(readJsonBoolean(
              session.visit.clinicalHistory.associatedSymptoms,
              "vomiting",
            ) && {
              vomiting: readJsonBoolean(
                session.visit.clinicalHistory.associatedSymptoms,
                "vomiting",
              ),
            }),
          },
        }),
      }
    : undefined;

  return {
    id: session.id,
    status: session.status,
    currentStep: session.currentStep,
    language: session.language,
    lastActiveAt: session.lastActiveAt.toISOString(),
    ...(session.patient && { patient: serializePatient(session.patient) }),
    ...(visit && { visit }),
    ...(draft && { draft }),
  };
}

function sanitizeDraft(
  value: Prisma.JsonValue | null,
): Record<string, string> | undefined {
  if (!value || Array.isArray(value) || typeof value !== "object")
    return undefined;
  const allowed = ["complaint", "location", "duration", "vomiting"];
  const draft: Record<string, string> = {};
  for (const key of allowed) {
    const item = value[key];
    if (typeof item === "string") draft[key] = item;
  }
  return Object.keys(draft).length ? draft : undefined;
}

function readJsonValue(value: Prisma.JsonValue | null): string {
  if (!value || Array.isArray(value) || typeof value !== "object") return "";
  const item = value["value"];
  return typeof item === "string" ? item : "";
}

function readJsonBoolean(value: Prisma.JsonValue | null, key: string): string {
  if (!value || Array.isArray(value) || typeof value !== "object") return "";
  const item = value[key];
  return typeof item === "string" ? item : "";
}
