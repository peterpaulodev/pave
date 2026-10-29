import "server-only";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { Bucket } from "@/lib/domain/buckets";
import {
  STARTER_CHIPS,
  buildEntryChips,
  groupFrequentDescriptions,
  type DescriptionStat,
  type EntryChip,
  type FrequentDescription,
} from "@/lib/domain/entry-chips";
import { allowedDateRange } from "@/lib/domain/entry-date";
import type { EntryImpactContext } from "@/lib/domain/entry-impact";
import { computeDailyAllowance } from "@/lib/domain/daily-allowance";
import { localDate } from "@/lib/domain/local-date";
import { currentPeriod } from "@/lib/domain/period";
import { getDailyAllowanceInputs } from "./daily-allowance";
import { getCycleBalances, getOrCreateCycle, getUserSettings } from "./queries";

const HISTORY_DAYS = 90;
const CHIP_LIMIT = 6;

async function userTimezone(userId: string): Promise<string> {
  return (await getUserSettings(userId))?.timezone ?? "America/Sao_Paulo";
}

interface DescriptionRow {
  description: string;
  bucket: Bucket;
  count: number;
  lastOccurredOn: string;
  lastCreatedAt: number;
}

/**
 * The user's most used descriptions in manual expenses (no recurring link) of
 * the last 90 days up to `today` — the day itself plus the 89 before it
 * (design.md D3).
 *
 * One aggregated query counts per exact (description, bucket) pair and finds
 * the latest expense of each; the equivalence between spellings ("ifood 30",
 * "iFood", "IFOOD", "Farmácia"/"farmacia") is applied in TS by
 * `groupFrequentDescriptions`, on top of `normalizeText`. It can't be done in
 * SQL without the `unaccent` extension (a migration) and a second copy of the
 * normalization rules, and after the GROUP BY the TS side only sees one row
 * per spelling, not per expense.
 *
 * `today` is the user's local date; it defaults to it.
 */
export async function getFrequentDescriptions(
  userId: string,
  limit = CHIP_LIMIT,
  today?: string
): Promise<FrequentDescription[]> {
  const day = today ?? localDate(await userTimezone(userId));

  const rows = await prisma.$queryRaw<DescriptionRow[]>(Prisma.sql`
    SELECT
      description,
      bucket::text AS bucket,
      COUNT(*)::int AS count,
      to_char(MAX(occurred_on), 'YYYY-MM-DD') AS "lastOccurredOn",
      FLOOR(EXTRACT(EPOCH FROM (
        (ARRAY_AGG(created_at ORDER BY occurred_on DESC, created_at DESC))[1]
      )) * 1000)::float8 AS "lastCreatedAt"
    FROM expenses
    WHERE user_id = ${userId}
      AND recurring_expense_id IS NULL
      AND occurred_on > ${day}::date - ${HISTORY_DAYS}::int
    GROUP BY description, bucket
  `);

  return groupFrequentDescriptions(rows satisfies DescriptionStat[], limit);
}

export interface EntryContext extends EntryImpactContext {
  chips: EntryChip[];
  /** Pickable dates: the 1st of the current month through today. */
  dateRange: { min: string; max: string };
}

/**
 * Everything the entry screen needs when it opens (design.md D3/D5/D6):
 * chips, what is left per bucket, today's leisure allowance and the user's
 * local date. Like the dashboard, it creates the month's cycle on demand.
 */
export async function getEntryContext(userId: string): Promise<EntryContext> {
  const timezone = await userTimezone(userId);
  const today = localDate(timezone);
  const cycle = await getOrCreateCycle(userId, currentPeriod(timezone));

  const [balances, allowanceInputs, history] = await Promise.all([
    getCycleBalances(userId, cycle.id),
    getDailyAllowanceInputs(userId, cycle.id, today),
    getFrequentDescriptions(userId, CHIP_LIMIT, today),
  ]);
  const allowance = allowanceInputs
    ? computeDailyAllowance({ ...allowanceInputs, today })
    : null;

  return {
    today,
    chips: buildEntryChips(history, STARTER_CHIPS, CHIP_LIMIT),
    availableCents: {
      needs: balances.needs.availableCents,
      wants: balances.wants.availableCents,
    },
    savedCents: balances.savings.spentCents,
    remainingTodayCents: allowance?.remainingTodayCents ?? balances.wants.availableCents,
    dateRange: allowedDateRange(today),
  };
}
