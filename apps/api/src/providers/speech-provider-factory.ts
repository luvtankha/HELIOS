import { env } from "../config/env.js";
import { MockSpeechProvider } from "./mock-speech-provider.js";
import { LocalSpeechProvider } from "./local-speech-provider.js";
import { OpenAISpeechProvider } from "./openai-speech-provider.js";
import type { SpeechProvider } from "./speech-provider.js";

export function createSpeechProvider(): SpeechProvider {
  if (env.SPEECH_PROVIDER === "local") {
    return new LocalSpeechProvider(
      env.SPEECH_LOCAL_PYTHON,
      env.SPEECH_LOCAL_MODEL_PATH,
      env.SPEECH_LOCAL_TIMEOUT_MS,
      env.VOICE_MAX_DURATION_SECONDS,
    );
  }
  if (env.SPEECH_PROVIDER === "openai") {
    return new OpenAISpeechProvider(
      env.SPEECH_API_KEY,
      env.SPEECH_MODEL,
      env.SPEECH_TIMEOUT_MS,
    );
  }
  return new MockSpeechProvider();
}
