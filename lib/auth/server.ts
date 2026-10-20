import "server-only";
import { createNeonAuth } from "@neondatabase/auth/next/server";

// Lazy so `next build` doesn't need the auth env vars just to collect route
// config (same reasoning as lib/db.ts).
let instance: ReturnType<typeof createNeonAuth> | undefined;

function getAuth() {
  if (!instance) {
    const baseUrl = process.env.NEON_AUTH_BASE_URL;
    const secret = process.env.NEON_AUTH_COOKIE_SECRET;
    if (!baseUrl || !secret) {
      throw new Error(
        "NEON_AUTH_BASE_URL e NEON_AUTH_COOKIE_SECRET devem estar definidas (veja .env.example)."
      );
    }
    instance = createNeonAuth({ baseUrl, cookies: { secret } });
  }
  return instance;
}

export const auth = new Proxy({} as ReturnType<typeof createNeonAuth>, {
  get(_target, prop, receiver) {
    return Reflect.get(getAuth(), prop, receiver);
  },
});
