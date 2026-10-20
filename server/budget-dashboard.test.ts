import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { createExpense, getCycleBalances, getOrCreateCycle } from "./queries";

// Mirrors specs/budget-dashboard/spec.md's own scenarios with their exact
// numbers, not just generic math — direct traceability from spec to test
// (tasks.md 10.2).
describe("budget-dashboard scenarios (integration)", () => {
  const userId = `test-${randomUUID()}`;
  const period = "2026-03";

  beforeAll(async () => {
    await prisma.user.create({
      data: { id: userId, email: `${userId}@example.test`, name: "Test User" },
    });
    // "usuário tem renda de R$ 5.000,00" — 500000 cents.
    await prisma.userSettings.create({
      data: { userId, defaultIncomeCents: 500000, onboardedAt: new Date() },
    });
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
  });

  it('"Saldo dentro do limite": R$ 800,00 gastos em Necessidades deixa R$ 1.700,00 disponíveis', async () => {
    const cycle = await getOrCreateCycle(userId, period);
    expect(cycle.needsLimitCents).toBe(250000); // 50% de R$ 5.000,00

    await createExpense(userId, {
      cycleId: cycle.id,
      amountCents: 80000, // R$ 800,00
      description: "contas",
      bucket: "needs",
      occurredOn: new Date("2026-03-05T00:00:00.000Z"),
    });

    const balances = await getCycleBalances(userId, cycle.id);
    expect(balances.needs.availableCents).toBe(170000); // R$ 1.700,00
    // "exibe os saldos de Lazer e Investimentos com base nos gastos de
    // cada um" — sem gastos ainda, os limites ficam cheios.
    expect(balances.wants.availableCents).toBe(balances.wants.limitCents);
    expect(balances.savings.availableCents).toBe(balances.savings.limitCents);
  });

  it('"Balde estourado": gasto acima do limite deixa availableCents negativo (valor excedido)', async () => {
    const cycle = await getOrCreateCycle(userId, period);
    const { availableCents: limitBefore } = await getCycleBalances(
      userId,
      cycle.id
    ).then((b) => b.wants);

    // Lazer (30% de R$ 5.000,00) = R$ 1.500,00; gasta R$ 2.000,00.
    await createExpense(userId, {
      cycleId: cycle.id,
      amountCents: 200000,
      description: "viagem",
      bucket: "wants",
      occurredOn: new Date("2026-03-10T00:00:00.000Z"),
    });

    const balances = await getCycleBalances(userId, cycle.id);
    expect(balances.wants.limitCents).toBe(150000);
    expect(balances.wants.spentCents).toBe(200000);
    // Estourou em R$ 500,00 — o painel usa Math.abs(availableCents) para
    // mostrar "Estourou R$ 500,00".
    expect(balances.wants.availableCents).toBe(-50000);
    expect(limitBefore).toBeGreaterThan(0); // sanity: estava ok antes
  });
});
