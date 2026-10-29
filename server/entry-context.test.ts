import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { localDate } from "@/lib/domain/local-date";
import { currentPeriod } from "@/lib/domain/period";
import { STARTER_CHIPS } from "@/lib/domain/entry-chips";
import { getOrCreateCycle, upsertUserSettings } from "./queries";
import { getEntryContext, getFrequentDescriptions } from "./entry-context";

// Hits the real Neon database — run via `pnpm test:integration`.
const TODAY = "2031-06-15";
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
function daysBefore(iso: string, n: number): string {
  const d = day(iso);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

const users: string[] = [];
type BucketName = "needs" | "wants" | "savings";

async function newUser(opts: { timezone?: string; income?: number } = {}) {
  const userId = `test-${randomUUID()}`;
  users.push(userId);
  await prisma.user.create({ data: { id: userId, email: `${userId}@example.test`, name: "T" } });
  await upsertUserSettings(userId, {
    defaultIncomeCents: opts.income ?? 500000,
    ...(opts.timezone ? { timezone: opts.timezone } : {}),
  });
  return userId;
}

async function seed(userId: string, period = "2031-06") {
  const cycle = await prisma.budgetCycle.upsert({
    where: { userId_period: { userId, period } },
    update: {},
    create: {
      userId, period, incomeCents: 500000,
      needsLimitCents: 250000, wantsLimitCents: 150000, savingsLimitCents: 100000,
    },
  });
  let createdAt = Date.now() - 1_000_000;
  return {
    cycle,
    add: (
      description: string,
      occurredOn: string,
      bucket: BucketName = "needs",
      opts: { recurringExpenseId?: string; amountCents?: number } = {}
    ) =>
      prisma.expense.create({
        data: {
          userId, cycleId: cycle.id, description, bucket,
          amountCents: opts.amountCents ?? 1000, occurredOn: day(occurredOn),
          recurringExpenseId: opts.recurringExpenseId ?? null,
          createdAt: new Date((createdAt += 1000)),
        },
      }),
  };
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: users } } });
});

describe("getFrequentDescriptions", () => {
  it("agrupa descrições equivalentes e ordena por quantidade (Mercado 8, iFood 5, Uber 3)", async () => {
    const userId = await newUser();
    const { add } = await seed(userId);
    for (let i = 0; i < 3; i++) await add("Uber", daysBefore(TODAY, i), "needs");
    for (let i = 0; i < 8; i++) await add(i % 2 ? "mercado" : "Mercado", daysBefore(TODAY, i), "needs");
    await add("ifood 30", daysBefore(TODAY, 1), "wants");
    await add("IFOOD", daysBefore(TODAY, 2), "wants");
    await add("iFood", daysBefore(TODAY, 3), "wants");
    await add("iFood", daysBefore(TODAY, 4), "wants");
    await add("iFood 45,90", daysBefore(TODAY, 5), "wants");

    const chips = await getFrequentDescriptions(userId, 6, TODAY);
    expect(chips).toEqual([
      { label: "Mercado", bucket: "needs" },
      { label: "iFood", bucket: "wants" },
      { label: "Uber", bucket: "needs" },
    ]);
  });

  it("o balde é o do gasto mais recente, não o mais frequente", async () => {
    const userId = await newUser();
    const { add } = await seed(userId);
    for (let i = 10; i < 15; i++) await add("iFood", daysBefore(TODAY, i), "needs");
    await add("ifood", daysBefore(TODAY, 1), "wants");
    expect(await getFrequentDescriptions(userId, 6, TODAY)).toEqual([
      { label: "iFood", bucket: "wants" },
    ]);
  });

  it("empate de quantidade: o mais recente primeiro", async () => {
    const userId = await newUser();
    const { add } = await seed(userId);
    await add("Antigo", daysBefore(TODAY, 20));
    await add("Novo", daysBefore(TODAY, 2));
    expect((await getFrequentDescriptions(userId, 6, TODAY)).map((c) => c.label)).toEqual(["Novo", "Antigo"]);
  });

  it("ignora contas fixas (gastos automáticos)", async () => {
    const userId = await newUser();
    const { add } = await seed(userId);
    const template = await prisma.recurringExpense.create({
      data: { userId, description: "Netflix", amountCents: 3990, bucket: "wants", dayOfMonth: 10 },
    });
    await add("Netflix", daysBefore(TODAY, 1), "wants", { recurringExpenseId: template.id });
    await add("Padaria", daysBefore(TODAY, 1));
    expect((await getFrequentDescriptions(userId, 6, TODAY)).map((c) => c.label)).toEqual(["Padaria"]);
  });

  it("não vaza descrições de outro usuário", async () => {
    const mine = await newUser();
    const other = await newUser();
    await (await seed(other)).add("Segredo", daysBefore(TODAY, 1));
    await (await seed(mine)).add("Meu", daysBefore(TODAY, 1));
    expect((await getFrequentDescriptions(mine, 6, TODAY)).map((c) => c.label)).toEqual(["Meu"]);
  });

  it("janela de 90 dias: o dia -89 entra, o -90 não", async () => {
    const userId = await newUser();
    const { add } = await seed(userId, "2031-03");
    await add("Dentro", daysBefore(TODAY, 89));
    await add("Fora", daysBefore(TODAY, 90));
    expect((await getFrequentDescriptions(userId, 6, TODAY)).map((c) => c.label)).toEqual(["Dentro"]);
  });

  it("limite", async () => {
    const userId = await newUser();
    const { add } = await seed(userId);
    for (const d of ["A", "B", "C", "D"]) await add(d, daysBefore(TODAY, 1));
    expect(await getFrequentDescriptions(userId, 2, TODAY)).toHaveLength(2);
  });

  it("sem histórico: lista vazia", async () => {
    expect(await getFrequentDescriptions(await newUser(), 6, TODAY)).toEqual([]);
  });

  it("sem informar a data usa o hoje do fuso do usuário", async () => {
    const tz = "Pacific/Kiritimati"; // UTC+14: o hoje local costuma diferir do UTC
    const userId = await newUser({ timezone: tz });
    const today = localDate(tz);
    const { add } = await seed(userId, currentPeriod(tz));
    await add("Hoje", today);
    expect((await getFrequentDescriptions(userId)).map((c) => c.label)).toEqual(["Hoje"]);
  });
});

describe("getEntryContext", () => {
  it("usuário novo: chips iniciais, nada gasto e valor diário de lazer", async () => {
    const userId = await newUser({ income: 500000 }); // lazer R$ 1.500,00
    const ctx = await getEntryContext(userId);
    const today = localDate("America/Sao_Paulo");

    expect(ctx.today).toBe(today);
    expect(ctx.chips.map((c) => [c.label, c.source])).toEqual(
      STARTER_CHIPS.map((c) => [c.label, "starter"])
    );
    expect(ctx.availableCents).toEqual({ needs: 250000, wants: 150000 });
    expect(ctx.savedCents).toBe(0);
    expect(ctx.dateRange).toEqual({ min: `${today.slice(0, 8)}01`, max: today });
    expect(ctx.remainingTodayCents).toBeGreaterThan(0);
  });

  it("reflete gastos do ciclo: disponível por balde, guardado e resta de hoje", async () => {
    const userId = await newUser({ income: 500000 });
    const today = localDate("America/Sao_Paulo");
    const { add } = await seed(userId, currentPeriod("America/Sao_Paulo"));
    const before = (await getEntryContext(userId)).remainingTodayCents;

    await add("mercado", today, "needs", { amountCents: 12000 });
    await add("cinema", today, "wants", { amountCents: 2500 });
    await add("tesouro", today, "savings", { amountCents: 30000 });

    const ctx = await getEntryContext(userId);
    expect(ctx.availableCents).toEqual({ needs: 250000 - 12000, wants: 150000 - 2500 });
    expect(ctx.savedCents).toBe(30000);
    expect(ctx.remainingTodayCents).toBe(before - 2500);
    // os gastos viram chips do histórico, antes dos iniciais
    expect(ctx.chips.slice(0, 3).map((c) => c.source)).toEqual(["history", "history", "history"]);
  });

  it("cria o ciclo do mês se ainda não existe (como o painel)", async () => {
    const userId = await newUser();
    await getEntryContext(userId);
    const cycle = await getOrCreateCycle(userId, currentPeriod("America/Sao_Paulo"));
    expect(cycle.userId).toBe(userId);
  });
});
