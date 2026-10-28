import { defineConfig } from "vitest/config";

// End-to-end tests: start `next dev` with the dev auth bypass and drive it
// with Playwright's Chromium, against the real Neon dev database. Run via
// `pnpm test:e2e` (never part of `pnpm test`, whose config excludes e2e/**).
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["e2e/**/*.test.ts"],
    setupFiles: ["./vitest.integration.setup.ts"],
    testTimeout: 180_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
});
