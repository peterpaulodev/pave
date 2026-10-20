// Runs as its own process before `vitest run --config
// vitest.integration.config.ts` (see package.json's test:integration
// script) — not inside Vitest, because Vitest only shows a test file's
// captured console output when that file fails, so a plain console.warn()
// from a setup file is invisible on a passing run. This script's stdout
// always shows, and a non-zero exit here stops the npm script chain
// before Vitest even starts.
import { config } from "dotenv";

config({ path: [".env.local", ".env"] });

const SAFE_BRANCH_PATTERN = /^(dev|test|preview)/i;

const branch = process.env.NEON_BRANCH;
if (!branch) {
  console.error(
    'NEON_BRANCH não está definida. Defina-a em .env.local antes de rodar os testes de integração — eles escrevem e apagam linhas reais no banco configurado.'
  );
  process.exit(1);
}

const isSafeBranch = SAFE_BRANCH_PATTERN.test(branch);
const allowOverride = process.env.NEON_INTEGRATION_TEST_ALLOW_BRANCH;
const isExplicitlyAllowed = allowOverride === branch;

if (!isSafeBranch && !isExplicitlyAllowed) {
  console.error(
    `Testes de integração abortados: NEON_BRANCH="${branch}" não parece ser uma branch de dev/test/preview.\n` +
      `Se isso for intencional, defina NEON_INTEGRATION_TEST_ALLOW_BRANCH="${branch}" em .env.local para confirmar explicitamente que você sabe o que está fazendo.`
  );
  process.exit(1);
}

if (!isSafeBranch && isExplicitlyAllowed) {
  console.warn(
    `\n⚠️⚠️⚠️  ATENÇÃO: testes de integração vão rodar contra NEON_BRANCH="${branch}" — NÃO é uma branch dev/test/preview.\n` +
      `Permitido só porque NEON_INTEGRATION_TEST_ALLOW_BRANCH="${branch}" está definido em .env.local.\n` +
      `Esses testes criam e apagam linhas reais nesse banco.  ⚠️⚠️⚠️\n`
  );
}
