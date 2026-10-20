import "server-only";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { splitIncome, type Bucket } from "@/lib/domain/buckets";

// Every function here takes `userId` explicitly — it always comes from the
// caller's session (via getSessionUserOrRedirect()), never from client
// input — and every query is scoped by it. That's what keeps one user from
// ever reading or mutating another user's data.

export function getUserSettings(userId: string) {
  return prisma.userSettings.findUnique({ where: { userId } });
}

export interface UpsertUserSettingsInput {
  timezone?: string;
  defaultIncomeCents?: number;
  onboardedAt?: Date;
}

export function upsertUserSettings(
  userId: string,
  data: UpsertUserSettingsInput
) {
  return prisma.userSettings.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

/**
 * Returns the budget cycle for (userId, period), creating it — seeded from
 * the user's last known income (`defaultIncomeCents`) — if it doesn't
 * exist yet. `upsert` can still lose a race between two concurrent
 * requests for the same brand-new cycle (P2002); when that happens, the
 * other request already created the row, so read it back instead of
 * failing.
 */
export async function getOrCreateCycle(userId: string, period: string) {
  const settings = await getUserSettings(userId);
  const incomeCents = settings?.defaultIncomeCents ?? 0;
  const { needs, wants, savings } = splitIncome(incomeCents);

  try {
    return await prisma.budgetCycle.upsert({
      where: { userId_period: { userId, period } },
      create: {
        userId,
        period,
        incomeCents,
        needsLimitCents: needs,
        wantsLimitCents: wants,
        savingsLimitCents: savings,
      },
      update: {}, // cycle already exists — leave it untouched
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return prisma.budgetCycle.findUniqueOrThrow({
        where: { userId_period: { userId, period } },
      });
    }
    throw error;
  }
}

export interface CycleBalance {
  limitCents: number;
  spentCents: number;
  availableCents: number;
}

export type CycleBalances = Record<Bucket, CycleBalance>;

const BUCKETS: Bucket[] = ["needs", "wants", "savings"];

/** Balances are computed on read from limits − sum(expenses), never stored. */
export async function getCycleBalances(
  userId: string,
  cycleId: string
): Promise<CycleBalances> {
  const cycle = await prisma.budgetCycle.findFirstOrThrow({
    where: { id: cycleId, userId },
  });

  const grouped = await prisma.expense.groupBy({
    by: ["bucket"],
    where: { cycleId, userId },
    _sum: { amountCents: true },
  });

  const spentByBucket = new Map<string, number>(
    grouped.map((row) => [row.bucket, row._sum.amountCents ?? 0])
  );

  const limitsByBucket: Record<Bucket, number> = {
    needs: cycle.needsLimitCents,
    wants: cycle.wantsLimitCents,
    savings: cycle.savingsLimitCents,
  };

  return Object.fromEntries(
    BUCKETS.map((bucket) => {
      const limitCents = limitsByBucket[bucket];
      const spentCents = spentByBucket.get(bucket) ?? 0;
      return [
        bucket,
        { limitCents, spentCents, availableCents: limitCents - spentCents },
      ];
    })
  ) as CycleBalances;
}

export interface CreateExpenseInput {
  cycleId: string;
  amountCents: number;
  description: string;
  bucket: Bucket;
  occurredOn: Date;
}

export function createExpense(userId: string, input: CreateExpenseInput) {
  return prisma.expense.create({ data: { userId, ...input } });
}

/** Returns `false` instead of throwing when the expense doesn't exist, or
 * belongs to a different user — the two cases a client can't tell apart
 * anyway. */
export async function deleteExpense(
  userId: string,
  expenseId: string
): Promise<boolean> {
  const { count } = await prisma.expense.deleteMany({
    where: { id: expenseId, userId },
  });
  return count > 0;
}

/**
 * Takes `userId` in addition to `cycleId` (design.md's own sketch lists
 * just `listExpenses(cycleId)`, but every other query here is scoped by
 * userId per the rule at the top of this file — a cycle id alone would
 * let one user list another's expenses if they guessed/leaked the id).
 */
export function listExpenses(userId: string, cycleId: string) {
  return prisma.expense.findMany({
    where: { cycleId, userId },
    orderBy: { occurredOn: "desc" },
  });
}
