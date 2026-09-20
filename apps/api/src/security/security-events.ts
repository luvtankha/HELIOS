import { createHash } from "node:crypto";
import { logger } from "../config/logger.js";

export type SecurityEventType =
  | "AUTHENTICATION_FAILURE"
  | "AUTHORIZATION_FAILURE"
  | "RATE_LIMIT_EXCEEDED"
  | "CROSS_ORIGIN_MUTATION_BLOCKED"
  | "INVALID_TOKEN"
  | "INVALID_UPLOAD";

export function securityEvent(
  type: SecurityEventType,
  context: {
    requestId?: string;
    actorKey?: string;
    routeGroup?: string;
    result?: "DENIED" | "ALLOWED";
  },
) {
  logger.warn(
    {
      securityEvent: type,
      requestId: context.requestId,
      actorRef: context.actorKey ? pseudonymize(context.actorKey) : undefined,
      routeGroup: context.routeGroup,
      result: context.result ?? "DENIED",
    },
    "Security event",
  );
}

export function pseudonymize(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}
