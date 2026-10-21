import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { Bucket } from "@/lib/domain/buckets";
import { resolveDueDate } from "@/lib/domain/recurring";
import { trackEvents } from "@/server/analytics";

// Same rule as queries.ts: every function takes `userId` from the caller's
// session (never from client input) and scopes every query by it. Mutations
// return `false` when the row doesn't exist or belongs to someone else —
// the two cases a client can't tell apart anyway.

export interface RecurringInput {
  description: string;
  amountCents: number;
  bucket: Bucket;
  dayOfMonth: number;
}

export function listRecurring(userId: string) {
  return prisma.recurringExpense.findMany({
    where: { userId, deletedAt: null },
    orderBy: [{ dayOfMonth: "asc" }, { createdAt: "asc" }],
  });
}

export interface CreateRecurringInput extends RecurringInput {
  /** Also launch this month's expense in the given (own) cycle, in the
   * same transaction as the template (design.md D3). */
  alsoThisMonth?: { cycleId: string };
}

export function createRecurring(userId: string, input: CreateRecurringInput) {
  const { alsoThisMonth, ...data } = input;

  return prisma.$transaction(async (tx) => {
    const recurring = await tx.recurringExpense.create({
      data: { userId, ...data },
    });

    if (alsoThisMonth) {
      const cycle = await tx.budgetCycle.findFirstOrThrow({
        where: { id: alsoThisMonth.cycleId, userId },
      });
      await tx.expense.create({
        data: {
          userId,
          cycleId: cycle.id,
          recurringExpenseId: recurring.id,
          description: recurring.description,
          amountCents: recurring.amountCents,
          bucket: recurring.bucket,
          occurredOn: dueDateAsDate(cycle.period, recurring.dayOfMonth),
        },
      });
    }

    return recurring;
  });
}

/** Edits the template only — expenses already launched don't change (D1). */
export async function updateRecurring(
  userId: string,
  id: string,
  data: Partial<RecurringInput>
): Promise<boolean> {
  const { count } = await prisma.recurringExpense.updateMany({
    where: { id, userId, deletedAt: null },
    data,
  });
  return count > 0;
}

export async function setRecurringActive(
  userId: string,
  id: string,
  active: boolean
): Promise<boolean> {
  const { count } = await prisma.recurringExpense.updateMany({
    where: { id, userId, deletedAt: null },
    data: { active },
  });
  return count > 0;
}

/**
 * Soft delete: the template is hidden and deactivated but kept, so the
 * expenses it already launched keep their link (and their "Fixa" badge).
 * Nothing is physically deleted, so the FK's ON DELETE SET NULL never fires.
 */
export async function deleteRecurring(
  userId: string,
  id: string
): Promise<boolean> {
  const { count } = await prisma.recurringExpense.updateMany({
    where: { id, userId, deletedAt: null },
    data: { deletedAt: new Date(), active: false },
  });
  return count > 0;
}

function dueDateAsDate(period: string, dayOfMonth: number): Date {
  return new Date(`${resolveDueDate(period, dayOfMonth)}T00:00:00.000Z`);
}

/**
 * Launches the user's active recurring expenses into `cycleId`, once
 * (design.md D2). The cycle's `recurringAppliedAt` is claimed first with a
 * conditional update — a concurrent caller blocks on that row, then sees it
 * already set and does nothing — so deleting an automatic expense never
 * leads to it being recreated. `skipDuplicates` plus the unique
 * (recurringExpenseId, cycleId) is a second safety net. Returns the bucket
 * of each expense actually created (for analytics; its length is the count).
 */
export async function applyRecurringInTransaction(
  tx: Prisma.TransactionClient,
  userId: string,
  cycleId: string
): Promise<Bucket[]> {
  const claimed = await tx.budgetCycle.updateMany({
    where: { id: cycleId, userId, recurringAppliedAt: null },
    data: { recurringAppliedAt: new Date() },
  });
  if (claimed.count === 0) return [];

  const [cycle, templates] = await Promise.all([
    tx.budgetCycle.findFirstOrThrow({ where: { id: cycleId, userId } }),
    tx.recurringExpense.findMany({
      where: { userId, active: true, deletedAt: null },
    }),
  ]);
  if (templates.length === 0) return [];

  const created = await tx.expense.createManyAndReturn({
    data: templates.map((template) => ({
      userId,
      cycleId,
      recurringExpenseId: template.id,
      description: template.description,
      amountCents: template.amountCents,
      bucket: template.bucket,
      occurredOn: dueDateAsDate(cycle.period, template.dayOfMonth),
    })),
    skipDuplicates: true,
    select: { bucket: true },
  });
  return created.map((expense) => expense.bucket);
}

/** One `expense_created` (source `recurring`, no suggestion) per expense
 * launched — a single batched write, scheduled after the commit. */
export function trackRecurringLaunched(userId: string, buckets: Bucket[]): void {
  trackEvents(
    userId,
    "expense_created",
    buckets.map((bucket) => ({
      source: "recurring" as const,
      bucket,
      suggestedBucket: null,
      overridden: false,
    }))
  );
}

export async function applyRecurringToCycle(
  userId: string,
  cycleId: string
): Promise<number> {
  const buckets = await prisma.$transaction((tx) =>
    applyRecurringInTransaction(tx, userId, cycleId)
  );
  trackRecurringLaunched(userId, buckets);
  return buckets.length;
}

export function countRecurring(userId: string): Promise<number> {
  return prisma.recurringExpense.count({ where: { userId, deletedAt: null } });
}

/** Per-bucket sum of the cycle's expenses that came from a recurring
 * expense — scheduled (future-dated) ones included, since the money is
 * already committed (design.md D4). */
export async function getRecurringTotalsByBucket(
  userId: string,
  cycleId: string
): Promise<Record<Bucket, number>> {
  const grouped = await prisma.expense.groupBy({
    by: ["bucket"],
    where: { cycleId, userId, recurringExpenseId: { not: null } },
    _sum: { amountCents: true },
  });

  const totals: Record<Bucket, number> = { needs: 0, wants: 0, savings: 0 };
  for (const row of grouped) {
    totals[row.bucket] = row._sum.amountCents ?? 0;
  }
  return totals;
}
