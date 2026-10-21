import { config } from "dotenv";
import { vi } from "vitest";

config({ path: [".env.local", ".env"] });

vi.mock("server-only", () => ({}));

// `after()` throws outside a request scope. Queue its callbacks instead so
// the server code under test can call it (see server/testing/after-queue.ts).
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  const { afterQueue } = await import("./server/testing/after-queue");
  return {
    ...actual,
    after: (callback: () => Promise<void> | void) => {
      afterQueue().push(callback);
    },
  };
});

// Guard against accidentally running integration tests (which write and
// delete real rows) against a database that isn't a disposable dev/test
// branch. Neon exposes the branch name as NEON_BRANCH.
//
// The real, user-visible check (including the loud warning for an
// explicitly-allowed non-dev branch) lives in
// scripts/check-integration-branch.mjs, run as its own process before
// Vitest even starts — Vitest only surfaces a test file's captured console
// output when that file fails, so a warning logged from here would be
// invisible on a passing run. This copy is just defense-in-depth for
// whoever runs `vitest run --config vitest.integration.config.ts` directly,
// bypassing the `pnpm test:integration` script.
const SAFE_BRANCH_PATTERN = /^(dev|test|preview)/i;

const branch = process.env.NEON_BRANCH;
if (!branch) {
  throw new Error(
    "NEON_BRANCH não está definida. Defina-a em .env.local antes de rodar os testes de integração — eles escrevem e apagam linhas reais no banco configurado."
  );
}

const isSafeBranch = SAFE_BRANCH_PATTERN.test(branch);
const allowOverride = process.env.NEON_INTEGRATION_TEST_ALLOW_BRANCH;
const isExplicitlyAllowed = allowOverride === branch;

if (!isSafeBranch && !isExplicitlyAllowed) {
  throw new Error(
    `Testes de integração abortados: NEON_BRANCH="${branch}" não parece ser uma branch de dev/test/preview.\n` +
      `Se isso for intencional, defina NEON_INTEGRATION_TEST_ALLOW_BRANCH="${branch}" em .env.local para confirmar explicitamente que você sabe o que está fazendo.`
  );
}
