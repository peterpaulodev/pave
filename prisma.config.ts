import { config } from "dotenv";

// `neon deploy` writes .env.local; fall back to .env.
config({ path: [".env.local", ".env"], quiet: true });
import { defineConfig } from "prisma/config";

// The Prisma CLI (migrate, studio, ...) always talks to the database
// directly, bypassing the pooler, because migrations are not safe to run
// through PgBouncer. Runtime queries use DATABASE_URL (pooled) instead —
// see lib/db.ts.
//
// This reads `process.env` directly instead of the `env()` helper from
// `prisma/config`: `env()` throws while *loading* the config if the
// variable is unset, and every Prisma CLI invocation loads this file —
// including `prisma generate`, which runs on every `pnpm install`
// (see the `postinstall` script) and does not need a database connection.
// A fresh clone without `.env` yet would otherwise fail `pnpm install`
// entirely. Commands that do need the URL (`migrate`, `studio`, `db ...`)
// still fail with a clear "no datasource URL" error when it's missing.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DIRECT_URL"],
    // Only needed to diff/generate against the migrations folder
    // (`prisma migrate diff --from-migrations`, `migrate dev`). Optional:
    // left out when unset so builds and `migrate deploy` don't depend on it.
    ...(process.env["SHADOW_DATABASE_URL"]
      ? { shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"] }
      : {}),
  },
});
