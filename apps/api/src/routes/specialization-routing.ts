import { Router } from "express";
import { z } from "zod";
import type { RoutingService } from "../routing/routing-service.js";
import { patientWriteRateLimit } from "../middleware/rate-limit.js";
export function createSpecializationRoutingRouter(
  service: Pick<RoutingService, "assess" | "providers" | "select">,
) {
  const router = Router();
  router.post(
    "/patient/me/routing",
    patientWriteRateLimit,
    async (req, res, next) => {
      try {
        z.object({})
          .strict()
          .parse(req.body ?? {});
        res.json({
          success: true,
          data: await service.assess(req.header("x-session-token")),
        });
      } catch (e) {
        next(e);
      }
    },
  );
  router.get(
    "/patient/me/providers",
    patientWriteRateLimit,
    async (req, res, next) => {
      try {
        const query = z
          .object({ specialization: z.string().trim().max(100).optional() })
          .strict()
          .parse(req.query);
        res.json({
          success: true,
          data: await service.providers(
            req.header("x-session-token"),
            query.specialization,
          ),
        });
      } catch (e) {
        next(e);
      }
    },
  );
  router.post(
    "/patient/me/routing/provider",
    patientWriteRateLimit,
    async (req, res, next) => {
      try {
        const body = z
          .object({ providerId: z.string().min(1).max(128).nullable() })
          .strict()
          .parse(req.body);
        res.json({
          success: true,
          data: await service.select(
            req.header("x-session-token"),
            body.providerId,
          ),
        });
      } catch (e) {
        next(e);
      }
    },
  );
  return router;
}
