import "server-only";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";

/** Marks the local day `date` ("YYYY-MM-DD") as registered without an
 * expense. Idempotent: calling it again for the same day is a no-op. */
export async function markNoSpend(userId: string, date: string): Promise<void> {
  await prisma.dailyCheckin.upsert({
    where: { userId_date: { userId, date: new Date(`${date}T00:00:00.000Z`) } },
    create: { userId, date: new Date(`${date}T00:00:00.000Z`) },
    update: {},
  });
}

/**
 * Distinct local dates ("YYYY-MM-DD", ascending) of the last `days` days on
 * which the user registered something: a manual expense or a "no spend"
 * check-in. Automatic expenses from recurring bills don't count — they say
 * nothing about the habit (design.md D8). `created_at` is converted to the
 * user's local date in SQL, not in JS, so the day boundary is the user's.
 */
export async function getRegisteredDates(
  userId: string,
  timeZone: string,
  days = 60
): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ day: string }[]>(Prisma.sql`
    WITH bounds AS (
      SELECT (now() AT TIME ZONE ${timeZone})::date - ${days}::int AS since
    )
    SELECT to_char(e.created_at AT TIME ZONE ${timeZone}, 'YYYY-MM-DD') AS day
      FROM expenses e, bounds
     WHERE e.user_id = ${userId}
       AND e.recurring_expense_id IS NULL
       AND (e.created_at AT TIME ZONE ${timeZone})::date > bounds.since
    UNION
    SELECT to_char(c.date, 'YYYY-MM-DD') AS day
      FROM daily_checkins c, bounds
     WHERE c.user_id = ${userId}
       AND c.date > bounds.since
    ORDER BY day
  `);
  return rows.map((row) => row.day);
}
