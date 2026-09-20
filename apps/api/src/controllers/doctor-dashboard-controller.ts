import type { RequestHandler } from "express";
import type { DoctorDashboardOperations } from "../doctor-dashboard/doctor-dashboard-service.js";
import {
  doctorDashboardQuerySchema,
  doctorNoteCreateSchema,
  doctorNoteParamsSchema,
  doctorNoteUpdateSchema,
  doctorPatientParamsSchema,
  doctorVisitParamsSchema,
  doctorVisitTransitionSchema,
  doctorWorkspaceQuerySchema,
} from "../validation/doctor-dashboard.js";

const ok = (
  response: Parameters<RequestHandler>[1],
  data: unknown,
  status = 200,
) => response.status(status).json({ success: true, data });

export class DoctorDashboardController {
  constructor(private readonly service: DoctorDashboardOperations) {}

  dashboard: RequestHandler = async (request, response, next) => {
    try {
      const query = doctorDashboardQuerySchema.parse(request.query);
      ok(
        response,
        await this.service.dashboard(
          {
            sort: query.sort,
            direction: query.direction,
            page: query.page,
            limit: query.limit,
            ...(query.search && { search: query.search }),
            ...(query.status && { status: query.status }),
          },
          request.header("x-doctor-token"),
        ),
      );
    } catch (error) {
      next(error);
    }
  };

  workspace: RequestHandler = async (request, response, next) => {
    try {
      const { patientId } = doctorPatientParamsSchema.parse(request.params);
      const { visitId } = doctorWorkspaceQuerySchema.parse(request.query);
      ok(
        response,
        await this.service.workspace(
          patientId,
          visitId,
          request.header("x-doctor-token"),
          request.requestId,
        ),
      );
    } catch (error) {
      next(error);
    }
  };

  notes: RequestHandler = async (request, response, next) => {
    try {
      const { patientId } = doctorPatientParamsSchema.parse(request.params);
      ok(
        response,
        await this.service.notes(patientId, request.header("x-doctor-token")),
      );
    } catch (error) {
      next(error);
    }
  };

  createNote: RequestHandler = async (request, response, next) => {
    try {
      const { patientId } = doctorPatientParamsSchema.parse(request.params);
      const body = doctorNoteCreateSchema.parse(request.body);
      ok(
        response,
        await this.service.createNote(
          patientId,
          {
            content: body.content,
            ...(body.visitId && { visitId: body.visitId }),
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

  updateNote: RequestHandler = async (request, response, next) => {
    try {
      const { patientId, noteId } = doctorNoteParamsSchema.parse(
        request.params,
      );
      const { content } = doctorNoteUpdateSchema.parse(request.body);
      ok(
        response,
        await this.service.updateNote(
          patientId,
          noteId,
          content,
          request.header("x-doctor-token"),
          request.requestId,
        ),
      );
    } catch (error) {
      next(error);
    }
  };

  transitionVisit: RequestHandler = async (request, response, next) => {
    try {
      const { visitId } = doctorVisitParamsSchema.parse(request.params);
      const { status } = doctorVisitTransitionSchema.parse(request.body);
      ok(
        response,
        await this.service.transitionVisit(
          visitId,
          status,
          request.header("x-doctor-token"),
          request.requestId,
        ),
      );
    } catch (error) {
      next(error);
    }
  };
}
