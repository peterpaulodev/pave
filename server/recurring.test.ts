import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { localDate } from "@/lib/domain/local-date";
import { getOrCreateCycle, upsertUserSettings } from "./queries";
import {
  applyRecurringToCycle,
  createRecurring,
  countRecurring,
  deleteRecurring,
  getRecurringTotalsByBucket,
  listRecurring,
  setRecurringActive,
  updateRecurring,
} from "./recurring";
import { getRegisteredDates, markNoSpend } from "./checkin";

// Integration tests for contas fixas (tasks.md 3.7). Every user is created
// with a unique id and removed (cascade) in afterAll.
const users: string[] = [];

async function newUser(): Promise<string> {
  const id = `test-${randomUUID()}`;
  users.push(id);
  await prisma.user.create({
    data: { id, email: `${id}@example.test`, name: "Test" },
  });
  await upsertUserSettings(id, { defaultIncomeCents: 500000 });
  return id;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: users } } });
});

describe("contas fixas no ciclo (integration)", () => {
  it("lança cada conta ativa uma única vez, com data e vínculo corretos", async () => {
    const userId = await newUser();
    const aluguel = await createRecurring(userId, {
      description: "Aluguel", amountCents: 150000, bucket: "needs", dayOfMonth: 10,
    });
    const luz = await createRecurring(userId, {
      description: "Luz", amountCents: 20000, bucket: "needs", dayOfMonth: 31,
    });

    const cycle = await getOrCreateCycle(userId, "2026-04");
    const again = await getOrCreateCycle(userId, "2026-04");
    expect(again.id).toBe(cycle.id);

    const expenses = await prisma.expense.findMany({
      where: { cycleId: cycle.id, userId },
      orderBy: { occurredOn: "asc" },
    });
    expect(expenses.map((e) => [e.recurringExpenseId, isoDate(e.occurredOn)])).toEqual([
      [aluguel.id, "2026-04-10"],
      [luz.id, "2026-04-30"], // dia 31 em abril cai no 30
    ]);
    expect(expenses[0]).toMatchObject({ amountCents: 150000, bucket: "needs" });

    // Rodar de novo explicitamente também não duplica nem relança.
    await applyRecurringToCycle(userId, cycle.id);
    expect(await prisma.expense.count({ where: { cycleId: cycle.id } })).toBe(2);
    const stamped = await prisma.budgetCycle.findUniqueOrThrow({ where: { id: cycle.id } });
    expect(stamped.recurringAppliedAt).not.toBeNull();
  });

  it("dois getOrCreateCycle concorrentes no mesmo período não duplicam lançamentos", async () => {
    const userId = await newUser();
    await createRecurring(userId, {
      description: "Internet", amountCents: 10000, bucket: "needs", dayOfMonth: 5,
    });
    await createRecurring(userId, {
      description: "Streaming", amountCents: 3000, bucket: "wants", dayOfMonth: 8,
    });

    const [a, b] = await Promise.all([
      getOrCreateCycle(userId, "2026-06"),
      getOrCreateCycle(userId, "2026-06"),
    ]);
    expect(a.id).toBe(b.id);
    expect(await prisma.budgetCycle.count({ where: { userId, period: "2026-06" } })).toBe(1);
    expect(await prisma.expense.count({ where: { cycleId: a.id } })).toBe(2);
  });

  it("excluir um lançamento automático não o recria", async () => {
    const userId = await newUser();
    const rec = await createRecurring(userId, {
      description: "Aluguel", amountCents: 100000, bucket: "needs", dayOfMonth: 10,
    });
    const cycle = await getOrCreateCycle(userId, "2026-07");
    await prisma.expense.deleteMany({ where: { cycleId: cycle.id, recurringExpenseId: rec.id } });

    await getOrCreateCycle(userId, "2026-07");
    await applyRecurringToCycle(userId, cycle.id);

    expect(await prisma.expense.count({ where: { cycleId: cycle.id } })).toBe(0);
    // ...mas a conta continua ativa para o próximo mês.
    const next = await getOrCreateCycle(userId, "2026-08");
    expect(await prisma.expense.count({ where: { cycleId: next.id } })).toBe(1);
  });

  it("conta pausada não lança; reativada volta nos próximos ciclos", async () => {
    const userId = await newUser();
    const rec = await createRecurring(userId, {
      description: "Academia", amountCents: 9000, bucket: "wants", dayOfMonth: 3,
    });
    expect(await setRecurringActive(userId, rec.id, false)).toBe(true);

    const paused = await getOrCreateCycle(userId, "2026-09");
    expect(await prisma.expense.count({ where: { cycleId: paused.id } })).toBe(0);

    await setRecurringActive(userId, rec.id, true);
    const active = await getOrCreateCycle(userId, "2026-10");
    expect(await prisma.expense.count({ where: { cycleId: active.id } })).toBe(1);
  });

  it("editar afeta só ciclos futuros; excluir mantém o histórico", async () => {
    const userId = await newUser();
    const rec = await createRecurring(userId, {
      description: "Aluguel", amountCents: 150000, bucket: "needs", dayOfMonth: 10,
    });
    const first = await getOrCreateCycle(userId, "2026-11");

    expect(await updateRecurring(userId, rec.id, { amountCents: 160000 })).toBe(true);
    const second = await getOrCreateCycle(userId, "2026-12");

    const [e1, e2] = await Promise.all([
      prisma.expense.findFirstOrThrow({ where: { cycleId: first.id } }),
      prisma.expense.findFirstOrThrow({ where: { cycleId: second.id } }),
    ]);
    expect([e1.amountCents, e2.amountCents]).toEqual([150000, 160000]);

    expect(await deleteRecurring(userId, rec.id)).toBe(true);
    const kept = await prisma.expense.findFirstOrThrow({ where: { id: e1.id } });
    expect(kept.recurringExpenseId).toBeNull(); // onDelete: SetNull
    const third = await getOrCreateCycle(userId, "2027-01");
    expect(await prisma.expense.count({ where: { cycleId: third.id } })).toBe(0);
  });

  it("createRecurring com alsoThisMonth cria o gasto no ciclo atual na mesma transação", async () => {
    const userId = await newUser();
    const cycle = await getOrCreateCycle(userId, "2027-02");

    const rec = await createRecurring(userId, {
      description: "Condomínio", amountCents: 40000, bucket: "needs", dayOfMonth: 30,
      alsoThisMonth: { cycleId: cycle.id },
    });
    const expense = await prisma.expense.findFirstOrThrow({ where: { cycleId: cycle.id } });
    expect(expense).toMatchObject({ recurringExpenseId: rec.id, amountCents: 40000 });
    expect(isoDate(expense.occurredOn)).toBe("2027-02-28");

    const without = await createRecurring(userId, {
      description: "Seguro", amountCents: 8000, bucket: "needs", dayOfMonth: 2,
    });
    expect(await prisma.expense.count({ where: { recurringExpenseId: without.id } })).toBe(0);
  });

  it("alsoThisMonth com ciclo de outro usuário falha e não cria nada", async () => {
    const a = await newUser();
    const b = await newUser();
    const cycleB = await getOrCreateCycle(b, "2027-03");

    await expect(
      createRecurring(a, {
        description: "X", amountCents: 100, bucket: "needs", dayOfMonth: 1,
        alsoThisMonth: { cycleId: cycleB.id },
      })
    ).rejects.toThrow();
    expect(await listRecurring(a)).toEqual([]);
    expect(await prisma.expense.count({ where: { cycleId: cycleB.id } })).toBe(0);
  });

  it("isolamento: um usuário não vê, edita, pausa nem exclui contas de outro", async () => {
    const a = await newUser();
    const b = await newUser();
    const rec = await createRecurring(a, {
      description: "Aluguel", amountCents: 100000, bucket: "needs", dayOfMonth: 10,
    });

    expect(await listRecurring(b)).toEqual([]);
    expect(await updateRecurring(b, rec.id, { amountCents: 1 })).toBe(false);
    expect(await setRecurringActive(b, rec.id, false)).toBe(false);
    expect(await deleteRecurring(b, rec.id)).toBe(false);

    const intact = await prisma.recurringExpense.findUniqueOrThrow({ where: { id: rec.id } });
    expect(intact).toMatchObject({ amountCents: 100000, active: true });

    // As contas de A não vazam para o ciclo de B.
    const cycleB = await getOrCreateCycle(b, "2027-04");
    expect(await prisma.expense.count({ where: { cycleId: cycleB.id } })).toBe(0);
  });
});

describe("dias registrados (integration)", () => {
  it("markNoSpend é idempotente", async () => {
    const userId = await newUser();
    await markNoSpend(userId, "2026-03-10");
    await markNoSpend(userId, "2026-03-10");
    expect(await prisma.dailyCheckin.count({ where: { userId } })).toBe(1);
  });

  it("getRegisteredDates converte para a data local, exclui fixas e une check-ins", async () => {
    const userId = await newUser();
    const tz = "America/Sao_Paulo";
    const cycle = await getOrCreateCycle(userId, "2027-05");

    // 02:30 UTC = 23:30 do dia anterior em São Paulo.
    const manualAt = new Date();
    manualAt.setUTCDate(manualAt.getUTCDate() - 5);
    manualAt.setUTCHours(2, 30, 0, 0);
    const expectedManual = localDate(tz, manualAt);
    expect(expectedManual).not.toBe(isoDate(manualAt));

    const rec = await prisma.recurringExpense.create({
      data: { userId, description: "Fixa", amountCents: 100, bucket: "needs", dayOfMonth: 1 },
    });
    const autoAt = new Date();
    autoAt.setUTCDate(autoAt.getUTCDate() - 3);
    autoAt.setUTCHours(15, 0, 0, 0);

    await prisma.expense.createMany({
      data: [
        { userId, cycleId: cycle.id, amountCents: 500, description: "manual", bucket: "wants",
          occurredOn: new Date("2027-05-01T00:00:00.000Z"), createdAt: manualAt },
        { userId, cycleId: cycle.id, amountCents: 100, description: "auto", bucket: "needs",
          occurredOn: new Date("2027-05-01T00:00:00.000Z"), createdAt: autoAt,
          recurringExpenseId: rec.id },
      ],
    });
    const checkinDay = new Date();
    checkinDay.setUTCDate(checkinDay.getUTCDate() - 1);
    await markNoSpend(userId, isoDate(checkinDay));

    const dates = await getRegisteredDates(userId, tz);
    expect(dates).toEqual([expectedManual, isoDate(checkinDay)].sort());
    expect(dates).not.toContain(localDate(tz, autoAt));
  });

  it("getRegisteredDates respeita a janela de dias e o isolamento", async () => {
    const a = await newUser();
    const b = await newUser();
    await markNoSpend(a, "2020-01-01"); // fora da janela
    await markNoSpend(b, isoDate(new Date()));

    expect(await getRegisteredDates(a, "UTC")).toEqual([]);
    expect(await getRegisteredDates(b, "UTC", 60)).toHaveLength(1);
    expect(await getRegisteredDates(a, "UTC", 60)).toEqual([]);
  });
});

describe("totais de contas fixas por balde (integration)", () => {
  it("soma só gastos de conta fixa, inclusive agendados, e isola usuários", async () => {
    const userId = await newUser();
    const other = await newUser();
    await createRecurring(userId, { description: "Aluguel", amountCents: 150000, bucket: "needs", dayOfMonth: 10 });
    await createRecurring(userId, { description: "Luz", amountCents: 20000, bucket: "needs", dayOfMonth: 28 });
    await createRecurring(userId, { description: "Netflix", amountCents: 5000, bucket: "wants", dayOfMonth: 1 });
    const cycle = await getOrCreateCycle(userId, "2027-09");
    await prisma.expense.create({
      data: { userId, cycleId: cycle.id, amountCents: 7000, description: "mercado", bucket: "needs",
        occurredOn: new Date("2027-09-02T00:00:00.000Z") },
    });

    expect(await getRecurringTotalsByBucket(userId, cycle.id)).toEqual({ needs: 170000, wants: 5000, savings: 0 });
    expect(await getRecurringTotalsByBucket(other, cycle.id)).toEqual({ needs: 0, wants: 0, savings: 0 });
    expect(await countRecurring(userId)).toBe(3);
    expect(await countRecurring(other)).toBe(0);
  });
});
