import { Router } from "express";
import { z } from "zod";
import type { DemoResetService } from "../demo/demo-reset-service.js";
import { doctorMutationRateLimit } from "../middleware/rate-limit.js";

export function createDemoResetRouter(service: DemoResetService) {
  const router = Router();
  router.get("/demo/state", async (_request, response, next) => {
    try {
      response.json({ success: true, data: await service.state() });
    } catch (error) {
      next(error);
    }
  });
  router.post(
    "/demo/reset",
    doctorMutationRateLimit,
    async (request, response, next) => {
      try {
        const confirmation = z
          .object({ confirmation: z.string() })
          .safeParse(request.body);
        const data = await service.reset(
          request.header("x-doctor-token"),
          confirmation.success ? confirmation.data.confirmation : undefined,
          request.requestId,
        );
        response.json({ success: true, data });
      } catch (error) {
        next(error);
      }
    },
  );
  return router;
}
