import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: [
    "live-consultation.spec.ts",
    "public-experience.spec.ts",
    "doctor-native-handoff.spec.ts",
    "presentation-regression.spec.ts",
  ],
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    browserName: "chromium",
    permissions: ["microphone"],
    launchOptions: {
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        "--autoplay-policy=no-user-gesture-required",
      ],
    },
    screenshot: "only-on-failure",
  },
});
