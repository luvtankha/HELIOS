import type { RequestHandler } from "express";
import multer from "multer";
import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";

const acceptedMimeTypes = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: env.VOICE_MAX_FILE_BYTES, fields: 3 },
  fileFilter: (_request, file, callback) => {
    const mimeType = file.mimetype.toLowerCase().split(";", 1)[0] ?? "";
    if (acceptedMimeTypes.has(mimeType)) {
      callback(null, true);
      return;
    }
    callback(
      new AppError(
        "Please use a supported audio recording",
        415,
        "AUDIO_TYPE_UNSUPPORTED",
      ),
    );
  },
}).single("audio");

export const receiveAudio: RequestHandler = (request, response, next) => {
  upload(request, response, (error) => {
    if (error instanceof multer.MulterError) {
      next(
        new AppError(
          error.code === "LIMIT_FILE_SIZE"
            ? "The recording is too large"
            : "The audio upload is invalid",
          error.code === "LIMIT_FILE_SIZE" ? 413 : 400,
          error.code === "LIMIT_FILE_SIZE"
            ? "AUDIO_FILE_TOO_LARGE"
            : "AUDIO_UPLOAD_INVALID",
        ),
      );
      return;
    }
    next(error);
  });
};

export function validateAudioSignature(file: Express.Multer.File): void {
  const bytes = file.buffer;
  const ascii = (start: number, length: number) =>
    bytes.subarray(start, start + length).toString("ascii");
  const isWebm =
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3;
  const isOgg = ascii(0, 4) === "OggS";
  const isWav = ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE";
  const isMp4 = ascii(4, 4) === "ftyp";
  const isMp3 =
    ascii(0, 3) === "ID3" ||
    (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0);
  if (!isWebm && !isOgg && !isWav && !isMp4 && !isMp3) {
    throw new AppError(
      "The recording content is not a supported audio format",
      415,
      "AUDIO_CONTENT_INVALID",
    );
  }
}
