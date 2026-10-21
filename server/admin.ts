import "server-only";
import { notFound } from "next/navigation";
import { getSessionUserOrRedirect, type SessionUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { isAdmin } from "@/lib/domain/metrics";

/** Guard for /admin (design.md D5): no session → /login (via the session
 * helper); signed in but not listed in ADMIN_USER_IDS → 404, so the page's
 * existence isn't revealed. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUserOrRedirect();
  if (!isAdmin(user.id, env.ADMIN_USER_IDS)) notFound();
  return user;
}
