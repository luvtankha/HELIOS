import type { RequestHandler } from "express";
import type { PatientFlowOperations } from "../services/patient-flow-service.js";
import {
  createConsentSchema,
  createPatientSchema,
  createSessionSchema,
  createVisitSchema,
  idParamSchema,
  saveComplaintSchema,
  updateProgressSchema,
} from "../validation/patient-flow.js";

export class PatientFlowController {
  constructor(private readonly service: PatientFlowOperations) {}

  listPatients: RequestHandler = async (request, response, next) => {
    try {
      response.json({
        success: true,
        data: await this.service.listPatients(
          request.header("x-session-token"),
        ),
      });
    } catch (error) {
      next(error);
    }
  };

  getPatient: RequestHandler = async (request, response, next) => {
    try {
      const { id } = idParamSchema.parse(request.params);
      response.json({
        success: true,
        data: await this.service.getPatient(
          id,
          request.header("x-session-token"),
        ),
      });
    } catch (error) {
      next(error);
    }
  };

  createPatient: RequestHandler = async (request, response, next) => {
    try {
      const input = createPatientSchema.parse(request.body);
      response
        .status(201)
        .json({
          success: true,
          data: await this.service.createPatient(
            input,
            request.header("x-session-token"),
          ),
        });
    } catch (error) {
      next(error);
    }
  };

  createSession: RequestHandler = async (request, response, next) => {
    try {
      const input = createSessionSchema.parse(request.body);
      response.status(201).json({
        success: true,
        data: await this.service.createSession(input.language),
      });
    } catch (error) {
      next(error);
    }
  };

  getSession: RequestHandler = async (request, response, next) => {
    try {
      const { id } = idParamSchema.parse(request.params);
      response.json({
        success: true,
        data: await this.service.getSession(
          id,
          request.header("x-session-token"),
        ),
      });
    } catch (error) {
      next(error);
    }
  };

  updateProgress: RequestHandler = async (request, response, next) => {
    try {
      const { id } = idParamSchema.parse(request.params);
      const input = updateProgressSchema.parse(request.body);
      response.json({
        success: true,
        data: await this.service.updateProgress(
          id,
          {
            currentStep: input.currentStep,
            ...(input.language && { language: input.language }),
            ...(input.draftData && { draftData: input.draftData }),
          },
          request.header("x-session-token"),
        ),
      });
    } catch (error) {
      next(error);
    }
  };

  createConsent: RequestHandler = async (request, response, next) => {
    try {
      const input = createConsentSchema.parse(request.body);
      response
        .status(201)
        .json({
          success: true,
          data: await this.service.recordConsent(
            input,
            request.header("x-session-token"),
          ),
        });
    } catch (error) {
      next(error);
    }
  };

  createVisit: RequestHandler = async (request, response, next) => {
    try {
      const input = createVisitSchema.parse(request.body);
      response.status(201).json({
        success: true,
        data: await this.service.createVisit(
          {
            patientId: input.patientId,
            visitType: input.visitType,
            ...(input.sessionId && { sessionId: input.sessionId }),
          },
          request.header("x-session-token"),
        ),
      });
    } catch (error) {
      next(error);
    }
  };

  getVisit: RequestHandler = async (request, response, next) => {
    try {
      const { id } = idParamSchema.parse(request.params);
      response.json({
        success: true,
        data: await this.service.getVisit(
          id,
          request.header("x-session-token"),
        ),
      });
    } catch (error) {
      next(error);
    }
  };

  saveComplaint: RequestHandler = async (request, response, next) => {
    try {
      const { id } = idParamSchema.parse(request.params);
      const input = saveComplaintSchema.parse(request.body);
      response.json({
        success: true,
        data: await this.service.saveComplaint(
          id,
          input.chiefComplaint,
          input.healthDetails,
          request.header("x-session-token"),
        ),
      });
    } catch (error) {
      next(error);
    }
  };

  submitSession: RequestHandler = async (request, response, next) => {
    try {
      const { id } = idParamSchema.parse(request.params);
      response.json({
        success: true,
        data: await this.service.submitSession(
          id,
          request.header("x-session-token"),
        ),
      });
    } catch (error) {
      next(error);
    }
  };
}
