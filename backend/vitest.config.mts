import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // Each test file gets a fresh module graph, so the in-memory fake Prisma
    // and the mocked email service never leak state between files.
    isolate: true,
    reporters: ["default"],
  },
});
