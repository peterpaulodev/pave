import "server-only";
import { z } from "zod";

// Only DATABASE_URL is validated here: it's the one connection string the
// running app needs (pooled, used by lib/db.ts). DIRECT_URL/
// DATABASE_URL_UNPOOLED is CLI-only (migrations, via prisma.config.ts) and
// already fails with its own clear error there — validating it again at
// app boot would duplicate that check for a variable the server never reads.
//
// Web Push / reminder settings are optional here so the app still boots
// without them (the reminder feature just stays off); lib/push/web-push.ts
// and the cron route fail with a clear error when they're needed but unset.
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(16).optional(),
  // Comma-separated Neon Auth user ids allowed into /admin. Unset = nobody.
  ADMIN_USER_IDS: z.string().optional(),
});

export const env = envSchema.parse(process.env);
