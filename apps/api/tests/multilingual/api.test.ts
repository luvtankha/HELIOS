import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createLanguageRouter } from "../../src/routes/languages.js";
import { errorHandler } from "../../src/middleware/error-handler.js";
import { requestContext } from "../../src/middleware/request-context.js";
import type { LanguageOperations } from "../../src/language/language-service.js";

function service(): LanguageOperations {
  return {
    list: vi.fn(() => [{ code: "en" }, { code: "hi" }]),
    get: vi.fn((code: string) => ({ code })),
    detect: vi.fn(() => ({
      primaryLanguage: "hi",
      detectedLanguages: ["hi", "en"],
    })),
    normalize: vi.fn(() => ({ concepts: [], needsClarification: true })),
    translate: vi.fn(async (input) => ({
      ...input,
      translatedText: input.text,
    })),
    setDoctorLanguage: vi.fn(async () => undefined),
  };
}

function app(operations: LanguageOperations) {
  const value = express();
  value.use(express.json());
  value.use(requestContext);
  value.use("/api/v1", createLanguageRouter(operations));
  value.use(errorHandler);
  return value;
}

describe("language API", () => {
  it("lists capability profiles", async () => {
    const response = await request(app(service())).get("/api/v1/languages");
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([{ code: "en" }, { code: "hi" }]);
  });

  it("returns a single language", async () => {
    const response = await request(app(service())).get("/api/v1/languages/hi");
    expect(response.status).toBe(200);
    expect(response.body.data.code).toBe("hi");
  });

  it("forwards selected language and proof to detection", async () => {
    const operations = service();
    const response = await request(app(operations))
      .post("/api/v1/language/detect")
      .set("x-session-token", "proof")
      .send({ text: "Pet mein pain hai", selectedLanguage: "hi" });
    expect(response.status).toBe(200);
    expect(operations.detect).toHaveBeenCalledWith(
      "Pet mein pain hai",
      "hi",
      "proof",
    );
  });

  it("rejects invalid language codes before calling a provider", async () => {
    const operations = service();
    const response = await request(app(operations))
      .post("/api/v1/translate")
      .send({
        text: "Hello",
        sourceLanguage: "xx",
        targetLanguage: "hi",
        contextType: "UI",
      });
    expect(response.status).toBe(400);
    expect(operations.translate).not.toHaveBeenCalled();
  });

  it("updates doctor display language through doctor proof", async () => {
    const operations = service();
    const response = await request(app(operations))
      .put("/api/v1/doctor/language")
      .set("x-doctor-token", "doctor-proof")
      .send({ language: "hi" });
    expect(response.status).toBe(204);
    expect(operations.setDoctorLanguage).toHaveBeenCalledWith(
      "hi",
      "doctor-proof",
    );
  });
});
