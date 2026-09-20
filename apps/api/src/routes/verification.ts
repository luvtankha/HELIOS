import { Router } from "express";
import { VerificationController } from "../controllers/verification-controller.js";
import type { VerificationOperations } from "../verification/verification-service.js";
import {
  doctorMutationRateLimit,
  doctorReadRateLimit,
} from "../middleware/rate-limit.js";

export function createVerificationRouter(service: VerificationOperations) {
  const router = Router();
  const controller = new VerificationController(service);
  router.get("/verification-queue", doctorReadRateLimit, controller.queue);
  router.get(
    "/patients/:patientId/verification-queue",
    doctorReadRateLimit,
    controller.patientQueue,
  );
  router.get(
    "/patients/:patientId/verification-history",
    doctorReadRateLimit,
    controller.history,
  );
  router.post(
    "/verification/bulk-verify",
    doctorMutationRateLimit,
    controller.bulkVerify,
  );
  router.get(
    "/verification/documents/:documentId/content",
    doctorReadRateLimit,
    controller.documentContent,
  );
  router.get(
    "/verification/documents/:documentId",
    doctorReadRateLimit,
    controller.document,
  );
  router.get(
    "/verification/:verificationId",
    doctorReadRateLimit,
    controller.detail,
  );
  router.post(
    "/verification/:verificationId/verify",
    doctorMutationRateLimit,
    controller.action("VERIFY"),
  );
  router.post(
    "/verification/:verificationId/correct",
    doctorMutationRateLimit,
    controller.action("CORRECT"),
  );
  router.post(
    "/verification/:verificationId/reject",
    doctorMutationRateLimit,
    controller.action("REJECT"),
  );
  router.post(
    "/verification/:verificationId/uncertain",
    doctorMutationRateLimit,
    controller.action("MARK_UNCERTAIN"),
  );
  router.post(
    "/verification/:verificationId/confirm-current",
    doctorMutationRateLimit,
    controller.action("CONFIRM_CURRENT"),
  );
  router.post(
    "/verification/:verificationId/keep-previous",
    doctorMutationRateLimit,
    controller.action("KEEP_PREVIOUS"),
  );
  return router;
}
