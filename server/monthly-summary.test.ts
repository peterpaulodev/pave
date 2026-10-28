import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import {
  getMonthlySummaryData,
  getSummaryEligibility,
  markSummarySeenFor,
} from "./monthly-summary";

// Hits the real Neon database — run via `pnpm test:integration`.
const TZ = "America/Sao_Paulo";
const PERIOD = "2031-06";
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

type BucketName = "needs" | "wants" | "savings";

const users: string[] = [];

async function newUser(settings: { lastSummarySeenPeriod?: string } = {}) {
  const userId = `test-${randomUUID()}`;
  users.push(userId);
  await prisma.user.create({ data: { id: userId, email: `${userId}@example.test`, name: "T" } });
  await prisma.userSettings.create({ data: { userId, timezone: TZ, ...settings } });
  return userId;
}

function newCycle(userId: string, period = PERIOD, createdAt?: Date) {
  return prisma.budgetCycle.create({
    data: {
      userId, period, incomeCents: 500000, needsLimitCents: 250000,
      wantsLimitCents: 150000, savingsLimitCents: 100000,
      ...(createdAt ? { createdAt } : {}),
    },
  });
}

function addExpense(
  userId: string,
  cycleId: string,
  amountCents: number,
  opts: { bucket?: BucketName; description?: string; recurringExpenseId?: string; createdAt?: Date } = {}
) {
  return prisma.expense.create({
    data: {
      userId, cycleId, amountCents, description: opts.description ?? "x",
      bucket: opts.bucket ?? "wants", occurredOn: day("2031-06-10"),
      recurringExpenseId: opts.recurringExpenseId ?? null,
      ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
    },
  });
}

function newTemplate(userId: string, bucket: BucketName = "needs") {
  return prisma.recurringExpense.create({
    data: { userId, description: "Fixa", amountCents: 1, bucket, dayOfMonth: 5 },
  });
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: users } } });
});

describe("getSummaryEligibility", () => {
  it("ciclo com gasto manual: elegível, devolve o cycleId", async () => {
    const userId = await newUser();
    const cycle = await newCycle(userId);
    await addExpense(userId, cycle.id, 1000);
    expect(await getSummaryEligibility(userId, PERIOD)).toEqual({ cycleId: cycle.id });
  });

  it("ciclo só com um dia sem gasto (check-in): elegível", async () => {
    const userId = await newUser();
    const cycle = await newCycle(userId);
    await prisma.dailyCheckin.create({ data: { userId, date: day("2031-06-30") } });
    expect(await getSummaryEligibility(userId, PERIOD)).toEqual({ cycleId: cycle.id });
  });

  it("só contas fixas: não elegível", async () => {
    const userId = await newUser();
    const cycle = await newCycle(userId);
    const template = await newTemplate(userId);
    await addExpense(userId, cycle.id, 1000, { recurringExpenseId: template.id });
    expect(await getSummaryEligibility(userId, PERIOD)).toBeNull();
  });

  it("ciclo vazio: não elegível", async () => {
    const userId = await newUser();
    await newCycle(userId);
    expect(await getSummaryEligibility(userId, PERIOD)).toBeNull();
  });

  it("sem ciclo no período: não elegível", async () => {
    const userId = await newUser();
    const other = await newCycle(userId, "2031-05");
    await addExpense(userId, other.id, 1000);
    expect(await getSummaryEligibility(userId, PERIOD)).toBeNull();
  });

  it("já visto: não elegível; visto de outro período não bloqueia", async () => {
    const seen = await newUser({ lastSummarySeenPeriod: PERIOD });
    const seenCycle = await newCycle(seen);
    await addExpense(seen, seenCycle.id, 1000);
    expect(await getSummaryEligibility(seen, PERIOD)).toBeNull();

    const older = await newUser({ lastSummarySeenPeriod: "2031-05" });
    const olderCycle = await newCycle(older);
    await addExpense(older, olderCycle.id, 1000);
    expect(await getSummaryEligibility(older, PERIOD)).toEqual({ cycleId: olderCycle.id });
  });

  it("não enxerga atividade de outro usuário", async () => {
    const a = await newUser();
    const b = await newUser();
    await newCycle(a);
    const cycleB = await newCycle(b);
    await addExpense(b, cycleB.id, 1000);
    await prisma.dailyCheckin.create({ data: { userId: b, date: day("2031-06-02") } });
    expect(await getSummaryEligibility(a, PERIOD)).toBeNull();
  });

  it("check-in de outro mês não conta como atividade do ciclo", async () => {
    const userId = await newUser();
    await newCycle(userId);
    await prisma.dailyCheckin.create({ data: { userId, date: day("2031-07-01") } });
    expect(await getSummaryEligibility(userId, PERIOD)).toBeNull();
  });
});

describe("getMonthlySummaryData", () => {
  it("soma por balde e de contas fixas, ignorando outros ciclos e outros usuários", async () => {
    const userId = await newUser();
    const other = await newUser();
    const cycle = await newCycle(userId);
    const otherMonth = await newCycle(userId, "2031-05");
    const otherUserCycle = await newCycle(other);
    const template = await newTemplate(userId, "needs");

    await addExpense(userId, cycle.id, 10000, { bucket: "needs" });
    await addExpense(userId, cycle.id, 150000, { bucket: "needs", recurringExpenseId: template.id });
    await addExpense(userId, cycle.id, 4500, { bucket: "wants", description: "iFood 45" });
    await addExpense(userId, cycle.id, 6000, { bucket: "savings" });
    await addExpense(userId, otherMonth.id, 99999, { bucket: "needs" });
    await addExpense(other, otherUserCycle.id, 88888, { bucket: "needs" });

    const data = await getMonthlySummaryData(userId, PERIOD);
    expect(data).not.toBeNull();
    expect(data!.period).toBe(PERIOD);
    expect(data!.limits).toEqual({ needs: 250000, wants: 150000, savings: 100000 });
    expect(data!.spent).toEqual({ needs: 160000, wants: 4500, savings: 6000 });
    expect(data!.fixed).toEqual({ needs: 150000, wants: 0, savings: 0 });
    expect(data!.wantsExpenses).toEqual([{ description: "iFood 45", amountCents: 4500 }]);
  });

  it("baldes sem gasto voltam zerados", async () => {
    const userId = await newUser();
    await newCycle(userId);
    const data = await getMonthlySummaryData(userId, PERIOD);
    expect(data!.spent).toEqual({ needs: 0, wants: 0, savings: 0 });
    expect(data!.fixed).toEqual({ needs: 0, wants: 0, savings: 0 });
    expect(data!.wantsExpenses).toEqual([]);
  });

  it("período de outro usuário ou sem ciclo: null", async () => {
    const owner = await newUser();
    const stranger = await newUser();
    await newCycle(owner);
    expect(await getMonthlySummaryData(stranger, PERIOD)).toBeNull();
    expect(await getMonthlySummaryData(owner, "2031-01")).toBeNull();
  });

  it("dias registrados: data local, sem gasto automático, com check-in, só do período", async () => {
    const userId = await newUser();
    const cycle = await newCycle(userId);
    const template = await newTemplate(userId);

    // 2031-06-10T02:00Z é 2031-06-09 em São Paulo (UTC-3)
    await addExpense(userId, cycle.id, 100, { createdAt: new Date("2031-06-10T02:00:00Z") });
    await addExpense(userId, cycle.id, 100, { createdAt: new Date("2031-06-12T15:00:00Z") });
    // automático: não conta
    await addExpense(userId, cycle.id, 100, {
      recurringExpenseId: template.id, createdAt: new Date("2031-06-20T15:00:00Z"),
    });
    await prisma.dailyCheckin.create({ data: { userId, date: day("2031-06-15") } });
    // fora do período: não entram
    await prisma.dailyCheckin.create({ data: { userId, date: day("2031-05-31") } });
    await prisma.dailyCheckin.create({ data: { userId, date: day("2031-07-01") } });
    await addExpense(userId, cycle.id, 100, { createdAt: new Date("2031-07-01T02:00:00Z") }); // 30/06 local

    const data = await getMonthlySummaryData(userId, PERIOD);
    expect(data!.registeredDates).toEqual(["2031-06-09", "2031-06-12", "2031-06-15", "2031-06-30"]);
  });

  it("hasEarlierCycle: só é verdadeiro com ciclo do próprio usuário de período anterior", async () => {
    const alone = await newUser();
    await newCycle(alone);
    expect((await getMonthlySummaryData(alone, PERIOD))!.hasEarlierCycle).toBe(false);

    const withEarlier = await newUser();
    await newCycle(withEarlier, "2031-04");
    await newCycle(withEarlier);
    expect((await getMonthlySummaryData(withEarlier, PERIOD))!.hasEarlierCycle).toBe(true);

    // ciclo posterior não conta, nem o de outro usuário
    const laterOnly = await newUser();
    await newCycle(laterOnly);
    await newCycle(laterOnly, "2031-08");
    const other = await newUser();
    await newCycle(other, "2031-03");
    expect((await getMonthlySummaryData(laterOnly, PERIOD))!.hasEarlierCycle).toBe(false);
  });

  it("cycleStartDate é a data local de criação do ciclo", async () => {
    const userId = await newUser();
    // 2031-06-16T01:30Z é 15/06 22:30 em São Paulo
    await newCycle(userId, PERIOD, new Date("2031-06-16T01:30:00Z"));
    const data = await getMonthlySummaryData(userId, PERIOD);
    expect(data!.cycleStartDate).toBe("2031-06-15");
  });
});

describe("markSummarySeenFor", () => {
  // 2031-07-02 12:00Z → julho em São Paulo; previousPeriod = 2031-06
  const NOW = new Date("2031-07-02T15:00:00Z");

  async function seen(userId: string) {
    return (await prisma.userSettings.findUniqueOrThrow({ where: { userId } })).lastSummarySeenPeriod;
  }

  it("grava quando o período é o mês anterior local", async () => {
    const userId = await newUser();
    expect(await markSummarySeenFor(userId, PERIOD, NOW)).toBe(true);
    expect(await seen(userId)).toBe(PERIOD);
  });

  it("ignora período antigo, atual e futuro", async () => {
    const userId = await newUser({ lastSummarySeenPeriod: "2031-05" });
    expect(await markSummarySeenFor(userId, "2031-04", NOW)).toBe(false);
    expect(await markSummarySeenFor(userId, "2031-07", NOW)).toBe(false);
    expect(await markSummarySeenFor(userId, "2031-08", NOW)).toBe(false);
    expect(await seen(userId)).toBe("2031-05");
  });

  it("usa o fuso do usuário: 01/07 02:00Z ainda é junho em São Paulo", async () => {
    const userId = await newUser();
    const lateNight = new Date("2031-07-01T02:00:00Z"); // 30/06 23:00 local → previous = 2031-05
    expect(await markSummarySeenFor(userId, PERIOD, lateNight)).toBe(false);
    expect(await markSummarySeenFor(userId, "2031-05", lateNight)).toBe(true);
  });

  it("não altera outro usuário", async () => {
    const a = await newUser();
    const b = await newUser();
    await markSummarySeenFor(a, PERIOD, NOW);
    expect(await seen(b)).toBeNull();
  });
});
