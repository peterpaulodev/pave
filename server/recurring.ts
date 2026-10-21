import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { Bucket } from "@/lib/domain/buckets";
import { resolveDueDate } from "@/lib/domain/recurring";

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
    where: { userId },
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
    where: { id, userId },
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
    where: { id, userId },
    data: { active },
  });
  return count > 0;
}

/** Already-launched expenses stay (their `recurringExpenseId` is nulled by
 * the FK's ON DELETE SET NULL). */
export async function deleteRecurring(
  userId: string,
  id: string
): Promise<boolean> {
  const { count } = await prisma.recurringExpense.deleteMany({
    where: { id, userId },
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
 * (recurringExpenseId, cycleId) is a second safety net. Returns how many
 * expenses were created.
 */
export async function applyRecurringInTransaction(
  tx: Prisma.TransactionClient,
  userId: string,
  cycleId: string
): Promise<number> {
  const claimed = await tx.budgetCycle.updateMany({
    where: { id: cycleId, userId, recurringAppliedAt: null },
    data: { recurringAppliedAt: new Date() },
  });
  if (claimed.count === 0) return 0;

  const [cycle, templates] = await Promise.all([
    tx.budgetCycle.findFirstOrThrow({ where: { id: cycleId, userId } }),
    tx.recurringExpense.findMany({ where: { userId, active: true } }),
  ]);
  if (templates.length === 0) return 0;

  const { count } = await tx.expense.createMany({
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
  });
  return count;
}

export function applyRecurringToCycle(
  userId: string,
  cycleId: string
): Promise<number> {
  return prisma.$transaction((tx) =>
    applyRecurringInTransaction(tx, userId, cycleId)
  );
}
