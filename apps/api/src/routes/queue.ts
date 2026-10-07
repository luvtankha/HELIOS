import { Router } from "express";
import type { QueueOperations } from "../queue/queue-service.js";
import { queueMutationRateLimit } from "../middleware/rate-limit.js";
const ok = (
  response: {
    status(code: number): {
      json(value: unknown): unknown;
    };
  },
  data: unknown,
  code = 200,
) => response.status(code).json({ success: true, data });
export function createQueueRouter(service: QueueOperations) {
  const router = Router();
  router.post(
    "/patient/check-in",
    queueMutationRateLimit,
    async (request, response, next) => {
      try {
        ok(
          response,
          await service.checkIn(request.header("x-session-token")),
          201,
        );
      } catch (error) {
        next(error);
      }
    },
  );
  router.get("/patient/me/queue-status", async (request, response, next) => {
    try {
      ok(
        response,
        await service.patientStatus(request.header("x-session-token")),
      );
    } catch (error) {
      next(error);
    }
  });
  return router;
}
