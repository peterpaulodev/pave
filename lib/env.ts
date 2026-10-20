import "server-only";
import { z } from "zod";

// Only DATABASE_URL is validated here: it's the one connection string the
// running app needs (pooled, used by lib/db.ts). DIRECT_URL/
// DATABASE_URL_UNPOOLED is CLI-only (migrations, via prisma.config.ts) and
// already fails with its own clear error there — validating it again at
// app boot would duplicate that check for a variable the server never reads.
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
});

export const env = envSchema.parse(process.env);
