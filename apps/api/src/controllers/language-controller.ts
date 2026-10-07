import type { RequestHandler } from "express";
import type { LanguageOperations } from "../language/language-service.js";
import {
  detectLanguageSchema,
  languageParamsSchema,
  normalizeLanguageSchema,
  translateSchema,
} from "../validation/language.js";
export class LanguageController {
  constructor(private readonly service: LanguageOperations) {}
  list: RequestHandler = (_request, response) => {
    response.json({ success: true, data: this.service.list() });
  };
  get: RequestHandler = (request, response, next) => {
    try {
      const { code } = languageParamsSchema.parse(request.params);
      response.json({ success: true, data: this.service.get(code) });
    } catch (error) {
      next(error);
    }
  };
  detect: RequestHandler = (request, response, next) => {
    try {
      const input = detectLanguageSchema.parse(request.body);
      response.json({
        success: true,
        data: this.service.detect(
          input.text,
          input.selectedLanguage,
          request.header("x-session-token"),
        ),
      });
    } catch (error) {
      next(error);
    }
  };
  normalize: RequestHandler = (request, response, next) => {
    try {
      const input = normalizeLanguageSchema.parse(request.body);
      response.json({
        success: true,
        data: this.service.normalize(
          input.text,
          input.language,
          request.header("x-session-token"),
        ),
      });
    } catch (error) {
      next(error);
    }
  };
  translate: RequestHandler = async (request, response, next) => {
    try {
      const input = translateSchema.parse(request.body);
      response.json({
        success: true,
        data: await this.service.translate(
          input,
          request.header("x-session-token"),
        ),
      });
    } catch (error) {
      next(error);
    }
  };
}
