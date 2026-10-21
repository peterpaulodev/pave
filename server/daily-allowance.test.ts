import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { getDailyAllowanceInputs } from "./daily-allowance";

// Hits the real Neon database — run via `pnpm test:integration`.
const TODAY = "2031-06-15";
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const users: string[] = [];

async function setup(wantsLimitCents = 150000) {
  const userId = `test-${randomUUID()}`;
  users.push(userId);
  await prisma.user.create({ data: { id: userId, email: `${userId}@example.test`, name: "T" } });
  const cycle = await prisma.budgetCycle.create({
    data: {
      userId, period: "2031-06", incomeCents: 500000,
      needsLimitCents: 250000, wantsLimitCents, savingsLimitCents: 100000,
    },
  });
  const add = (
    amountCents: number,
    occurredOn: string,
    opts: { bucket?: "needs" | "wants" | "savings"; recurringExpenseId?: string; cycleId?: string; user?: string } = {}
  ) =>
    prisma.expense.create({
      data: {
        userId: opts.user ?? userId, cycleId: opts.cycleId ?? cycle.id, amountCents,
        description: "x", bucket: opts.bucket ?? "wants", occurredOn: day(occurredOn),
        recurringExpenseId: opts.recurringExpenseId ?? null,
      },
    });
  const template = (bucket: "needs" | "wants" = "wants") =>
    prisma.recurringExpense.create({
      data: { userId, description: "Fixa", amountCents: 1, bucket, dayOfMonth: 20 },
    });
  return { userId, cycle, add, template };
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: users } } });
});

describe("getDailyAllowanceInputs", () => {
  it("ciclo sem gastos: zeros e o limite de Lazer", async () => {
    const { userId, cycle } = await setup(150000);
    expect(await getDailyAllowanceInputs(userId, cycle.id, TODAY)).toEqual({
      wantsLimitCents: 150000, committedCents: 0, spentTodayCents: 0,
    });
  });

  it("manual de hoje vai para spentTodayCents", async () => {
    const { userId, cycle, add } = await setup();
    await add(1500, TODAY);
    await add(500, TODAY);
    expect(await getDailyAllowanceInputs(userId, cycle.id, TODAY)).toMatchObject({
      committedCents: 0, spentTodayCents: 2000,
    });
  });

  it("manual de ontem e retroativo vão para committedCents", async () => {
    const { userId, cycle, add } = await setup();
    await add(3000, "2031-06-14"); // ontem
    await add(700, "2031-06-02"); // retroativo
    expect(await getDailyAllowanceInputs(userId, cycle.id, TODAY)).toMatchObject({
      committedCents: 3700, spentTodayCents: 0,
    });
  });

  it("manual com data futura entra em committedCents", async () => {
    const { userId, cycle, add } = await setup();
    await add(4000, "2031-06-25");
    expect(await getDailyAllowanceInputs(userId, cycle.id, TODAY)).toMatchObject({
      committedCents: 4000, spentTodayCents: 0,
    });
  });

  it("conta fixa de Lazer agendada vai para committedCents — inclusive a que vence hoje", async () => {
    const { userId, cycle, add, template } = await setup();
    await add(12000, "2031-06-20", { recurringExpenseId: (await template()).id });
    await add(5000, TODAY, { recurringExpenseId: (await template()).id }); // vence hoje
    await add(900, "2031-06-03", { recurringExpenseId: (await template()).id }); // já passou
    expect(await getDailyAllowanceInputs(userId, cycle.id, TODAY)).toMatchObject({
      committedCents: 17900, spentTodayCents: 0,
    });
  });

  it("separa tudo junto: hoje, ontem, futuro e conta fixa", async () => {
    const { userId, cycle, add, template } = await setup();
    await add(1500, TODAY);
    await add(3000, "2031-06-14");
    await add(4000, "2031-06-25");
    await add(12000, "2031-06-20", { recurringExpenseId: (await template()).id });
    expect(await getDailyAllowanceInputs(userId, cycle.id, TODAY)).toEqual({
      wantsLimitCents: 150000, committedCents: 19000, spentTodayCents: 1500,
    });
  });

  it("ignora gastos de outros baldes", async () => {
    const { userId, cycle, add } = await setup();
    await add(9999, TODAY, { bucket: "needs" });
    await add(8888, "2031-06-14", { bucket: "savings" });
    await add(7777, "2031-06-20", { bucket: "needs", recurringExpenseId: (await prisma.recurringExpense.create({
      data: { userId, description: "Aluguel", amountCents: 1, bucket: "needs", dayOfMonth: 20 },
    })).id });
    expect(await getDailyAllowanceInputs(userId, cycle.id, TODAY)).toMatchObject({
      committedCents: 0, spentTodayCents: 0,
    });
  });

  it("ignora gastos de outro ciclo do mesmo usuário", async () => {
    const { userId, cycle, add } = await setup();
    const other = await prisma.budgetCycle.create({
      data: {
        userId, period: "2031-05", incomeCents: 1, needsLimitCents: 1, wantsLimitCents: 1, savingsLimitCents: 1,
      },
    });
    await add(5555, TODAY, { cycleId: other.id });
    await add(1000, TODAY);
    expect(await getDailyAllowanceInputs(userId, cycle.id, TODAY)).toMatchObject({
      committedCents: 0, spentTodayCents: 1000,
    });
  });

  it("outro usuário não enxerga o ciclo nem soma os gastos dele", async () => {
    const a = await setup();
    await a.add(1000, TODAY);
    const b = await setup();
    await b.add(300, TODAY);

    // ciclo de A consultado como B: nada
    expect(await getDailyAllowanceInputs(b.userId, a.cycle.id, TODAY)).toBeNull();
    // cada um vê só o seu
    expect(await getDailyAllowanceInputs(a.userId, a.cycle.id, TODAY)).toMatchObject({ spentTodayCents: 1000 });
    expect(await getDailyAllowanceInputs(b.userId, b.cycle.id, TODAY)).toMatchObject({ spentTodayCents: 300 });
  });

  it("soft delete da conta fixa não altera os valores", async () => {
    const { userId, cycle, add, template } = await setup();
    const fixa = await template();
    await add(12000, "2031-06-20", { recurringExpenseId: fixa.id });
    await add(1500, TODAY);
    const before = await getDailyAllowanceInputs(userId, cycle.id, TODAY);

    await prisma.recurringExpense.update({
      where: { id: fixa.id },
      data: { deletedAt: new Date(), active: false },
    });

    const after = await getDailyAllowanceInputs(userId, cycle.id, TODAY);
    expect(after).toEqual(before);
    expect(after).toMatchObject({ committedCents: 12000, spentTodayCents: 1500 });
  });

  it("ciclo inexistente: null", async () => {
    const { userId } = await setup();
    expect(await getDailyAllowanceInputs(userId, randomUUID(), TODAY)).toBeNull();
  });
});
