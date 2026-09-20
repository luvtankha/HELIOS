import { Router } from "express";
import { TimelineController } from "../controllers/timeline-controller.js";
import type { TimelineOperations } from "../timeline/timeline-service.js";

export function createTimelineRouter(service: TimelineOperations) {
  const router = Router();
  const controller = new TimelineController(service);
  router.get("/patients/:patientId/timeline", controller.list);
  router.post("/patients/:patientId/timeline/rebuild", controller.rebuild);
  router.get("/timeline/:eventId", controller.detail);
  return router;
}
