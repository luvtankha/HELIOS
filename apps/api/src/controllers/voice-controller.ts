import type { RequestHandler } from "express";
import type { VoiceOperations } from "../services/voice-service.js";
import {
  editTranscriptSchema,
  transcribeFieldsSchema,
  voiceIdParamSchema,
} from "../validation/voice.js";

export class VoiceController {
  constructor(private readonly service: VoiceOperations) {}

  transcribe: RequestHandler = async (request, response, next) => {
    try {
      const fields = transcribeFieldsSchema.parse(request.body);
      const sessionToken = request.header("x-session-token");
      const data = await this.service.transcribe({
        ...fields,
        ...(sessionToken && { sessionToken }),
        ...(request.file && { file: request.file }),
      });
      response.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  get: RequestHandler = async (request, response, next) => {
    try {
      const { id } = voiceIdParamSchema.parse(request.params);
      response.json({
        success: true,
        data: await this.service.get(id, request.header("x-session-token")),
      });
    } catch (error) {
      next(error);
    }
  };

  edit: RequestHandler = async (request, response, next) => {
    try {
      const { id } = voiceIdParamSchema.parse(request.params);
      const { transcript } = editTranscriptSchema.parse(request.body);
      response.json({
        success: true,
        data: await this.service.edit(
          id,
          transcript,
          request.header("x-session-token"),
        ),
      });
    } catch (error) {
      next(error);
    }
  };

  confirm: RequestHandler = async (request, response, next) => {
    try {
      const { id } = voiceIdParamSchema.parse(request.params);
      response.json({
        success: true,
        data: await this.service.confirm(id, request.header("x-session-token")),
      });
    } catch (error) {
      next(error);
    }
  };
}
