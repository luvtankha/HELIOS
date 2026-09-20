const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
const voiceMaxDurationSeconds = Number(
  process.env.NEXT_PUBLIC_VOICE_MAX_DURATION_SECONDS ?? 75,
);
const voiceMaxFileBytes = Number(
  process.env.NEXT_PUBLIC_VOICE_MAX_FILE_BYTES ?? 8_000_000,
);
const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export const publicConfig = Object.freeze({
  apiUrl,
  voiceMaxDurationSeconds,
  voiceMaxFileBytes,
  demoMode,
});
