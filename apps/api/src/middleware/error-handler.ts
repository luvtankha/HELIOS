import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { AppError } from "../utils/app-error.js";
import { securityEvent } from "../security/security-events.js";

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  void request;
  next(new AppError("Route not found", 404, "NOT_FOUND"));
};

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  request,
  response,
  _next,
) => {
  void _next;
  let appError =
    error instanceof AppError ? error : new AppError("Something went wrong");
  if (error instanceof ZodError) {
    appError = new AppError(
      "Invalid request",
      400,
      "VALIDATION_ERROR",
      error.flatten(),
    );
  }
  if (
    !(error instanceof AppError) &&
    error instanceof Error &&
    "status" in error &&
    error.status === 413
  ) {
    appError = new AppError("Request body is too large", 413, "BODY_TOO_LARGE");
  } else if (
    !(error instanceof AppError) &&
    error instanceof SyntaxError &&
    "status" in error &&
    error.status === 400
  ) {
    appError = new AppError("Malformed request body", 400, "MALFORMED_BODY");
  }

  logger.error(
    {
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorCode: appError.code,
      requestId: request.requestId,
      method: request.method,
      routeGroup: request.path.split("/").slice(0, 3).join("/"),
    },
    "Request failed",
  );
  if (appError.statusCode === 401 || appError.statusCode === 403) {
    const actorKey =
      request.header("x-doctor-token") ??
      request.header("x-session-token") ??
      request.ip;
    securityEvent(
      appError.statusCode === 401
        ? "AUTHENTICATION_FAILURE"
        : "AUTHORIZATION_FAILURE",
      {
        requestId: request.requestId,
        ...(actorKey && { actorKey }),
        routeGroup: request.path.split("/").slice(0, 3).join("/"),
      },
    );
  }

  response.status(appError.statusCode).json({
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      requestId: request.requestId,
      ...(env.NODE_ENV !== "production" &&
        appError.details !== undefined && { details: appError.details }),
      ...(env.NODE_ENV !== "production" &&
        error instanceof Error && { debug: error.name }),
    },
  });
};
