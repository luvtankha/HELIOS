import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: { DATABASE_URL: "postgresql://unit:test@localhost:5432/unit" },
    coverage: { reporter: ["text", "html"] },
  },
});
