import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

export const requestContext: RequestHandler = (request, response, next) => {
  const incoming = request.header("x-request-id");
  request.requestId = incoming?.startsWith("req_")
    ? incoming
    : `req_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  response.setHeader("x-request-id", request.requestId);
  next();
};
