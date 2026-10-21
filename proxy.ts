import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { getDevAuthBypassUserId } from "@/lib/auth/dev-bypass";

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
  // Dev-only: skip the login redirect while impersonating (see dev-bypass.ts).
  if (getDevAuthBypassUserId()) return NextResponse.next();
  return middleware()(...args);
}

export const config = {
  // /api/cron is called by GitHub Actions with no session; the route protects
  // itself with `Authorization: Bearer CRON_SECRET`. Without this exclusion
  // the login redirect would answer 307 and `curl -f` would report success.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/cron).*)"],
};
