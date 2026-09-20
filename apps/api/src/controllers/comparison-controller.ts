import type { RequestHandler } from "express";
import type { ComparisonOperations } from "../comparison/comparison-service.js";
import {
  changeParamsSchema,
  comparisonChangesSchema,
  comparisonListSchema,
  comparisonParamsSchema,
  comparisonPatientParamsSchema,
  createComparisonSchema,
  doctorSessionSchema,
} from "../validation/comparison.js";

const ok = (
  response: Parameters<RequestHandler>[1],
  data: unknown,
  status = 200,
) => response.status(status).json({ success: true, data });
export class ComparisonController {
  constructor(private readonly service: ComparisonOperations) {}
  signIn: RequestHandler = async (request, response, next) => {
    try {
      const body = doctorSessionSchema.parse(request.body);
      ok(
        response,
        await this.service.signIn(body.username, body.accessCode),
        201,
      );
    } catch (error) {
      next(error);
    }
  };
  patients: RequestHandler = async (request, response, next) => {
    try {
      ok(
        response,
        await this.service.patients(request.header("x-doctor-token")),
      );
    } catch (error) {
      next(error);
    }
  };
  create: RequestHandler = async (request, response, next) => {
    try {
      const { patientId } = comparisonPatientParamsSchema.parse(request.params);
      const body = createComparisonSchema.parse(request.body);
      ok(
        response,
        await this.service.create(
          patientId,
          body.previousVisitId,
          body.currentVisitId,
          request.header("x-doctor-token"),
          request.requestId,
        ),
        201,
      );
    } catch (error) {
      next(error);
    }
  };
  quick: RequestHandler = async (request, response, next) => {
    try {
      const { patientId } = comparisonPatientParamsSchema.parse(request.params);
      ok(
        response,
        await this.service.quick(
          patientId,
          request.header("x-doctor-token"),
          request.requestId,
        ),
        201,
      );
    } catch (error) {
      next(error);
    }
  };
  detail: RequestHandler = async (request, response, next) => {
    try {
      const { id } = comparisonParamsSchema.parse(request.params);
      ok(
        response,
        await this.service.detail(
          id,
          request.header("x-doctor-token"),
          request.requestId,
        ),
      );
    } catch (error) {
      next(error);
    }
  };
  list: RequestHandler = async (request, response, next) => {
    try {
      const { patientId } = comparisonPatientParamsSchema.parse(request.params);
      const { limit } = comparisonListSchema.parse(request.query);
      ok(
        response,
        await this.service.list(
          patientId,
          limit,
          request.header("x-doctor-token"),
        ),
      );
    } catch (error) {
      next(error);
    }
  };
  changes: RequestHandler = async (request, response, next) => {
    try {
      const { id } = comparisonParamsSchema.parse(request.params);
      const query = comparisonChangesSchema.parse(request.query);
      const filters = {
        ...(query.changeType && { changeType: query.changeType }),
        ...(query.entityType && { entityType: query.entityType }),
        ...(query.needsReview !== undefined && {
          needsReview: query.needsReview,
        }),
      };
      ok(
        response,
        await this.service.changes(
          id,
          filters,
          request.header("x-doctor-token"),
        ),
      );
    } catch (error) {
      next(error);
    }
  };
  change: RequestHandler = async (request, response, next) => {
    try {
      const { id, changeId } = changeParamsSchema.parse(request.params);
      ok(
        response,
        await this.service.change(
          id,
          changeId,
          request.header("x-doctor-token"),
        ),
      );
    } catch (error) {
      next(error);
    }
  };
}
