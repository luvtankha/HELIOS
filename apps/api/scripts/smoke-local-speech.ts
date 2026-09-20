import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { LocalSpeechProvider } from "../src/providers/local-speech-provider.js";

const provider = new LocalSpeechProvider();
const audio = {
  bytes: await readFile(
    fileURLToPath(new URL("../../../tests/fixtures/speech-en.wav", import.meta.url)),
  ),
  mimeType: "audio/wav",
  fileName: "speech-en.wav",
};
try {
  const coldStart = Date.now();
  const cold = await provider.transcribe(audio, "en");
  const warmStart = Date.now();
  const warm = await provider.transcribe(audio, "en");
  assert.match(cold.transcript, /fever/i);
  assert.match(cold.transcript, /headache/i);
  assert.equal(warm.transcript, cold.transcript);
  console.log(
    JSON.stringify({
      provider: provider.id,
      transcript: cold.transcript,
      coldElapsedMs: warmStart - coldStart,
      warmElapsedMs: Date.now() - warmStart,
      passed: true,
    }),
  );
} finally {
  provider.close();
}
