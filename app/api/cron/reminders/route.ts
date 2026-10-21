import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runReminderCron } from "@/server/reminders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Never open when the secret isn't configured.
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}

/** Hourly reminder run, called by GitHub Actions (.github/workflows/
 * reminders-cron.yml). Not behind the login proxy: see proxy.ts. */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runReminderCron();
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
