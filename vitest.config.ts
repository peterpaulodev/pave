import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    // server/** has its own config (vitest.integration.config.ts, run via
    // `pnpm test:integration`) — those tests hit the real Neon database.
    exclude: ["node_modules", ".next", "e2e/**", "server/**"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
