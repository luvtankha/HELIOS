import type { IncomingMessage, ServerResponse } from "node:http";
import { pinoHttp } from "pino-http";
import type { Request } from "express";
import { logger } from "../config/logger.js";

export const requestLogger = pinoHttp({
  logger,
  customProps: (request) => ({ requestId: (request as Request).requestId }),
  serializers: {
    req: (request: IncomingMessage) => ({
      method: request.method,
      path: safeRoute(request.url),
    }),
    res: (response: ServerResponse) => ({ status: response.statusCode }),
  },
  customSuccessMessage: (_request, response) =>
    `Request completed ${response.statusCode}`,
});

function safeRoute(url: string | undefined) {
  return url
    ?.split("?", 1)[0]
    ?.replace(/\/[a-z0-9_-]{16,}(?=\/|$)/gi, "/:resource");
}
