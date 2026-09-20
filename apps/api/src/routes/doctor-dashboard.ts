import { Router } from "express";
import { DoctorDashboardController } from "../controllers/doctor-dashboard-controller.js";
import type { DoctorDashboardOperations } from "../doctor-dashboard/doctor-dashboard-service.js";
import {
  doctorMutationRateLimit,
  doctorReadRateLimit,
} from "../middleware/rate-limit.js";

export function createDoctorDashboardRouter(
  service: DoctorDashboardOperations,
) {
  const router = Router();
  const controller = new DoctorDashboardController(service);
  router.get("/doctor/dashboard", doctorReadRateLimit, controller.dashboard);
  router.get(
    "/doctor/patients/:patientId/workspace",
    doctorReadRateLimit,
    controller.workspace,
  );
  router.get(
    "/doctor/patients/:patientId/notes",
    doctorReadRateLimit,
    controller.notes,
  );
  router.post(
    "/doctor/patients/:patientId/notes",
    doctorMutationRateLimit,
    controller.createNote,
  );
  router.patch(
    "/doctor/patients/:patientId/notes/:noteId",
    doctorMutationRateLimit,
    controller.updateNote,
  );
  router.post(
    "/doctor/visits/:visitId/status",
    doctorMutationRateLimit,
    controller.transitionVisit,
  );
  return router;
}
