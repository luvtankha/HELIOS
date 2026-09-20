import { afterEach, describe, expect, it, vi } from "vitest";
import { MockSpeechProvider } from "../src/providers/mock-speech-provider.js";
import { OpenAISpeechProvider } from "../src/providers/openai-speech-provider.js";

const audio = {
  bytes: Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
  mimeType: "audio/webm",
  fileName: "helios-recording.webm",
};

describe("speech providers", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("implements the provider contract for English", async () => {
    const provider = new MockSpeechProvider();
    const result = await provider.transcribe(audio, "en");
    expect(result.transcript).toContain("stomach pain");
    expect(provider.detectLanguage(result)).toBe("en");
    expect(provider.getSupportedLanguages()).toEqual(["en", "hi"]);
  });

  it("preserves Hindi while providing separate normalization", async () => {
    const result = await new MockSpeechProvider().transcribe(audio, "hi");
    expect(result.transcript).toContain("पेट में दर्द");
    expect(result.normalizedTranscript).toContain("stomach pain");
    expect(result.transcript).not.toBe(result.normalizedTranscript);
  });

  it("adapts the configured real provider to the neutral result", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            text: "Mixed language patient speech",
            languages: [{ code: "hi" }],
            logprobs: [{ logprob: -0.1 }, { logprob: -0.2 }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAISpeechProvider(
      "test-key",
      "gpt-4o-mini-transcribe",
      5_000,
    );
    const result = await provider.transcribe(audio, "hi");
    expect(result.transcript).toBe("Mixed language patient speech");
    expect(result.detectedLanguage).toBe("hi");
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/audio/transcriptions",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
