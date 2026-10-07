import type { RequestHandler } from "express";
import type { AyushOperations } from "../ayush/ayush-service.js";
import {
  ayushInputSchema,
  ayushPatientParamsSchema,
} from "../validation/ayush.js";
export class AyushController {
  constructor(private readonly service: AyushOperations) {}
  patientView: RequestHandler = async (request, response, next) => {
    try {
      const { patientId } = ayushPatientParamsSchema.parse(request.params);
      response.json({
        success: true,
        data: await this.service.patientView(
          patientId,
          request.header("x-session-token"),
        ),
      });
    } catch (error) {
      next(error);
    }
  };
  report: RequestHandler = async (request, response, next) => {
    try {
      const { patientId } = ayushPatientParamsSchema.parse(request.params);
      const input = ayushInputSchema.parse(request.body);
      response.status(201).json({
        success: true,
        data: await this.service.report(
          patientId,
          input,
          request.header("x-session-token"),
          request.requestId,
        ),
      });
    } catch (error) {
      next(error);
    }
  };
}
