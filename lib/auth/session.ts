import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { getDevAuthBypassUserId } from "@/lib/auth/dev-bypass";
import { ensureMirroredUser } from "@/server/queries";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

/**
 * Returns the signed-in user, or `null` when there's no session — for Route
 * Handlers that must answer 401 instead of redirecting (e.g. the call made
 * by the service worker, which can't follow a redirect to /login).
 *
 * Neon Auth never writes to this app's own Postgres (design.md D7), so
 * every call ensures a local `user` row mirrors it — see
 * server/queries.ts's ensureMirroredUser() for how that stays correct
 * under concurrent first-time requests (P2002 handling), kept there so
 * it's testable against the real database without mocking Next.js/Neon
 * Auth internals. Wrapped in `cache()` so multiple calls within the same
 * request/render only do this once.
 *
 * Callers must render dynamically (`export const dynamic = "force-dynamic"`)
 * — same requirement as any use of `auth.getSession()`.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const bypassUserId = getDevAuthBypassUserId();
  if (bypassUserId) {
    const bypassUser = {
      id: bypassUserId,
      email: `${bypassUserId}@dev-bypass.local`,
      name: "Dev Bypass",
    };
    await ensureMirroredUser(bypassUser);
    return bypassUser;
  }

  const { data: session } = await auth.getSession();
  if (!session?.user) return null;

  const { id, email, name } = session.user;
  await ensureMirroredUser({ id, email, name });

  return { id, email, name };
});

/** Same as getSessionUser(), redirecting to /login when there's no session
 * — for Server Components and Server Actions. */
export async function getSessionUserOrRedirect(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}
