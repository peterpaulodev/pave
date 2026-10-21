import "server-only";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";

export interface DailyAllowanceInputs {
  wantsLimitCents: number;
  committedCents: number;
  spentTodayCents: number;
}

/**
 * Inputs for `computeDailyAllowance` (design.md D1/D3), in one aggregated
 * query scoped by `userId` and `cycleId`, leisure (`wants`) only:
 * - `spentTodayCents`: manual expenses (no recurring link) dated `today`;
 * - `committedCents`: every other leisure expense of the cycle — earlier or
 *   retroactive manual ones, future-dated manual ones, and all recurring
 *   ones whatever their date, even a recurring one due today.
 * `today` is the user's local date ("YYYY-MM-DD"). Returns `null` when the
 * cycle doesn't exist or isn't the user's.
 */
export async function getDailyAllowanceInputs(
  userId: string,
  cycleId: string,
  today: string
): Promise<DailyAllowanceInputs | null> {
  const rows = await prisma.$queryRaw<DailyAllowanceInputs[]>(Prisma.sql`
    SELECT
      c.wants_limit_cents AS "wantsLimitCents",
      COALESCE(SUM(e.amount_cents) FILTER (
        WHERE NOT (e.recurring_expense_id IS NULL AND e.occurred_on = ${today}::date)
      ), 0)::int AS "committedCents",
      COALESCE(SUM(e.amount_cents) FILTER (
        WHERE e.recurring_expense_id IS NULL AND e.occurred_on = ${today}::date
      ), 0)::int AS "spentTodayCents"
    FROM budget_cycles c
    LEFT JOIN expenses e
           ON e.cycle_id = c.id
          AND e.user_id = c.user_id
          AND e.bucket = 'wants'
    WHERE c.id = ${cycleId}::uuid
      AND c.user_id = ${userId}
    GROUP BY c.id
  `);
  return rows[0] ?? null;
}
