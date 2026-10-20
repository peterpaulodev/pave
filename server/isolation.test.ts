import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import {
  createExpense,
  deleteExpense,
  getCycleBalances,
  getOrCreateCycle,
  listExpenses,
  upsertUserSettings,
} from "./queries";

// Dedicated isolation test, per tasks.md 10.3 / design.md's threat model:
// user A must never be able to read or mutate user B's cycle or expenses,
// even if A somehow learns B's cycle/expense id (e.g. a leaked URL).
// Every query here is scoped by userId (see the comment at the top of
// queries.ts) — this proves that scoping actually holds end to end
// against the real database, not just by code inspection.
describe("cross-user data isolation (integration)", () => {
  const userA = `test-${randomUUID()}`;
  const userB = `test-${randomUUID()}`;
  const period = "2026-02";
  let cycleAId: string;
  let expenseAId: string;

  beforeAll(async () => {
    await prisma.user.createMany({
      data: [
        { id: userA, email: `${userA}@example.test`, name: "User A" },
        { id: userB, email: `${userB}@example.test`, name: "User B" },
      ],
    });

    await upsertUserSettings(userA, { defaultIncomeCents: 500000 });
    const cycleA = await getOrCreateCycle(userA, period);
    cycleAId = cycleA.id;

    const expenseA = await createExpense(userA, {
      cycleId: cycleAId,
      amountCents: 10000,
      description: "gasto da usuária A",
      bucket: "needs",
      occurredOn: new Date("2026-02-01T00:00:00.000Z"),
    });
    expenseAId = expenseA.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
  });

  it("getCycleBalances refuses user B reading user A's cycle", async () => {
    await expect(getCycleBalances(userB, cycleAId)).rejects.toThrow();
  });

  it("listExpenses returns nothing for user B against user A's cycle", async () => {
    expect(await listExpenses(userB, cycleAId)).toEqual([]);
  });

  it("deleteExpense refuses user B deleting user A's expense", async () => {
    expect(await deleteExpense(userB, expenseAId)).toBe(false);

    // And user A's expense must still be there afterwards.
    const stillThere = await listExpenses(userA, cycleAId);
    expect(stillThere.map((e) => e.id)).toContain(expenseAId);
  });

  it("user A's data is unaffected by user B's own (empty) cycle", async () => {
    // getOrCreateCycle needs a positive income to seed a new cycle — in
    // the real app this is always true by the time it's called (the
    // (app) layout guard requires onboarding, which sets it), but this
    // test calls it directly for a user who hasn't onboarded yet.
    await upsertUserSettings(userB, { defaultIncomeCents: 300000 });
    const cycleB = await getOrCreateCycle(userB, period);
    expect(cycleB.id).not.toBe(cycleAId);
    expect(await listExpenses(userB, cycleB.id)).toEqual([]);

    // Confirms the two users' cycles for the same period are genuinely
    // separate rows, not accidentally shared via the (userId, period)
    // unique constraint.
    const balancesA = await getCycleBalances(userA, cycleAId);
    expect(balancesA.needs.spentCents).toBe(10000);
  });
});
