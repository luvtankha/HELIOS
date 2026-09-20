import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  timeout: 30_000,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "pnpm build && pnpm --filter @helios/web start",
    url: "http://127.0.0.1:3000/patient",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
