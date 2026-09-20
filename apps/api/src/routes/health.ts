import { Router } from "express";
import { createHealthController } from "../controllers/health-controller.js";
import type { HealthService } from "../services/health-service.js";

export function createHealthRouter(service: HealthService) {
  const router = Router();
  router.get("/", createHealthController(service));
  return router;
}
