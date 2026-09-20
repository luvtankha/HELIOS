import { Router } from "express";
import type { AyushOperations } from "../ayush/ayush-service.js";
import { AyushController } from "../controllers/ayush-controller.js";
import { validateBody } from "../validation/middleware.js";
import {
  ayushInputSchema,
  doctorAyushInputSchema,
} from "../validation/ayush.js";
import {
  doctorMutationRateLimit,
  doctorReadRateLimit,
  patientWriteRateLimit,
} from "../middleware/rate-limit.js";

export function createAyushRouter(service: AyushOperations) {
  const router = Router();
  const controller = new AyushController(service);
  router.get("/patients/:patientId/ayush", controller.patientView);
  router.post(
    "/patients/:patientId/ayush",
    patientWriteRateLimit,
    validateBody(ayushInputSchema),
    controller.report,
  );
  router.get(
    "/doctor/patients/:patientId/ayush",
    doctorReadRateLimit,
    controller.doctorView,
  );
  router.post(
    "/doctor/patients/:patientId/ayush",
    doctorMutationRateLimit,
    validateBody(doctorAyushInputSchema),
    controller.enter,
  );
  router.get("/doctor/ayush/:recordId", doctorReadRateLimit, controller.detail);
  return router;
}
