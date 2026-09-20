import type { RequestHandler } from "express";
import { validateDocumentSignature } from "../middleware/document-upload.js";
import type { DocumentOperations } from "../services/document-service.js";
import { AppError } from "../utils/app-error.js";
import {
  documentFactParamsSchema,
  documentIdSchema,
  documentPatientIdSchema,
  editDocumentFactSchema,
  uploadDocumentSchema,
} from "../validation/document.js";

export class DocumentController {
  constructor(private readonly service: DocumentOperations) {}

  upload: RequestHandler = async (request, response, next) => {
    try {
      if (!request.file)
        throw new AppError(
          "Please choose a document",
          400,
          "DOCUMENT_FILE_REQUIRED",
        );
      validateDocumentSignature(request.file);
      const input = uploadDocumentSchema.parse(request.body);
      response.status(201).json({
        success: true,
        data: await this.service.upload(
          {
            sessionId: input.sessionId,
            patientId: input.patientId,
            ...(input.visitId && { visitId: input.visitId }),
            file: request.file,
          },
          request.header("x-session-token"),
        ),
      });
    } catch (error) {
      next(error);
    }
  };

  get: RequestHandler = async (request, response, next) => {
    try {
      const { id } = documentIdSchema.parse(request.params);
      response.json({
        success: true,
        data: await this.service.get(id, request.header("x-session-token")),
      });
    } catch (error) {
      next(error);
    }
  };

  list: RequestHandler = async (request, response, next) => {
    try {
      const { patientId } = documentPatientIdSchema.parse(request.params);
      response.json({
        success: true,
        data: await this.service.list(
          patientId,
          request.header("x-session-token"),
        ),
      });
    } catch (error) {
      next(error);
    }
  };

  content: RequestHandler = async (request, response, next) => {
    try {
      const { id } = documentIdSchema.parse(request.params);
      const file = await this.service.content(
        id,
        request.header("x-session-token"),
      );
      response.setHeader("Content-Type", file.mimeType);
      response.setHeader(
        "Content-Disposition",
        `inline; filename="${file.fileName.replaceAll('"', "")}"`,
      );
      response.setHeader("Cache-Control", "private, no-store");
      response.setHeader(
        "Content-Security-Policy",
        "sandbox; default-src 'none'",
      );
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.send(file.buffer);
    } catch (error) {
      next(error);
    }
  };

  process: RequestHandler = async (request, response, next) => {
    try {
      const { id } = documentIdSchema.parse(request.params);
      response.status(202).json({
        success: true,
        data: await this.service.startProcessing(
          id,
          request.header("x-session-token"),
        ),
      });
    } catch (error) {
      next(error);
    }
  };

  status: RequestHandler = async (request, response, next) => {
    try {
      const { id } = documentIdSchema.parse(request.params);
      response.json({
        success: true,
        data: await this.service.status(
          id,
          request.header("x-session-token"),
        ),
      });
    } catch (error) {
      next(error);
    }
  };

  extraction: RequestHandler = async (request, response, next) => {
    try {
      const { id } = documentIdSchema.parse(request.params);
      const document = await this.service.get(
        id,
        request.header("x-session-token"),
      );
      response.json({ success: true, data: document });
    } catch (error) {
      next(error);
    }
  };

  facts: RequestHandler = async (request, response, next) => {
    try {
      const { id } = documentIdSchema.parse(request.params);
      const document = await this.service.get(
        id,
        request.header("x-session-token"),
      );
      response.json({ success: true, data: document.facts });
    } catch (error) {
      next(error);
    }
  };

  confirmFact: RequestHandler = (request, response, next) =>
    this.factAction("confirm", request, response, next);

  editFact: RequestHandler = (request, response, next) =>
    this.factAction("edit", request, response, next);

  rejectFact: RequestHandler = (request, response, next) =>
    this.factAction("reject", request, response, next);

  overrideIdentity: RequestHandler = async (request, response, next) => {
    try {
      const { id } = documentIdSchema.parse(request.params);
      response.json({
        success: true,
        data: await this.service.overrideIdentity(
          id,
          request.header("x-session-token"),
        ),
      });
    } catch (error) {
      next(error);
    }
  };

  remove: RequestHandler = async (request, response, next) => {
    try {
      const { id } = documentIdSchema.parse(request.params);
      await this.service.remove(id, request.header("x-session-token"));
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  private async factAction(
    action: "confirm" | "edit" | "reject",
    request: Parameters<RequestHandler>[0],
    response: Parameters<RequestHandler>[1],
    next: Parameters<RequestHandler>[2],
  ) {
    try {
      const { id, factId } = documentFactParamsSchema.parse(request.params);
      const value =
        action === "edit"
          ? editDocumentFactSchema.parse(request.body).value
          : undefined;
      response.json({
        success: true,
        data: await this.service.updateFact(
          id,
          factId,
          action,
          value,
          request.header("x-session-token"),
        ),
      });
    } catch (error) {
      next(error);
    }
  }
}
