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
 * all have a foreign key to the local `user` table, though, so every call
 * mirrors the Neon Auth identity into a local `user` row first; otherwise
 * the first write for a brand-new user would fail with a foreign key
 * violation. Wrapped in `cache()` so multiple calls within the same
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
    await prisma.user.upsert({
      where: { id },
      create: { id, email, name },
      update: { email, name },
    });

    return { id, email, name };
  }
);
