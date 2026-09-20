import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

export default defineConfig({
  testDir: "./tests/e2e-connected",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    permissions: ["microphone"],
    launchOptions: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        `--use-file-for-fake-audio-capture=${resolve("tests/fixtures/speech-en.wav")}`,
      ],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm demo:reset:direct && pnpm dev:services",
    url: "http://127.0.0.1:3000/patient",
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
