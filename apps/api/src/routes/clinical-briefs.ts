import { Router } from "express";
import type { ClinicalBriefOperations } from "../clinical-brief/clinical-brief-service.js";
import { ClinicalBriefController } from "../controllers/clinical-brief-controller.js";
import {
  doctorMutationRateLimit,
  doctorReadRateLimit,
} from "../middleware/rate-limit.js";

export function createClinicalBriefRouter(service: ClinicalBriefOperations) {
  const router = Router();
  const controller = new ClinicalBriefController(service);
  router.post(
    "/patients/:patientId/briefs",
    doctorMutationRateLimit,
    controller.create,
  );
  router.get(
    "/patients/:patientId/briefs",
    doctorReadRateLimit,
    controller.list,
  );
  router.get(
    "/patients/:patientId/clinical-brief",
    doctorReadRateLimit,
    controller.quick,
  );
  router.post(
    "/briefs/:briefId/refresh",
    doctorMutationRateLimit,
    controller.refresh,
  );
  router.post(
    "/briefs/:briefId/review",
    doctorMutationRateLimit,
    controller.review,
  );
  router.post(
    "/briefs/:briefId/archive",
    doctorMutationRateLimit,
    controller.archive,
  );
  router.get(
    "/briefs/:briefId/evidence",
    doctorReadRateLimit,
    controller.evidence,
  );
  router.get(
    "/briefs/:briefId/claims/:claimId",
    doctorReadRateLimit,
    controller.claim,
  );
  router.get("/briefs/:briefId", doctorReadRateLimit, controller.detail);
  return router;
}
