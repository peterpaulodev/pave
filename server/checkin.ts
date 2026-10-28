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
 * The one query behind every "days the user registered" count: distinct local
 * dates ("YYYY-MM-DD", ascending) with a manual expense or a "no spend"
 * check-in, strictly after `since` and up to `until` (both SQL date
 * expressions). Automatic expenses from recurring bills don't count — they
 * say nothing about the habit (design.md D8). `created_at` is converted to
 * the user's local date in SQL, not in JS, so the day boundary is the user's.
 */
async function queryRegisteredDates(
  userId: string,
  timeZone: string,
  since: Prisma.Sql,
  until: Prisma.Sql
): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ day: string }[]>(Prisma.sql`
    WITH bounds AS (
      SELECT (${since})::date AS since, (${until})::date AS until
    )
    SELECT to_char(e.created_at AT TIME ZONE ${timeZone}, 'YYYY-MM-DD') AS day
      FROM expenses e, bounds
     WHERE e.user_id = ${userId}
       AND e.recurring_expense_id IS NULL
       AND (e.created_at AT TIME ZONE ${timeZone})::date > bounds.since
       AND (e.created_at AT TIME ZONE ${timeZone})::date <= bounds.until
    UNION
    SELECT to_char(c.date, 'YYYY-MM-DD') AS day
      FROM daily_checkins c, bounds
     WHERE c.user_id = ${userId}
       AND c.date > bounds.since
       AND c.date <= bounds.until
    ORDER BY day
  `);
  return rows.map((row) => row.day);
}

/** Registered local dates of the last `days` days (see `queryRegisteredDates`). */
export function getRegisteredDates(
  userId: string,
  timeZone: string,
  days = 60,
  now: Date = new Date()
): Promise<string[]> {
  return queryRegisteredDates(
    userId,
    timeZone,
    Prisma.sql`(${now}::timestamptz AT TIME ZONE ${timeZone})::date - ${days}::int`,
    Prisma.sql`'infinity'::date`
  );
}

/** Registered local dates from `from` through `to`, inclusive ("YYYY-MM-DD"). */
export function getRegisteredDatesBetween(
  userId: string,
  timeZone: string,
  from: string,
  to: string
): Promise<string[]> {
  return queryRegisteredDates(
    userId,
    timeZone,
    Prisma.sql`${from}::date - 1`,
    Prisma.sql`${to}::date`
  );
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
