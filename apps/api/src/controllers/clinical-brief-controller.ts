import type { RequestHandler } from "express";
import type { ClinicalBriefOperations } from "../clinical-brief/clinical-brief-service.js";
import {
  briefClaimParamsSchema,
  briefListSchema,
  briefParamsSchema,
  briefPatientParamsSchema,
  createBriefSchema,
  quickBriefSchema,
} from "../validation/clinical-brief.js";

export class ClinicalBriefController {
  constructor(private readonly service: ClinicalBriefOperations) {}

  create: RequestHandler = async (request, response, next) => {
    try {
      const { patientId } = briefPatientParamsSchema.parse(request.params);
      const { visitId } = createBriefSchema.parse(request.body);
      response.status(201).json({
        success: true,
        data: await this.service.generate(
          patientId,
          visitId,
          request.header("x-doctor-token"),
          request.requestId,
        ),
      });
    } catch (error) {
      next(error);
    }
  };
  quick: RequestHandler = async (request, response, next) => {
    try {
      const { patientId } = briefPatientParamsSchema.parse(request.params);
      const query = quickBriefSchema.parse(request.query);
      response.json({
        success: true,
        data: await this.service.quick(
          patientId,
          query.visitId,
          request.header("x-doctor-token"),
          request.requestId,
        ),
      });
    } catch (error) {
      next(error);
    }
  };
  detail: RequestHandler = async (request, response, next) => {
    try {
      const { briefId } = briefParamsSchema.parse(request.params);
      response.json({
        success: true,
        data: await this.service.detail(
          briefId,
          request.header("x-doctor-token"),
          request.requestId,
        ),
      });
    } catch (error) {
      next(error);
    }
  };
  list: RequestHandler = async (request, response, next) => {
    try {
      const { patientId } = briefPatientParamsSchema.parse(request.params);
      const { limit } = briefListSchema.parse(request.query);
      response.json({
        success: true,
        data: await this.service.list(
          patientId,
          limit,
          request.header("x-doctor-token"),
        ),
      });
    } catch (error) {
      next(error);
    }
  };
  refresh: RequestHandler = async (request, response, next) => {
    try {
      const { briefId } = briefParamsSchema.parse(request.params);
      response.json({
        success: true,
        data: await this.service.refresh(
          briefId,
          request.header("x-doctor-token"),
          request.requestId,
        ),
      });
    } catch (error) {
      next(error);
    }
  };
  evidence: RequestHandler = async (request, response, next) => {
    try {
      const { briefId } = briefParamsSchema.parse(request.params);
      response.json({
        success: true,
        data: await this.service.evidence(
          briefId,
          request.header("x-doctor-token"),
        ),
      });
    } catch (error) {
      next(error);
    }
  };
  claim: RequestHandler = async (request, response, next) => {
    try {
      const { briefId, claimId } = briefClaimParamsSchema.parse(request.params);
      response.json({
        success: true,
        data: await this.service.claim(
          briefId,
          claimId,
          request.header("x-doctor-token"),
          request.requestId,
        ),
      });
    } catch (error) {
      next(error);
    }
  };
  review: RequestHandler = async (request, response, next) => {
    try {
      const { briefId } = briefParamsSchema.parse(request.params);
      response.json({
        success: true,
        data: await this.service.review(
          briefId,
          request.header("x-doctor-token"),
          request.requestId,
        ),
      });
    } catch (error) {
      next(error);
    }
  };
  archive: RequestHandler = async (request, response, next) => {
    try {
      const { briefId } = briefParamsSchema.parse(request.params);
      response.json({
        success: true,
        data: await this.service.archive(
          briefId,
          request.header("x-doctor-token"),
          request.requestId,
        ),
      });
    } catch (error) {
      next(error);
    }
  };
}
