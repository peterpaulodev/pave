import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { ensureMirroredUser } from "@/server/queries";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

/**
 * Returns the signed-in user for Server Components and Server Actions,
 * redirecting to /login when there's no session.
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
export const getSessionUserOrRedirect = cache(
  async (): Promise<SessionUser> => {
    const { data: session } = await auth.getSession();
    if (!session?.user) {
      redirect("/login");
    }

    const { id, email, name } = session.user;
    await ensureMirroredUser({ id, email, name });

    return { id, email, name };
  }
);
