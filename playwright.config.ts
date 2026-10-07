import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: [
    "live-consultation.spec.ts",
    "public-experience.spec.ts",
    "presentation-regression.spec.ts",
  ],
  fullyParallel: false,
  timeout: 30_000,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    permissions: ["microphone"],
    launchOptions: {
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        "--autoplay-policy=no-user-gesture-required",
      ],
    },
  },
  webServer: {
    command: "pnpm build && pnpm --filter @helios/web start",
    url: "http://127.0.0.1:3000/patient",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
