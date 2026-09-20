import type { RequestHandler } from "express";
import type { VerificationAction } from "@prisma/client";
import type { VerificationOperations } from "../verification/verification-service.js";
import {
  bulkVerificationSchema,
  verificationActionSchema,
  verificationDocumentParamsSchema,
  verificationHistorySchema,
  verificationParamsSchema,
  verificationPatientParamsSchema,
  verificationQueueSchema,
} from "../validation/verification.js";

const ok = (
  response: Parameters<RequestHandler>[1],
  data: unknown,
  status = 200,
) => response.status(status).json({ success: true, data });

export class VerificationController {
  constructor(private readonly service: VerificationOperations) {}

  queue: RequestHandler = async (request, response, next) => {
    try {
      const query = verificationQueueSchema.parse(request.query);
      ok(
        response,
        await this.service.queue(
          undefined,
          compactFilters(query),
          request.header("x-doctor-token"),
        ),
      );
    } catch (error) {
      next(error);
    }
  };

  patientQueue: RequestHandler = async (request, response, next) => {
    try {
      const { patientId } = verificationPatientParamsSchema.parse(
        request.params,
      );
      const query = verificationQueueSchema.parse(request.query);
      ok(
        response,
        await this.service.queue(
          patientId,
          compactFilters(query),
          request.header("x-doctor-token"),
        ),
      );
    } catch (error) {
      next(error);
    }
  };

  detail: RequestHandler = async (request, response, next) => {
    try {
      const { verificationId } = verificationParamsSchema.parse(request.params);
      const patientId =
        typeof request.query.patientId === "string"
          ? request.query.patientId
          : undefined;
      ok(
        response,
        await this.service.detail(
          verificationId,
          patientId,
          request.header("x-doctor-token"),
        ),
      );
    } catch (error) {
      next(error);
    }
  };

  action(action: VerificationAction): RequestHandler {
    return async (request, response, next) => {
      try {
        const { verificationId } = verificationParamsSchema.parse(
          request.params,
        );
        const body = verificationActionSchema.parse(request.body);
        ok(
          response,
          await this.service.act(
            verificationId,
            action,
            {
              expectedVersion: body.expectedVersion,
              idempotencyKey: body.idempotencyKey,
              ...(body.reason && { reason: body.reason }),
              ...(body.comment && { comment: body.comment }),
              ...(body.correctedValue && {
                correctedValue: body.correctedValue,
              }),
            },
            request.header("x-doctor-token"),
            request.requestId,
          ),
          201,
        );
      } catch (error) {
        next(error);
      }
    };
  }

  history: RequestHandler = async (request, response, next) => {
    try {
      const { patientId } = verificationPatientParamsSchema.parse(
        request.params,
      );
      const { limit } = verificationHistorySchema.parse(request.query);
      ok(
        response,
        await this.service.history(
          patientId,
          limit,
          request.header("x-doctor-token"),
        ),
      );
    } catch (error) {
      next(error);
    }
  };

  bulkVerify: RequestHandler = async (request, response, next) => {
    try {
      const body = bulkVerificationSchema.parse(request.body);
      ok(
        response,
        await this.service.bulkVerify(
          body.reviewIds,
          body.expectedVersions,
          body.idempotencyKey,
          request.header("x-doctor-token"),
          request.requestId,
        ),
        201,
      );
    } catch (error) {
      next(error);
    }
  };

  document: RequestHandler = async (request, response, next) => {
    try {
      const { documentId } = verificationDocumentParamsSchema.parse(
        request.params,
      );
      ok(
        response,
        await this.service.document(
          documentId,
          request.header("x-doctor-token"),
        ),
      );
    } catch (error) {
      next(error);
    }
  };

  documentContent: RequestHandler = async (request, response, next) => {
    try {
      const { documentId } = verificationDocumentParamsSchema.parse(
        request.params,
      );
      const file = await this.service.documentContent(
        documentId,
        request.header("x-doctor-token"),
      );
      response.setHeader("Content-Type", file.mimeType);
      response.setHeader(
        "Content-Disposition",
        `inline; filename="${file.fileName.replaceAll('"', "")}"`,
      );
      response.setHeader("Cache-Control", "private, no-store");
      response.send(file.buffer);
    } catch (error) {
      next(error);
    }
  };
}

function compactFilters(
  query: ReturnType<typeof verificationQueueSchema.parse>,
) {
  return {
    limit: query.limit,
    ...(query.status && { status: query.status }),
    ...(query.factType && { factType: query.factType }),
    ...(query.conflictsOnly !== undefined && {
      conflictsOnly: query.conflictsOnly,
    }),
    ...(query.search && { search: query.search }),
  };
}
