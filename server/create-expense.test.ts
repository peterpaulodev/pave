import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";

// Only the session is replaced: the action runs for real against the dev database.
const session = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/auth/session", () => ({
  getSessionUser: async () => ({ id: session.id, email: "", name: "" }),
  getSessionUserOrRedirect: async () => ({ id: session.id, email: "", name: "" }),
}));

import { prisma } from "@/lib/db";
import { createExpense } from "@/actions/expenses";
import { localDate } from "@/lib/domain/local-date";
import { upsertUserSettings } from "./queries";
import { clearAfter, flushAfter } from "./testing/after-queue";

// Hits the real Neon database — run via `pnpm test:integration`.
const users: string[] = [];

async function newUser(timezone = "America/Sao_Paulo") {
  const id = `test-${randomUUID()}`;
  users.push(id);
  await prisma.user.create({ data: { id, email: `${id}@example.test`, name: "T" } });
  await upsertUserSettings(id, { defaultIncomeCents: 500000, timezone });
  session.id = id;
  return id;
}

const shift = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const firstOfMonth = (iso: string) => `${iso.slice(0, 8)}01`;
const base = { amountCents: 1200, description: "Mercado", bucket: "needs" as const };

async function savedExpenses(userId: string) {
  return prisma.expense.findMany({ where: { userId } });
}
async function expenseEvents(userId: string) {
  await flushAfter();
  const rows = await prisma.event.findMany({ where: { userId, name: "expense_created" } });
  return rows.map((r) => r.props as Record<string, unknown>);
}

beforeEach(() => clearAfter());
afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: users } } });
});

describe("createExpense · data do gasto", () => {
  it("sem occurredOn grava hoje na data local do usuário", async () => {
    const userId = await newUser();
    expect((await createExpense(base)).error).toBeUndefined();
    const [expense] = await savedExpenses(userId);
    expect(expense.occurredOn.toISOString().slice(0, 10)).toBe(localDate("America/Sao_Paulo"));
  });

  it("aceita hoje e o dia 1 do mês, gravando a data escolhida", async () => {
    const userId = await newUser();
    const today = localDate("America/Sao_Paulo");
    expect((await createExpense({ ...base, occurredOn: today })).error).toBeUndefined();
    expect((await createExpense({ ...base, occurredOn: firstOfMonth(today) })).error).toBeUndefined();
    const dates = (await savedExpenses(userId)).map((e) => e.occurredOn.toISOString().slice(0, 10)).sort();
    expect(dates).toEqual([firstOfMonth(today), today].sort());
  });

  it("rejeita data futura e não grava nada", async () => {
    const userId = await newUser();
    const tomorrow = shift(localDate("America/Sao_Paulo"), 1);
    const result = await createExpense({ ...base, occurredOn: tomorrow });
    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(await savedExpenses(userId)).toHaveLength(0);
  });

  it("rejeita data de mês anterior", async () => {
    const userId = await newUser();
    const lastMonth = shift(firstOfMonth(localDate("America/Sao_Paulo")), -1);
    expect((await createExpense({ ...base, occurredOn: lastMonth })).error).toBeDefined();
    expect(await savedExpenses(userId)).toHaveLength(0);
  });

  it.each(["", "2026-02-30", "ontem", "2026-10-1", "2026-10-21T00:00:00Z"])(
    "rejeita data malformada %j",
    async (occurredOn) => {
      const userId = await newUser();
      expect((await createExpense({ ...base, occurredOn })).error).toBeDefined();
      expect(await savedExpenses(userId)).toHaveLength(0);
    }
  );

  it("valida pela data LOCAL do usuário, não pela do servidor (UTC)", async () => {
    // Kiritimati (UTC+14) e Pago Pago (UTC-11) nunca estão no mesmo dia.
    const ahead = "Pacific/Kiritimati";
    const behind = "Pacific/Pago_Pago";
    const aheadToday = localDate(ahead);
    expect(aheadToday > localDate(behind)).toBe(true);

    const userAhead = await newUser(ahead);
    expect((await createExpense({ ...base, occurredOn: aheadToday })).error).toBeUndefined();
    expect(await savedExpenses(userAhead)).toHaveLength(1);

    // O "hoje" de quem está à frente é futuro para quem está atrás.
    const userBehind = await newUser(behind);
    expect((await createExpense({ ...base, occurredOn: aheadToday })).error).toBeDefined();
    expect(await savedExpenses(userBehind)).toHaveLength(0);
  });
});

describe("createExpense · valor e descrição", () => {
  it.each([0, -100, 12.5])("valor inválido %s é bloqueado", async (amountCents) => {
    const userId = await newUser();
    expect((await createExpense({ ...base, amountCents })).error).toBeDefined();
    expect(await savedExpenses(userId)).toHaveLength(0);
  });
});

describe("createExpense · métricas da tela de lançamento", () => {
  it("chip do histórico: usedChip, chipSource e durationMs arredondado a 100ms", async () => {
    const userId = await newUser();
    await createExpense({ ...base, usedChip: true, chipSource: "history", durationMs: 4230 });
    expect(await expenseEvents(userId)).toMatchObject([
      { usedChip: true, chipSource: "history", durationMs: 4200 },
    ]);
  });

  it("texto livre: usedChip falso e chipSource nulo, mesmo que o cliente mande chipSource", async () => {
    const userId = await newUser();
    await createExpense({ ...base, usedChip: false, chipSource: "starter" });
    await createExpense({ ...base });
    const events = await expenseEvents(userId);
    expect(events).toHaveLength(2);
    for (const props of events) expect(props).toMatchObject({ usedChip: false, chipSource: null });
  });

  it("limita durationMs a 600000 e aceita 0", async () => {
    const userId = await newUser();
    await createExpense({ ...base, durationMs: 600000 });
    await createExpense({ ...base, durationMs: 0 });
    const durations = (await expenseEvents(userId)).map((p) => p.durationMs).sort();
    expect(durations).toEqual([0, 600000]);
  });

  it.each([
    ["negativo", -1],
    ["não inteiro", 1234.5],
    ["acima do limite", 600001],
    ["texto", "rápido"],
    ["NaN", Number.NaN],
    ["nulo", null],
  ])("durationMs %s: o gasto é salvo e o evento sai sem durationMs", async (_name, durationMs) => {
    const userId = await newUser();
    const result = await createExpense({ ...base, durationMs } as never);
    expect(result.error).toBeUndefined();
    expect(await savedExpenses(userId)).toHaveLength(1);
    const [props] = await expenseEvents(userId);
    expect(props).not.toHaveProperty("durationMs");
    expect(props).toMatchObject({ source: "quick_entry", bucket: "needs" });
  });

  it("chipSource inválido também não impede o gasto", async () => {
    const userId = await newUser();
    const result = await createExpense({ ...base, usedChip: true, chipSource: "outro" } as never);
    expect(result.error).toBeUndefined();
    expect(await savedExpenses(userId)).toHaveLength(1);
    expect(await expenseEvents(userId)).toMatchObject([{ usedChip: true, chipSource: null }]);
  });

  it("o evento não carrega descrição, valor nem data", async () => {
    const userId = await newUser();
    await createExpense({ ...base, amountCents: 8990, description: "Farmácia da Maria", durationMs: 3000 });
    const serialized = JSON.stringify(await expenseEvents(userId));
    expect(serialized).not.toContain("Farm");
    expect(serialized).not.toContain("8990");
    expect(serialized).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
