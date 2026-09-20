import type { RequestHandler } from "express";
import multer from "multer";
import { extname } from "node:path";
import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const allowedExtensions = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fields: 4, fileSize: env.DOCUMENT_MAX_FILE_BYTES },
  fileFilter: (_request, file, callback) => {
    const mimeType = canonicalMime(file.mimetype);
    const extension = extname(file.originalname).toLowerCase();
    if (allowedMimeTypes.has(mimeType) && allowedExtensions.has(extension)) {
      callback(null, true);
      return;
    }
    callback(
      new AppError(
        "Please upload a PDF or supported image",
        415,
        "DOCUMENT_TYPE_UNSUPPORTED",
      ),
    );
  },
}).single("document");

export const receiveDocument: RequestHandler = (request, response, next) => {
  upload(request, response, (error) => {
    if (error instanceof multer.MulterError) {
      next(
        new AppError(
          error.code === "LIMIT_FILE_SIZE"
            ? "This document is too large"
            : "The document upload is invalid",
          error.code === "LIMIT_FILE_SIZE" ? 413 : 400,
          error.code === "LIMIT_FILE_SIZE"
            ? "DOCUMENT_FILE_TOO_LARGE"
            : "DOCUMENT_UPLOAD_INVALID",
        ),
      );
      return;
    }
    next(error);
  });
};

export function validateDocumentSignature(file: Express.Multer.File) {
  const detected = detectDocumentMime(file.buffer);
  const claimed = canonicalMime(file.mimetype);
  if (!detected || detected !== claimed)
    throw new AppError(
      "The document content does not match its file type",
      415,
      "DOCUMENT_CONTENT_INVALID",
    );
  if (
    detected === "application/pdf" &&
    /\/(?:JavaScript|JS|Launch|EmbeddedFile|OpenAction)\b/i.test(
      file.buffer.toString("latin1"),
    )
  )
    throw new AppError(
      "This PDF contains unsupported active or embedded content",
      415,
      "DOCUMENT_ACTIVE_CONTENT_REJECTED",
    );
  return detected;
}

export function detectDocumentMime(bytes: Buffer): string | undefined {
  const ascii = (start: number, length: number) =>
    bytes.subarray(start, start + length).toString("ascii");
  if (ascii(0, 5) === "%PDF-") return "application/pdf";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    ascii(1, 3) === "PNG" &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";
  return undefined;
}

function canonicalMime(value: string) {
  const mime = value.toLowerCase().split(";", 1)[0] ?? "";
  return mime === "image/jpg" ? "image/jpeg" : mime;
}
