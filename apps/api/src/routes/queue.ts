import { Router } from "express";
import type { QueueOperations } from "../queue/queue-service.js";
import { z } from "zod";
import {
  doctorReadRateLimit,
  queueMutationRateLimit,
} from "../middleware/rate-limit.js";

const tokenParams = z.object({ tokenId: z.string().min(1).max(128) });
const actionParams = tokenParams.extend({
  action: z.enum([
    "call",
    "recall",
    "start",
    "complete",
    "skip",
    "no-show",
    "cancel",
    "requeue",
  ]),
});
const ok = (
  response: { status(code: number): { json(value: unknown): unknown } },
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
  router.get(
    "/doctor/queue",
    doctorReadRateLimit,
    async (request, response, next) => {
      try {
        ok(
          response,
          await service.doctorQueue(request.header("x-doctor-token")),
        );
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    "/doctor/queue/call-next",
    queueMutationRateLimit,
    async (request, response, next) => {
      try {
        ok(
          response,
          await service.callNext(
            request.header("x-doctor-token"),
            request.requestId,
          ),
        );
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    "/doctor/queue/pause",
    queueMutationRateLimit,
    async (request, response, next) => {
      try {
        ok(
          response,
          await service.setPaused(
            true,
            request.header("x-doctor-token"),
            request.requestId,
          ),
        );
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    "/doctor/queue/resume",
    queueMutationRateLimit,
    async (request, response, next) => {
      try {
        ok(
          response,
          await service.setPaused(
            false,
            request.header("x-doctor-token"),
            request.requestId,
          ),
        );
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    "/doctor/tokens/:tokenId/:action",
    queueMutationRateLimit,
    async (request, response, next) => {
      try {
        const { tokenId, action } = actionParams.parse(request.params);
        ok(
          response,
          await service.act(
            tokenId,
            action,
            request.header("x-doctor-token"),
            request.requestId,
          ),
        );
      } catch (error) {
        next(error);
      }
    },
  );
  return router;
}
