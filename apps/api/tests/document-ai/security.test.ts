import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  detectDocumentMime,
  validateDocumentSignature,
} from "../../src/middleware/document-upload.js";
import { LocalPrivateDocumentStorage } from "../../src/document-ai/storage.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("document file security", () => {
  it.each([
    [Buffer.from("%PDF-1.7"), "application/pdf"],
    [
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      "image/png",
    ],
    [Buffer.from([0xff, 0xd8, 0xff, 0xdb]), "image/jpeg"],
    [Buffer.from("RIFF0000WEBP"), "image/webp"],
  ])(
    "detects content signatures independently of extension",
    (buffer, expected) => {
      expect(detectDocumentMime(buffer)).toBe(expected);
    },
  );

  it("rejects a claimed PDF whose bytes are not a PDF", () => {
    expect(() =>
      validateDocumentSignature({
        buffer: Buffer.from("not a pdf"),
        mimetype: "application/pdf",
      } as Express.Multer.File),
    ).toThrowError(
      expect.objectContaining({ code: "DOCUMENT_CONTENT_INVALID" }),
    );
  });

  it("stores private bytes under the configured root and blocks traversal", async () => {
    const directory = await mkdtemp(join(tmpdir(), "helios-documents-"));
    directories.push(directory);
    const storage = new LocalPrivateDocumentStorage(directory);
    await storage.store(
      "patient/document/original.pdf",
      Buffer.from("private"),
    );
    await expect(
      storage.read("patient/document/original.pdf"),
    ).resolves.toEqual(Buffer.from("private"));
    await expect(storage.read("../outside.pdf")).rejects.toMatchObject({
      code: "DOCUMENT_STORAGE_KEY_INVALID",
    });
  });
});
