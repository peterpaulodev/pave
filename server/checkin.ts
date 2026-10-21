import "server-only";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";

/** Marks the local day `date` ("YYYY-MM-DD") as registered without an
 * expense. Idempotent: calling it again for the same day is a no-op.
 * Returns whether the check-in was newly created (analytics counts each
 * day once). */
export async function markNoSpend(userId: string, date: string): Promise<boolean> {
  const { count } = await prisma.dailyCheckin.createMany({
    data: [{ userId, date: new Date(`${date}T00:00:00.000Z`) }],
    skipDuplicates: true,
  });
  return count > 0;
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
  days = 60,
  now: Date = new Date()
): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ day: string }[]>(Prisma.sql`
    WITH bounds AS (
      SELECT (${now}::timestamptz AT TIME ZONE ${timeZone})::date - ${days}::int AS since
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

/** Whether the user has ever saved a manual (non-recurring) expense — what
 * triggers the reminder invite right after the first expense. */
export async function hasManualExpense(userId: string): Promise<boolean> {
  const found = await prisma.expense.findFirst({
    where: { userId, recurringExpenseId: null },
    select: { id: true },
  });
  return found !== null;
}
