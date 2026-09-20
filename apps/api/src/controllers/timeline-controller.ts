import type { RequestHandler } from "express";
import type { TimelineOperations } from "../timeline/timeline-service.js";
import {
  timelineEventParamsSchema,
  timelinePatientParamsSchema,
  timelineQuerySchema,
} from "../validation/timeline.js";

export class TimelineController {
  constructor(private readonly service: TimelineOperations) {}

  list: RequestHandler = async (request, response, next) => {
    try {
      const { patientId } = timelinePatientParamsSchema.parse(request.params);
      const query = timelineQuerySchema.parse(request.query);
      response.json({
        success: true,
        data: await this.service.list(
          {
            patientId,
            limit: query.limit,
            sort: query.sort,
            ...(query.from && { from: query.from }),
            ...(query.to && { to: query.to }),
            ...(query.eventType && { eventType: query.eventType }),
            ...(query.category === "DOCUMENTS" && {
              eventTypes: [
                "MEDICAL_DOCUMENT" as const,
                "CONSULTATION_NOTE" as const,
                "DISCHARGE_EVENT" as const,
              ],
            }),
            ...(query.sourceType && { source: query.sourceType }),
            ...(query.verificationStatus && {
              verificationStatus: query.verificationStatus,
            }),
            ...(query.cursor && { cursor: query.cursor }),
          },
          request.header("x-session-token"),
          request.requestId,
        ),
      });
    } catch (error) {
      next(error);
    }
  };

  detail: RequestHandler = async (request, response, next) => {
    try {
      const { eventId } = timelineEventParamsSchema.parse(request.params);
      response.json({
        success: true,
        data: await this.service.detail(
          eventId,
          request.header("x-session-token"),
          request.requestId,
        ),
      });
    } catch (error) {
      next(error);
    }
  };

  rebuild: RequestHandler = async (request, response, next) => {
    try {
      const { patientId } = timelinePatientParamsSchema.parse(request.params);
      response.json({
        success: true,
        data: await this.service.rebuild(
          patientId,
          request.header("x-session-token"),
          request.requestId,
        ),
      });
    } catch (error) {
      next(error);
    }
  };
}
