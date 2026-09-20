import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalSpeechProvider } from "../src/providers/local-speech-provider.js";

const mocks = vi.hoisted(() => ({ spawn: vi.fn(), exists: vi.fn(() => true) }));
vi.mock("node:child_process", () => ({ spawn: mocks.spawn }));
vi.mock("node:fs", () => ({ existsSync: mocks.exists }));

const audio = {
  bytes: Buffer.from("audio"),
  mimeType: "audio/wav",
  fileName: "test.wav",
};

function worker() {
  const child = Object.assign(new EventEmitter(), {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: vi.fn(),
  });
  mocks.spawn.mockReturnValue(child);
  return child;
}

async function ready(child: ReturnType<typeof worker>) {
  child.stdout.write('{"ready":true}\n');
  await new Promise<void>((resolve) => setImmediate(resolve));
}

describe("bounded local speech worker", () => {
  afterEach(() => {
    vi.clearAllMocks();
    mocks.exists.mockReturnValue(true);
  });

  it("keeps a ready worker warm and sends audio only in memory", async () => {
    const child = worker();
    const provider = new LocalSpeechProvider(
      "C:/Python With Spaces/python.exe",
      "C:/models/small",
    );
    const first = provider.transcribe(audio, "hi");
    await ready(child);
    await Promise.resolve();
    expect(JSON.parse(child.stdin.read().toString())).toEqual({
      audio: audio.bytes.toString("base64"),
    });
    child.stdout.write('{"transcript":"मुझे बुखार है"}\n');
    await expect(first).resolves.toEqual({
      transcript: "मुझे बुखार है",
      detectedLanguage: "hi",
    });

    const second = provider.transcribe(audio, "hi");
    await new Promise<void>((resolve) => setImmediate(resolve));
    child.stdout.write('{"transcript":"दो दिन"}\n');
    await expect(second).resolves.toMatchObject({ transcript: "दो दिन" });
    expect(mocks.spawn).toHaveBeenCalledTimes(1);
    expect(mocks.spawn).toHaveBeenCalledWith(
      "C:/Python With Spaces/python.exe",
      expect.arrayContaining(["hi", "75", "--worker"]),
      expect.objectContaining({ shell: false, windowsHide: true }),
    );
  });

  it("accepts a one-character severity transcript", async () => {
    const child = worker();
    const pending = new LocalSpeechProvider().transcribe(audio, "en");
    await ready(child);
    child.stdout.write('{"transcript":"7"}\n');
    await expect(pending).resolves.toMatchObject({ transcript: "7" });
  });

  it("reports missing setup without starting a process", async () => {
    mocks.exists.mockReturnValue(false);
    await expect(
      new LocalSpeechProvider().transcribe(audio, "en"),
    ).rejects.toMatchObject({ code: "SPEECH_PROVIDER_NOT_CONFIGURED" });
    expect(mocks.spawn).not.toHaveBeenCalled();
  });

  it("rejects silence without inventing a transcript", async () => {
    const child = worker();
    const pending = new LocalSpeechProvider().transcribe(audio, "en");
    await ready(child);
    child.stdout.write('{"error":"NO_SPEECH"}\n');
    await expect(pending).rejects.toMatchObject({ code: "TRANSCRIPT_EMPTY" });
  });

  it("rejects malformed output and replaces a failed worker", async () => {
    const child = worker();
    const provider = new LocalSpeechProvider();
    const pending = provider.transcribe(audio, "en");
    await ready(child);
    await expect(provider.transcribe(audio, "en")).rejects.toMatchObject({
      code: "SPEECH_BUSY",
    });
    child.stdout.write("invalid\n");
    await expect(pending).rejects.toMatchObject({
      code: "TRANSCRIPT_INVALID",
    });

    const replacement = worker();
    const retried = provider.transcribe(audio, "en");
    await ready(replacement);
    replacement.stdout.write('{"transcript":"A different answer"}\n');
    await expect(retried).resolves.toMatchObject({
      transcript: "A different answer",
    });
  });

  it("kills a worker that does not become ready before the timeout", async () => {
    const child = worker();
    await expect(
      new LocalSpeechProvider(undefined, undefined, 10).transcribe(audio, "en"),
    ).rejects.toMatchObject({ code: "SPEECH_TIMEOUT" });
    expect(child.kill).toHaveBeenCalledOnce();
  });

  it("rejects worker-verified overlong audio", async () => {
    const child = worker();
    const pending = new LocalSpeechProvider().transcribe(audio, "en");
    await ready(child);
    child.stdout.write('{"error":"AUDIO_DURATION_EXCEEDED"}\n');
    await expect(pending).rejects.toMatchObject({
      code: "AUDIO_DURATION_EXCEEDED",
    });
  });
});
