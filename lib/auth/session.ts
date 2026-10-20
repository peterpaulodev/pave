import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/db";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

/**
 * Returns the signed-in user for Server Components and Server Actions,
 * redirecting to /login when there's no session.
 *
 * Neon Auth is a hosted service — it never writes to this app's own
 * Postgres database (see design.md D7). UserSettings/BudgetCycle/Expense
 * all have a foreign key to the local `user` table, though, so the first
 * call for a brand-new user mirrors the Neon Auth identity into a local
 * `user` row; otherwise that user's first write would fail with a foreign
 * key violation. Only writes when the local row is missing — it does not
 * keep email/name in sync on every call, trading a (rare) staleness for
 * not writing to Postgres on every single request. Wrapped in `cache()`
 * so multiple calls within the same request/render only check this once.
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
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      await prisma.user.create({ data: { id, email, name } });
    }

    return { id, email, name };
  }
);
