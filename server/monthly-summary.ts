import "server-only";
import { z } from "zod";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { localDate } from "@/lib/domain/local-date";
import { daysInPeriod, periodLabel, previousPeriod } from "@/lib/domain/period";
import {
  buildMonthlySummary,
  type MonthlySummary,
  type MonthlySummaryInput,
} from "@/lib/domain/monthly-summary";
import { getRegisteredDatesBetween } from "./checkin";

const DEFAULT_TIMEZONE = "America/Sao_Paulo";

/** "YYYY-MM" with a real month (01–12). */
export const periodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

function monthBounds(period: string): { first: string; last: string } {
  return { first: `${period}-01`, last: `${period}-${String(daysInPeriod(period)).padStart(2, "0")}` };
}

/**
 * Whether the monthly summary of `previousPeriod` should be shown
 * automatically (design.md D1): the user has a cycle for it, the cycle has
 * activity (a manual expense or a no-spend check-in in the month) and the
 * user hasn't confirmed reading it yet. Returns the cycle id, or `null`.
 * Checks run cheapest-first and stop at the first one that fails.
 */
export async function getSummaryEligibility(
  userId: string,
  previousPeriod: string
): Promise<{ cycleId: string } | null> {
  const cycle = await prisma.budgetCycle.findUnique({
    where: { userId_period: { userId, period: previousPeriod } },
    select: { id: true },
  });
  if (!cycle) return null;

  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { lastSummarySeenPeriod: true },
  });
  if (settings?.lastSummarySeenPeriod === previousPeriod) return null;

  const { first, last } = monthBounds(previousPeriod);
  const [{ active }] = await prisma.$queryRaw<{ active: boolean }[]>(Prisma.sql`
    SELECT (
      EXISTS (
        SELECT 1 FROM expenses e
         WHERE e.cycle_id = ${cycle.id}::uuid
           AND e.user_id = ${userId}
           AND e.recurring_expense_id IS NULL
      )
      OR EXISTS (
        SELECT 1 FROM daily_checkins c
         WHERE c.user_id = ${userId}
           AND c.date >= ${first}::date
           AND c.date <= ${last}::date
      )
    ) AS active
  `);
  return active ? { cycleId: cycle.id } : null;
}

interface CycleTotalsRow {
  needsLimit: number;
  wantsLimit: number;
  savingsLimit: number;
  createdAt: Date;
  hasEarlierCycle: boolean;
  needsSpent: number;
  wantsSpent: number;
  savingsSpent: number;
  needsFixed: number;
  wantsFixed: number;
  savingsFixed: number;
}

/**
 * Everything `buildMonthlySummary` needs for the user's cycle of `period`
 * (design.md D5), all scoped by `userId`; `null` when the user has no cycle
 * for it (so another user's period reads as missing). Per-bucket totals and
 * recurring-bill totals come from one `SUM ... FILTER` query.
 */
export async function getMonthlySummaryData(
  userId: string,
  period: string
): Promise<MonthlySummaryInput | null> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  const timeZone = settings?.timezone ?? DEFAULT_TIMEZONE;

  const rows = await prisma.$queryRaw<(CycleTotalsRow & { id: string })[]>(Prisma.sql`
    SELECT
      c.id,
      c.needs_limit_cents   AS "needsLimit",
      c.wants_limit_cents   AS "wantsLimit",
      c.savings_limit_cents AS "savingsLimit",
      c.created_at          AS "createdAt",
      EXISTS (
        SELECT 1 FROM budget_cycles p
         WHERE p.user_id = c.user_id AND p.period < c.period
      )                     AS "hasEarlierCycle",
      COALESCE(SUM(e.amount_cents) FILTER (WHERE e.bucket = 'needs'), 0)::int   AS "needsSpent",
      COALESCE(SUM(e.amount_cents) FILTER (WHERE e.bucket = 'wants'), 0)::int   AS "wantsSpent",
      COALESCE(SUM(e.amount_cents) FILTER (WHERE e.bucket = 'savings'), 0)::int AS "savingsSpent",
      COALESCE(SUM(e.amount_cents) FILTER (
        WHERE e.bucket = 'needs' AND e.recurring_expense_id IS NOT NULL), 0)::int   AS "needsFixed",
      COALESCE(SUM(e.amount_cents) FILTER (
        WHERE e.bucket = 'wants' AND e.recurring_expense_id IS NOT NULL), 0)::int   AS "wantsFixed",
      COALESCE(SUM(e.amount_cents) FILTER (
        WHERE e.bucket = 'savings' AND e.recurring_expense_id IS NOT NULL), 0)::int AS "savingsFixed"
    FROM budget_cycles c
    LEFT JOIN expenses e
           ON e.cycle_id = c.id
          AND e.user_id = c.user_id
    WHERE c.user_id = ${userId}
      AND c.period = ${period}
    GROUP BY c.id
  `);
  const row = rows[0];
  if (!row) return null;

  const { first, last } = monthBounds(period);
  const [wantsExpenses, registeredDates] = await Promise.all([
    prisma.expense.findMany({
      where: { userId, cycleId: row.id, bucket: "wants" },
      select: { description: true, amountCents: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    getRegisteredDatesBetween(userId, timeZone, first, last),
  ]);

  return {
    period,
    limits: { needs: row.needsLimit, wants: row.wantsLimit, savings: row.savingsLimit },
    spent: { needs: row.needsSpent, wants: row.wantsSpent, savings: row.savingsSpent },
    fixed: { needs: row.needsFixed, wants: row.wantsFixed, savings: row.savingsFixed },
    wantsExpenses,
    registeredDates,
    cycleStartDate: localDate(timeZone, row.createdAt),
    hasEarlierCycle: row.hasEarlierCycle,
  };
}

/**
 * Records that the user confirmed reading the summary of `period` (D2). The
 * previous period is computed here from the user's local date; any other
 * `period` is ignored, so reviewing old months never touches the field.
 * Returns whether it wrote.
 */
export async function markSummarySeenFor(
  userId: string,
  period: string,
  now: Date = new Date()
): Promise<boolean> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  if (!settings) return false;

  const expected = previousPeriod(localDate(settings.timezone, now).slice(0, 7));
  if (period !== expected) return false;

  const { count } = await prisma.userSettings.updateMany({
    where: { userId },
    data: { lastSummarySeenPeriod: expected },
  });
  return count > 0;
}

/** Whether the user has a cycle for `period` — i.e. a summary exists to review. */
export async function hasCycleForPeriod(userId: string, period: string): Promise<boolean> {
  const cycle = await prisma.budgetCycle.findUnique({
    where: { userId_period: { userId, period } },
    select: { id: true },
  });
  return cycle !== null;
}

export interface SummaryView {
  period: string;
  summary: MonthlySummary;
  /** `period` is the month right before the user's current one. */
  isPrevious: boolean;
  /** Name of the user's current month ("novembro"), for the "Começar" button. */
  currentMonthLabel: string;
}

/**
 * What `/resumo/[period]` shows (design.md D6): `null` — the page answers
 * 404 — unless `rawPeriod` is a valid past period (before the user's current
 * month, in their time zone) that has a cycle of this user's own.
 */
export async function getSummaryView(
  userId: string,
  rawPeriod: string,
  now: Date = new Date()
): Promise<SummaryView | null> {
  const parsed = periodSchema.safeParse(rawPeriod);
  if (!parsed.success) return null;
  const period = parsed.data;

  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  const current = localDate(settings?.timezone ?? DEFAULT_TIMEZONE, now).slice(0, 7);
  if (period >= current) return null;

  const data = await getMonthlySummaryData(userId, period);
  if (!data) return null;

  return {
    period,
    summary: buildMonthlySummary(data),
    isPrevious: period === previousPeriod(current),
    currentMonthLabel: periodLabel(current),
  };
}
