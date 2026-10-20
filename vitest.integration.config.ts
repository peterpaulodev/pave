import { defineConfig } from "vitest/config";

// Integration tests: hit the real Neon database (see server/queries.test.ts).
// Run separately from the unit suite (`pnpm test`) via `pnpm test:integration`,
// so a missing/misconfigured DATABASE_URL never silently skips them and a
// unit-test run never touches a real database. vitest.integration.setup.ts
// aborts if NEON_BRANCH doesn't look like a disposable dev/test branch.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts"],
    exclude: ["node_modules", ".next"],
    setupFiles: ["./vitest.integration.setup.ts"],
    // Integration tests touch the network; don't run them in parallel
    // across files to avoid surprising interleaving of writes.
    fileParallelism: false,
  },
});
