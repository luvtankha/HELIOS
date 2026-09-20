import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { LanguageCode } from "@helios/shared";
import { AppError } from "../utils/app-error.js";
import type {
  SpeechAudio,
  SpeechProvider,
  SpeechResult,
} from "./speech-provider.js";

const root = fileURLToPath(new URL("../../../../", import.meta.url));

type PendingRequest = {
  worker: WarmWorker;
  language: LanguageCode;
  resolve: (result: SpeechResult) => void;
  reject: (error: AppError) => void;
  timer: ReturnType<typeof setTimeout>;
};

type WarmWorker = {
  child: ChildProcessWithoutNullStreams;
  language: LanguageCode;
  ready: Promise<void>;
  resolveReady: () => void;
  rejectReady: (error: AppError) => void;
  output: string;
};

/**
 * A single, language-specific Whisper process stays warm between recordings.
 * Audio is still sent only through memory and is never written to disk.
 */
export class LocalSpeechProvider implements SpeechProvider {
  readonly id = "local";
  readonly model = "faster-whisper-small.en (English), faster-whisper-small (Hindi)";
  private busy = false;
  private worker: WarmWorker | undefined;
  private pending: PendingRequest | undefined;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly englishModelPath = resolve(root, "work/speech-models/small.en");

  constructor(
    private readonly python = resolve(
      root,
      "work/speech-venv",
      process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
    ),
    private readonly modelPath = resolve(root, "work/speech-models/small"),
    private readonly timeoutMs = 120_000,
    private readonly maxDurationSeconds = 75,
    private readonly idleTimeoutMs = 120_000,
  ) {}

  async transcribe(
    audio: SpeechAudio,
    language: LanguageCode,
  ): Promise<SpeechResult> {
    const modelPath = this.modelPathFor(language);
    if (
      !existsSync(this.python) ||
      !existsSync(resolve(modelPath, "model.bin"))
    ) {
      throw new AppError(
        "Local speech recognition needs setup. Run pnpm speech:setup, then try again.",
        503,
        "SPEECH_PROVIDER_NOT_CONFIGURED",
      );
    }
    if (this.busy) {
      throw new AppError(
        "Speech recognition is processing another recording. Please try again shortly.",
        503,
        "SPEECH_BUSY",
      );
    }

    this.busy = true;
    this.clearIdleTimer();
    try {
      const worker = await this.getWorker(language, modelPath);
      return await this.send(worker, audio, language);
    } finally {
      this.busy = false;
      this.scheduleIdleStop();
    }
  }

  detectLanguage(result: SpeechResult) {
    return result.detectedLanguage;
  }

  getSupportedLanguages() {
    return ["en", "hi"] as const;
  }

  /** Stops the in-memory worker, primarily for bounded CLI checks and shutdown. */
  close() {
    this.clearIdleTimer();
    this.stopWorker();
  }

  private async getWorker(language: LanguageCode, modelPath: string) {
    if (this.worker && this.worker.language === language) {
      await this.worker.ready;
      return this.worker;
    }
    this.stopWorker();
    const worker = this.startWorker(language, modelPath);
    await worker.ready;
    return worker;
  }

  private startWorker(language: LanguageCode, modelPath: string) {
    const child = spawn(
      this.python,
      [
        resolve(root, "apps/api/scripts/transcribe-local.py"),
        modelPath,
        language,
        String(this.maxDurationSeconds),
        "--worker",
      ],
      {
        shell: false,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          PYTHONIOENCODING: "utf-8",
          HF_HUB_OFFLINE: "1",
        },
      },
    );
    let resolveReady!: () => void;
    let rejectReady!: (error: AppError) => void;
    const worker: WarmWorker = {
      child,
      language,
      ready: new Promise<void>((resolveReadyPromise, rejectReadyPromise) => {
        resolveReady = resolveReadyPromise;
        rejectReady = rejectReadyPromise;
      }),
      resolveReady,
      rejectReady,
      output: "",
    };
    this.worker = worker;

    const startTimer = setTimeout(() => {
      this.failWorker(
        worker,
        new AppError(
          "Speech recognition took too long to start. Please try again.",
          504,
          "SPEECH_TIMEOUT",
        ),
      );
    }, this.timeoutMs);
    worker.ready.finally(() => clearTimeout(startTimer)).catch(() => undefined);

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (part: string) => this.readWorkerOutput(worker, part));
    // Drain diagnostics without retaining audio, transcript, or local paths.
    child.stderr.resume();
    child.stdin.on("error", () =>
      this.failWorker(
        worker,
        new AppError(
          "The local speech service stopped. Please try again.",
          502,
          "SPEECH_PROVIDER_UNAVAILABLE",
        ),
      ),
    );
    child.on("error", () =>
      this.failWorker(
        worker,
        new AppError(
          "The local speech service could not start.",
          503,
          "SPEECH_PROVIDER_UNAVAILABLE",
        ),
      ),
    );
    child.on("close", () =>
      this.failWorker(
        worker,
        new AppError(
          "The local speech service stopped. Please try again.",
          502,
          "SPEECH_PROVIDER_UNAVAILABLE",
        ),
        false,
      ),
    );
    return worker;
  }

  private send(
    worker: WarmWorker,
    audio: SpeechAudio,
    language: LanguageCode,
  ) {
    return new Promise<SpeechResult>((resolveResult, reject) => {
      const timer = setTimeout(() => {
        const pending = this.pending;
        if (!pending || pending.worker !== worker) return;
        this.pending = undefined;
        pending.reject(
          new AppError(
            "Speech recognition took too long. Try a shorter recording.",
            504,
            "SPEECH_TIMEOUT",
          ),
        );
        this.failWorker(
          worker,
          new AppError(
            "Speech recognition took too long. Try a shorter recording.",
            504,
            "SPEECH_TIMEOUT",
          ),
        );
      }, this.timeoutMs);
      this.pending = {
        worker,
        language,
        resolve: resolveResult,
        reject,
        timer,
      };
      try {
        worker.child.stdin.write(
          `${JSON.stringify({ audio: audio.bytes.toString("base64") })}\n`,
        );
      } catch {
        this.failWorker(
          worker,
          new AppError(
            "The local speech service stopped. Please try again.",
            502,
            "SPEECH_PROVIDER_UNAVAILABLE",
          ),
        );
      }
    });
  }

  private readWorkerOutput(worker: WarmWorker, part: string) {
    worker.output += part;
    if (worker.output.length > 64_000) {
      this.failWorker(
        worker,
        new AppError(
          "Speech recognition returned an invalid result.",
          502,
          "TRANSCRIPT_INVALID",
        ),
      );
      return;
    }
    let newline = worker.output.indexOf("\n");
    while (newline !== -1) {
      const line = worker.output.slice(0, newline).trim();
      worker.output = worker.output.slice(newline + 1);
      if (line) this.handleWorkerMessage(worker, line);
      newline = worker.output.indexOf("\n");
    }
  }

  private handleWorkerMessage(worker: WarmWorker, line: string) {
    let value: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(line);
      if (typeof parsed !== "object" || parsed === null) throw new Error();
      value = parsed as Record<string, unknown>;
    } catch {
      this.failWorker(
        worker,
        new AppError(
          "Speech recognition returned an invalid result.",
          502,
          "TRANSCRIPT_INVALID",
        ),
      );
      return;
    }
    if (value.ready === true) {
      worker.resolveReady();
      return;
    }
    const pending = this.pending;
    if (!pending || pending.worker !== worker) {
      this.failWorker(
        worker,
        new AppError(
          "Speech recognition returned an unexpected result.",
          502,
          "TRANSCRIPT_INVALID",
        ),
      );
      return;
    }
    this.pending = undefined;
    clearTimeout(pending.timer);
    const error = resultError(value);
    if (error) {
      pending.reject(error);
      return;
    }
    const transcript = value.transcript;
    if (
      typeof transcript !== "string" ||
      transcript.trim().length < 1 ||
      transcript.length > 4_000
    ) {
      pending.reject(
        new AppError(
          "The recording could not be transcribed. Please try again or type your answer.",
          502,
          "TRANSCRIPTION_FAILED",
        ),
      );
      return;
    }
    pending.resolve({
      transcript: transcript.trim(),
      detectedLanguage: pending.language,
    });
  }

  private failWorker(worker: WarmWorker, error: AppError, terminate = true) {
    if (this.worker !== worker) return;
    this.worker = undefined;
    worker.rejectReady(error);
    const pending = this.pending;
    if (pending?.worker === worker) {
      this.pending = undefined;
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    if (terminate) worker.child.kill();
  }

  private stopWorker() {
    const worker = this.worker;
    if (!worker) return;
    this.worker = undefined;
    worker.rejectReady(
      new AppError(
        "The local speech service stopped. Please try again.",
        502,
        "SPEECH_PROVIDER_UNAVAILABLE",
      ),
    );
    worker.child.kill();
  }

  private scheduleIdleStop() {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      if (!this.busy) this.stopWorker();
    }, this.idleTimeoutMs);
    this.idleTimer.unref?.();
  }

  private clearIdleTimer() {
    if (!this.idleTimer) return;
    clearTimeout(this.idleTimer);
    this.idleTimer = undefined;
  }

  private modelPathFor(language: LanguageCode) {
    return language === "en" && existsSync(resolve(this.englishModelPath, "model.bin"))
      ? this.englishModelPath
      : this.modelPath;
  }
}

function resultError(value: Record<string, unknown>) {
  if (value.error === "NO_SPEECH") {
    return new AppError(
      "No speech was heard. Check your microphone and speak a little closer, or type your answer.",
      422,
      "TRANSCRIPT_EMPTY",
    );
  }
  if (value.error === "AUDIO_DURATION_EXCEEDED") {
    return new AppError(
      "The recording is longer than the allowed limit.",
      413,
      "AUDIO_DURATION_EXCEEDED",
    );
  }
  if (value.error === "AUDIO_TOO_LARGE") {
    return new AppError(
      "The recording file is too large.",
      413,
      "AUDIO_TOO_LARGE",
    );
  }
  return undefined;
}
