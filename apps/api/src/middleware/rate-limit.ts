import type { RequestHandler } from "express";
import { createHash } from "node:crypto";
import { AppError } from "../utils/app-error.js";
import { securityEvent } from "../security/security-events.js";
type Bucket = {
  count: number;
  resetsAt: number;
};
const stores = new Map<string, Map<string, Bucket>>();
export function rateLimit(options: {
  name: string;
  maximum: number;
  windowMs: number;
  message?: string;
}): RequestHandler {
  const store = stores.get(options.name) ?? new Map<string, Bucket>();
  stores.set(options.name, store);
  return (request, response, next) => {
    const now = Date.now();
    if (store.size > 10000)
      for (const [entryKey, bucket] of store)
        if (bucket.resetsAt <= now) store.delete(entryKey);
    // Never let a caller evade throttling by inventing a fresh token header.
    const rawKey = request.ip ?? "unknown";
    const key = createHash("sha256").update(rawKey).digest("hex");
    const current = store.get(key);
    if (!current || current.resetsAt <= now) {
      store.set(key, { count: 1, resetsAt: now + options.windowMs });
      next();
      return;
    }
    current.count += 1;
    if (current.count <= options.maximum) {
      next();
      return;
    }
    response.setHeader(
      "Retry-After",
      String(Math.max(1, Math.ceil((current.resetsAt - now) / 1000))),
    );
    securityEvent("RATE_LIMIT_EXCEEDED", {
      requestId: request.requestId,
      actorKey: rawKey,
      routeGroup: options.name,
    });
    next(
      new AppError(
        options.message ?? "Too many requests. Please wait and try again.",
        429,
        "RATE_LIMITED",
      ),
    );
  };
}
export const patientWriteRateLimit = rateLimit({
  name: "patient-write",
  maximum: 60,
  windowMs: 60000,
});
export const patientSessionCreationRateLimit = rateLimit({
  name: "patient-session-creation",
  maximum: 10,
  windowMs: 60000,
});
export const voiceRateLimit = rateLimit({
  name: "voice-expensive",
  maximum: 10,
  windowMs: 60000,
});
export const documentRateLimit = rateLimit({
  name: "document-expensive",
  maximum: 20,
  windowMs: 60000,
});
export const queueMutationRateLimit = rateLimit({
  name: "queue-mutation",
  maximum: 30,
  windowMs: 60000,
});
export function resetRateLimitsForTests() {
  for (const store of stores.values()) store.clear();
}
