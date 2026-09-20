import type { RequestHandler } from "express";
import type { HealthService } from "../services/health-service.js";

export function createHealthController(service: HealthService): RequestHandler {
  return async (_request, response, next) => {
    try {
      const data = await service.getHealth();
      response
        .status(data.status === "degraded" ? 503 : 200)
        .json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };
}
