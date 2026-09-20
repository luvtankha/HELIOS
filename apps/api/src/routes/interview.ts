import { Router } from "express";
import { InterviewController } from "../controllers/interview-controller.js";
import type { InterviewOperations } from "../services/interview-service.js";
import { validateBody } from "../validation/middleware.js";
import {
  confirmInterviewResponseSchema,
  createInterviewSchema,
  interviewResponseSchema,
  reviseInterviewSchema,
} from "../validation/interview.js";

export function createInterviewRouter(service: InterviewOperations) {
  const router = Router();
  const controller = new InterviewController(service);
  router.post("/", validateBody(createInterviewSchema), controller.create);
  router.get("/:id", controller.get);
  router.get("/:id/current-question", controller.current);
  router.post(
    "/:id/response",
    validateBody(interviewResponseSchema),
    controller.respond,
  );
  router.post(
    "/:id/confirm",
    validateBody(confirmInterviewResponseSchema),
    controller.confirm,
  );
  router.post(
    "/:id/revise",
    validateBody(reviseInterviewSchema),
    controller.revise,
  );
  router.post("/:id/complete", controller.complete);
  return router;
}
