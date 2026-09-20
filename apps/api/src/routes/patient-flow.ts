import { Router } from "express";
import { PatientFlowController } from "../controllers/patient-flow-controller.js";
import type { PatientFlowOperations } from "../services/patient-flow-service.js";
import { validateBody } from "../validation/middleware.js";
import {
  createConsentSchema,
  createPatientSchema,
  createSessionSchema,
  createVisitSchema,
  saveComplaintSchema,
  updateProgressSchema,
} from "../validation/patient-flow.js";
import {
  patientSessionCreationRateLimit,
  patientWriteRateLimit,
} from "../middleware/rate-limit.js";

export function createPatientFlowRouter(service: PatientFlowOperations) {
  const router = Router();
  const controller = new PatientFlowController(service);

  router.get("/patients", controller.listPatients);
  router.get("/patients/:id", controller.getPatient);
  router.post(
    "/patients",
    patientWriteRateLimit,
    validateBody(createPatientSchema),
    controller.createPatient,
  );

  router.post(
    "/patient-sessions",
    patientSessionCreationRateLimit,
    validateBody(createSessionSchema),
    controller.createSession,
  );
  router.get("/patient-sessions/:id", controller.getSession);
  router.patch(
    "/patient-sessions/:id/progress",
    patientWriteRateLimit,
    validateBody(updateProgressSchema),
    controller.updateProgress,
  );
  router.post(
    "/patient-sessions/:id/submit",
    patientWriteRateLimit,
    controller.submitSession,
  );

  router.post(
    "/consents",
    patientWriteRateLimit,
    validateBody(createConsentSchema),
    controller.createConsent,
  );
  router.post(
    "/visits",
    patientWriteRateLimit,
    validateBody(createVisitSchema),
    controller.createVisit,
  );
  router.get("/visits/:id", controller.getVisit);
  router.patch(
    "/visits/:id/complaint",
    patientWriteRateLimit,
    validateBody(saveComplaintSchema),
    controller.saveComplaint,
  );

  return router;
}
