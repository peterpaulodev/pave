import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import {
  createExpense,
  deleteExpense,
  getCycleBalances,
  getOrCreateCycle,
  getUserSettings,
  listExpenses,
  upsertUserSettings,
} from "./queries";

// These hit the real Neon database configured via DATABASE_URL (there is
// no local/in-memory substitute for Postgres here). Skipped when it isn't
// set, e.g. a fresh clone before `.env.local` is configured.
describe.skipIf(!process.env.DATABASE_URL)("server/queries (integration)", () => {
  const userId = `test-${randomUUID()}`;
  const period = "2026-01";

  beforeAll(async () => {
    await prisma.user.create({
      data: { id: userId, email: `${userId}@example.test`, name: "Test User" },
    });
  });

  afterAll(async () => {
    // Cascades to UserSettings/BudgetCycle/Expense via the schema's
    // onDelete: Cascade.
    await prisma.user.delete({ where: { id: userId } });
  });

  it("upsertUserSettings and getUserSettings round-trip", async () => {
    expect(await getUserSettings(userId)).toBeNull();

    await upsertUserSettings(userId, { defaultIncomeCents: 500000 });
    const settings = await getUserSettings(userId);
    expect(settings?.defaultIncomeCents).toBe(500000);

    await upsertUserSettings(userId, { defaultIncomeCents: 600000 });
    expect((await getUserSettings(userId))?.defaultIncomeCents).toBe(600000);
  });

  it("getOrCreateCycle creates a cycle seeded from defaultIncomeCents, then returns the same one", async () => {
    const created = await getOrCreateCycle(userId, period);
    expect(created.incomeCents).toBe(600000);
    expect(created.needsLimitCents).toBe(300000);
    expect(created.wantsLimitCents).toBe(180000);
    expect(created.savingsLimitCents).toBe(120000);

    const again = await getOrCreateCycle(userId, period);
    expect(again.id).toBe(created.id);
  });

  it("getCycleBalances subtracts expenses from limits per bucket", async () => {
    const cycle = await getOrCreateCycle(userId, period);

    await createExpense(userId, {
      cycleId: cycle.id,
      amountCents: 50000,
      description: "mercado",
      bucket: "needs",
      occurredOn: new Date("2026-01-05T00:00:00.000Z"),
    });
    await createExpense(userId, {
      cycleId: cycle.id,
      amountCents: 2000,
      description: "ifood",
      bucket: "wants",
      occurredOn: new Date("2026-01-06T00:00:00.000Z"),
    });

    const balances = await getCycleBalances(userId, cycle.id);
    expect(balances.needs).toEqual({
      limitCents: 300000,
      spentCents: 50000,
      availableCents: 250000,
    });
    expect(balances.wants).toEqual({
      limitCents: 180000,
      spentCents: 2000,
      availableCents: 178000,
    });
    expect(balances.savings).toEqual({
      limitCents: 120000,
      spentCents: 0,
      availableCents: 120000,
    });
  });

  it("listExpenses returns only this user's expenses, newest first", async () => {
    const cycle = await getOrCreateCycle(userId, period);
    const expenses = await listExpenses(userId, cycle.id);

    expect(expenses).toHaveLength(2);
    expect(expenses[0].description).toBe("ifood"); // occurredOn 01-06, newest first
    expect(expenses[1].description).toBe("mercado");
    expect(expenses.every((e) => e.userId === userId)).toBe(true);
  });

  it("deleteExpense removes it and returns false if it's already gone", async () => {
    const cycle = await getOrCreateCycle(userId, period);
    const [expense] = await listExpenses(userId, cycle.id);

    expect(await deleteExpense(userId, expense.id)).toBe(true);
    expect(await deleteExpense(userId, expense.id)).toBe(false);
  });

  it("deleteExpense refuses to delete another user's expense", async () => {
    const cycle = await getOrCreateCycle(userId, period);
    const [expense] = await listExpenses(userId, cycle.id);

    expect(await deleteExpense("someone-else", expense.id)).toBe(false);
    expect(await listExpenses(userId, cycle.id)).toHaveLength(1);
  });
});
