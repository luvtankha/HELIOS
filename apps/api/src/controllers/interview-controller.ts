import type { RequestHandler } from "express";
import type { InterviewOperations } from "../services/interview-service.js";
import {
  confirmInterviewResponseSchema,
  createInterviewSchema,
  interviewIdSchema,
  interviewResponseSchema,
  reviseInterviewSchema,
} from "../validation/interview.js";

export class InterviewController {
  constructor(private readonly service: InterviewOperations) {}
  private token(request: Parameters<RequestHandler>[0]) {
    return request.header("x-session-token");
  }

  create: RequestHandler = async (request, response, next) => {
    try {
      response.status(201).json({
        success: true,
        data: await this.service.create(
          createInterviewSchema.parse(request.body),
          this.token(request),
        ),
      });
    } catch (error) {
      next(error);
    }
  };
  get: RequestHandler = async (request, response, next) => {
    try {
      const { id } = interviewIdSchema.parse(request.params);
      response.json({
        success: true,
        data: await this.service.get(id, this.token(request)),
      });
    } catch (error) {
      next(error);
    }
  };
  current: RequestHandler = async (request, response, next) => {
    try {
      const { id } = interviewIdSchema.parse(request.params);
      response.json({
        success: true,
        data: await this.service.currentQuestion(id, this.token(request)),
      });
    } catch (error) {
      next(error);
    }
  };
  respond: RequestHandler = async (request, response, next) => {
    try {
      const { id } = interviewIdSchema.parse(request.params);
      response.status(201).json({
        success: true,
        data: await this.service.respond(
          id,
          interviewResponseSchema.parse(request.body),
          this.token(request),
        ),
      });
    } catch (error) {
      next(error);
    }
  };
  confirm: RequestHandler = async (request, response, next) => {
    try {
      const { id } = interviewIdSchema.parse(request.params);
      const { responseId } = confirmInterviewResponseSchema.parse(request.body);
      response.json({
        success: true,
        data: await this.service.confirm(id, responseId, this.token(request)),
      });
    } catch (error) {
      next(error);
    }
  };
  revise: RequestHandler = async (request, response, next) => {
    try {
      const { id } = interviewIdSchema.parse(request.params);
      const { field } = reviseInterviewSchema.parse(request.body);
      response.json({
        success: true,
        data: await this.service.revise(id, field, this.token(request)),
      });
    } catch (error) {
      next(error);
    }
  };
  complete: RequestHandler = async (request, response, next) => {
    try {
      const { id } = interviewIdSchema.parse(request.params);
      response.json({
        success: true,
        data: await this.service.complete(id, this.token(request)),
      });
    } catch (error) {
      next(error);
    }
  };
}
