import { Router } from "express";
import type { ComparisonOperations } from "../comparison/comparison-service.js";
import { ComparisonController } from "../controllers/comparison-controller.js";
import {
  doctorMutationRateLimit,
  doctorReadRateLimit,
  loginRateLimit,
} from "../middleware/rate-limit.js";

export function createComparisonRouter(service: ComparisonOperations) {
  const router = Router();
  const controller = new ComparisonController(service);
  router.post("/doctor-sessions", loginRateLimit, controller.signIn);
  router.get("/doctor/patients", doctorReadRateLimit, controller.patients);
  router.post(
    "/patients/:patientId/comparisons",
    doctorMutationRateLimit,
    controller.create,
  );
  router.post(
    "/patients/:patientId/comparisons/quick",
    doctorMutationRateLimit,
    controller.quick,
  );
  router.get(
    "/patients/:patientId/comparisons",
    doctorReadRateLimit,
    controller.list,
  );
  router.get(
    "/comparisons/:id/changes/:changeId",
    doctorReadRateLimit,
    controller.change,
  );
  router.get(
    "/comparisons/:id/changes",
    doctorReadRateLimit,
    controller.changes,
  );
  router.get("/comparisons/:id", doctorReadRateLimit, controller.detail);
  return router;
}
