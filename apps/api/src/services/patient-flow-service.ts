import { randomUUID } from "node:crypto";
import type {
  PatientFlowStep,
  PatientSessionDto,
  PatientSex,
} from "@helios/shared";
import { AppError } from "../utils/app-error.js";
import type { ConsentRepository } from "../repositories/consent-repository.js";
import type { IntakeRepository } from "../repositories/intake-repository.js";
import type { PatientRepository } from "../repositories/patient-repository.js";
import type { SessionRepository } from "../repositories/session-repository.js";
import type { VisitRepository } from "../repositories/visit-repository.js";
import { serializePatient } from "../serializers/patient.js";
import { serializeSession } from "../serializers/session.js";
import {
  sessionProof,
  type SessionProofService,
} from "../security/session-proof.js";
import type { QueueOperations } from "../queue/queue-service.js";

export interface RoutingEmergencyOperations {
  assess(token?: string): Promise<{
    recommendation: { emergencyEscalation: boolean; reason: string };
  }>;
}

export interface PatientInput {
  sessionId: string;
  fullName: string;
  age: number;
  sex: PatientSex;
  preferredLanguage: string;
  phone?: string | undefined;
}

export interface HealthDetails {
  location?: string | undefined;
  duration?: string | undefined;
  vomiting?: string | undefined;
}

export interface PatientFlowOperations {
  listPatients(token?: string): Promise<unknown[]>;
  getPatient(id: string, token?: string): Promise<unknown>;
  createSession(language: string): Promise<PatientSessionDto>;
  getSession(id: string, token?: string): Promise<PatientSessionDto>;
  updateProgress(
    id: string,
    input: {
      currentStep: PatientFlowStep;
      language?: string | undefined;
      draftData?: Record<string, string> | undefined;
    },
    token?: string,
  ): Promise<PatientSessionDto>;
  recordConsent(
    input: {
      sessionId: string;
      consentType: string;
      accepted: true;
      version: string;
    },
    token?: string,
  ): Promise<{ id: string; accepted: boolean; acceptedAt: string }>;
  createPatient(
    input: PatientInput,
    token?: string,
  ): Promise<{ patient: unknown; visitId: string }>;
  createVisit(
    input: {
      patientId: string;
      visitType: "PRE_CONSULTATION" | "FOLLOW_UP";
      sessionId?: string | undefined;
    },
    token?: string,
  ): Promise<unknown>;
  getVisit(id: string, token?: string): Promise<unknown>;
  saveComplaint(
    id: string,
    chiefComplaint: string,
    healthDetails: HealthDetails,
    token?: string,
  ): Promise<unknown>;
  submitSession(id: string, token?: string): Promise<PatientSessionDto>;
}

export class PatientFlowService implements PatientFlowOperations {
  constructor(
    private readonly patients: PatientRepository,
    private readonly sessions: SessionRepository,
    private readonly visits: VisitRepository,
    private readonly consents: ConsentRepository,
    private readonly intake: IntakeRepository,
    private readonly proof: SessionProofService = sessionProof,
    private readonly queue?: QueueOperations,
    private readonly routing?: RoutingEmergencyOperations,
  ) {}

  async listPatients(token?: string) {
    const session = await this.sessionForToken(token);
    if (!session.patientId) return [];
    const patient = await this.patients.findById(session.patientId);
    return patient ? [serializePatient(patient)] : [];
  }

  async getPatient(id: string, token?: string) {
    const session = await this.sessionForToken(token);
    if (session.patientId !== id) this.denied();
    const patient = await this.patients.findById(id);
    if (!patient)
      throw new AppError("Patient not found", 404, "PATIENT_NOT_FOUND");
    return serializePatient(patient);
  }

  async createSession(language: string) {
    const session = await this.sessions.create(language);
    const hydrated = await this.sessions.findById(session.id);
    if (!hydrated) throw new AppError("Session could not be created", 500);
    return {
      ...serializeSession(hydrated),
      sessionToken: this.proof.create(session.id),
    };
  }

  async getSession(id: string, token?: string) {
    await this.sessionForToken(token, id);
    return this.loadSession(id);
  }

  private async loadSession(id: string) {
    const session = await this.sessions.findById(id);
    if (!session)
      throw new AppError("Session not found", 404, "SESSION_NOT_FOUND");
    return serializeSession(session);
  }

  async updateProgress(
    id: string,
    input: {
      currentStep: PatientFlowStep;
      language?: string | undefined;
      draftData?: Record<string, string> | undefined;
    },
    token?: string,
  ) {
    const session = await this.sessionForToken(token, id);
    if (input.currentStep === "SUBMITTED" || input.currentStep === "COMPLETE")
      throw new AppError(
        "This step is set by the server after submission",
        409,
        "SESSION_TRANSITION_INVALID",
      );
    if (
      input.currentStep === "REVIEW" &&
      (!session.visitId || !session.visit?.clinicalHistory?.chiefComplaint)
    )
      throw new AppError(
        "Complete the complaint before review",
        409,
        "SESSION_TRANSITION_INVALID",
      );
    await this.sessions.updateProgress(id, {
      currentStep: input.currentStep,
      status:
        input.currentStep === "REVIEW" ? "READY_FOR_REVIEW" : "IN_PROGRESS",
      ...(input.language && { language: input.language }),
      ...(input.draftData && { draftData: input.draftData }),
    });
    return this.loadSession(id);
  }

  async recordConsent(
    input: {
      sessionId: string;
      consentType: string;
      accepted: true;
      version: string;
    },
    token?: string,
  ) {
    const session = serializeSession(
      await this.sessionForToken(token, input.sessionId),
    );
    const consent = await this.consents.create({
      ...input,
      ...(session.patient?.id && { patientId: session.patient.id }),
    });
    await this.sessions.updateProgress(input.sessionId, {
      currentStep: "BASIC_INFO",
      status: "IN_PROGRESS",
    });
    return {
      id: consent.id,
      accepted: consent.accepted,
      acceptedAt: consent.acceptedAt.toISOString(),
    };
  }

  async createPatient(input: PatientInput, token?: string) {
    const session = serializeSession(
      await this.sessionForToken(token, input.sessionId),
    );
    if (session.patient)
      throw new AppError(
        "Patient details have already been saved",
        409,
        "PATIENT_EXISTS",
      );
    if (!(await this.consents.hasActivePreConsultationConsent(input.sessionId)))
      throw new AppError(
        "Consent is required before saving patient details",
        403,
        "CONSENT_REQUIRED",
      );
    const { patient, visit } = await this.intake.createPatientVisit({
      sessionId: input.sessionId,
      patientCode: `DEMO-${randomUUID().slice(0, 8).toUpperCase()}`,
      fullName: input.fullName,
      age: input.age,
      sex: input.sex,
      preferredLanguage: input.preferredLanguage,
      ...(input.phone && { phone: input.phone }),
    });
    return { patient: serializePatient(patient), visitId: visit.id };
  }

  async createVisit(
    input: {
      patientId: string;
      visitType: "PRE_CONSULTATION" | "FOLLOW_UP";
      sessionId?: string | undefined;
    },
    token?: string,
  ) {
    if (!input.sessionId)
      throw new AppError(
        "Patient session is required",
        403,
        "PATIENT_SESSION_REQUIRED",
      );
    const session = await this.sessionForToken(token, input.sessionId);
    if (session.patientId !== input.patientId) this.denied();
    if (session.visitId)
      throw new AppError(
        "A visit is already linked to this session",
        409,
        "VISIT_EXISTS",
      );
    const visit = await this.visits.create(input.patientId, input.visitType);
    if (input.sessionId)
      await this.sessions.attachPatientAndVisit(
        input.sessionId,
        input.patientId,
        visit.id,
      );
    return {
      id: visit.id,
      status: visit.status,
      startedAt: visit.startedAt.toISOString(),
    };
  }

  async getVisit(id: string, token?: string) {
    const session = await this.sessionForToken(token);
    if (session.visitId !== id) this.denied();
    const visit = await this.visits.findById(id);
    if (!visit) throw new AppError("Visit not found", 404, "VISIT_NOT_FOUND");
    return {
      id: visit.id,
      patientId: visit.patientId,
      status: visit.status,
      startedAt: visit.startedAt.toISOString(),
      ...(visit.clinicalHistory?.chiefComplaint && {
        chiefComplaint: visit.clinicalHistory.chiefComplaint,
      }),
    };
  }

  async saveComplaint(
    id: string,
    chiefComplaint: string,
    healthDetails: HealthDetails,
    token?: string,
  ) {
    const session = await this.sessionForToken(token);
    if (session.visitId !== id) this.denied();
    const visit = await this.visits.saveComplaint(
      id,
      chiefComplaint,
      healthDetails,
    );
    return {
      id: visit.id,
      chiefComplaint: visit.clinicalHistory?.chiefComplaint,
      healthDetails,
    };
  }

  async submitSession(id: string, token?: string) {
    if (this.proof.verify(token) !== id)
      throw new AppError(
        "Patient session access denied",
        403,
        "PATIENT_SESSION_FORBIDDEN",
      );
    const session = await this.loadSession(id);
    if (!session.patient || !session.visit) {
      throw new AppError(
        "Please complete your information before submitting",
        400,
        "SESSION_INCOMPLETE",
      );
    }
    if (!session.visit.chiefComplaint) {
      throw new AppError(
        "Please tell us what you are experiencing before submitting",
        400,
        "COMPLAINT_REQUIRED",
      );
    }
    if (!this.queue)
      throw new AppError("Queue service unavailable", 503, "QUEUE_UNAVAILABLE");
    if (this.routing) {
      const assessment = await this.routing.assess(token);
      if (assessment.recommendation.emergencyEscalation)
        throw new AppError(
          assessment.recommendation.reason,
          409,
          "ROUTING_EMERGENCY",
        );
    }
    await this.queue.checkIn(token);
    return this.loadSession(id);
  }

  private async sessionForToken(token?: string, expectedId?: string) {
    const id = this.proof.verify(token);
    if (expectedId && id !== expectedId) this.denied();
    const session = await this.sessions.findById(id);
    if (!session)
      throw new AppError("Session not found", 404, "SESSION_NOT_FOUND");
    return session;
  }

  private denied(): never {
    throw new AppError(
      "Patient session access denied",
      403,
      "PATIENT_SESSION_FORBIDDEN",
    );
  }
}
