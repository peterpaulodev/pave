import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { localDate } from "@/lib/domain/local-date";
import { getUserSettings } from "@/server/queries";
import { markNoSpend } from "@/server/checkin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Marks today (in the user's time zone) as "no spend". Called by the
 * notification action in the service worker, so it answers 401 JSON
 * instead of redirecting to /login. */
export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const settings = await getUserSettings(user.id);
  const timezone = settings?.timezone ?? "America/Sao_Paulo";
  await markNoSpend(user.id, localDate(timezone));

  return NextResponse.json({ ok: true });
}
