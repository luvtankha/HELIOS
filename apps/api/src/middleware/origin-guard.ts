import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { securityEvent } from "../security/security-events.js";
import { AppError } from "../utils/app-error.js";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export const mutationOriginGuard: RequestHandler = (
  request,
  _response,
  next,
) => {
  if (safeMethods.has(request.method)) {
    next();
    return;
  }
  const origin = request.header("origin");
  if (!origin || origin === env.WEB_ORIGIN) {
    next();
    return;
  }
  securityEvent("CROSS_ORIGIN_MUTATION_BLOCKED", {
    requestId: request.requestId,
    actorKey: origin,
    routeGroup: "api-mutation",
  });
  next(new AppError("Request origin is not allowed", 403, "ORIGIN_FORBIDDEN"));
};
