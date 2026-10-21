import { auth } from "@/lib/auth/server";

// Required by @neondatabase/auth (see lib/auth/server.ts and
// app/api/auth/[...path]/route.ts) for the parts of the sign-in flow that
// happen outside that API route — processing the OAuth/magic-link callback
// redirect and refreshing the session cookie. Without this, a callback
// lands on the app with no session ever finalized, and every subsequent
// request just bounces back to /login (true for both Google and
// magic-link, since both rely on this same callback-processing step).
//
// Lazy, same reasoning as route.ts: `next build` shouldn't need the auth
// env vars just to collect route config.
const middleware = () => auth.middleware({ loginUrl: "/login" });

export function proxy(...args: Parameters<ReturnType<typeof middleware>>) {
  return middleware()(...args);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
