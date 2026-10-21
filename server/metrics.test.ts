import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { getMetrics } from "./metrics";

// Hits the real Neon database — run via `pnpm test:integration`. Every
// metric is scoped with `onlyUserIds` to the users a test creates, so rows
// already in the dev database never leak into the numbers.
const NOW = new Date("2031-06-30T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);

const allUsers: string[] = [];

async function newUser(createdAt: Date = ago(1)) {
  const id = `test-${randomUUID()}`;
  allUsers.push(id);
  await prisma.user.create({
    data: { id, email: `${id}@example.test`, name: "T", createdAt },
  });
  return id;
}

type Props = Record<string, unknown>;
const addEvent = (userId: string, name: string, createdAt: Date, props: Props = {}) =>
  prisma.event.create({ data: { userId, name, props: props as object, createdAt } });

const manual = (source: string, suggestedBucket: string | null, overridden = false) => ({
  source,
  bucket: "needs",
  suggestedBucket,
  overridden,
});
const recurring = { source: "recurring", bucket: "needs", suggestedBucket: null, overridden: false };

// Source-table helpers: retention and "active users" read expenses and
// daily_checkins directly, so these tests insert rows there — no events.
const cycles = new Map<string, string>();
async function cycleOf(userId: string) {
  let id = cycles.get(userId);
  if (!id) {
    const cycle = await prisma.budgetCycle.create({
      data: {
        userId, period: "2031-06", incomeCents: 100,
        needsLimitCents: 50, wantsLimitCents: 30, savingsLimitCents: 20,
      },
    });
    id = cycle.id;
    cycles.set(userId, id);
  }
  return id;
}

async function addExpense(userId: string, createdAt: Date, opts: { recurring?: boolean } = {}) {
  const recurringExpenseId = opts.recurring
    ? (
        await prisma.recurringExpense.create({
          data: { userId, description: "x", amountCents: 1, bucket: "needs", dayOfMonth: 1 },
        })
      ).id
    : null;
  await prisma.expense.create({
    data: {
      userId, cycleId: await cycleOf(userId), amountCents: 100, description: "x",
      bucket: "needs", occurredOn: new Date("2031-06-01T00:00:00.000Z"),
      createdAt, recurringExpenseId,
    },
  });
}

const addCheckin = (userId: string, date: string) =>
  prisma.dailyCheckin.create({ data: { userId, date: new Date(`${date}T00:00:00.000Z`) } });

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: allUsers } } });
});

describe("getMetrics", () => {
  it("conclusão do onboarding: criados na janela que concluíram", async () => {
    const [a, b, c, d, old] = await Promise.all([
      newUser(ago(2)), newUser(ago(5)), newUser(ago(10)), newUser(ago(20)), newUser(ago(60)),
    ]);
    await addEvent(a, "onboarding_completed", ago(2));
    await addEvent(b, "onboarding_completed", ago(5));
    await addEvent(old, "onboarding_completed", ago(59)); // criado fora da janela
    const ids = [a, b, c, d, old];

    expect((await getMetrics({ windowDays: 30, onlyUserIds: ids, now: NOW })).onboarding).toEqual({ num: 2, den: 4 });
    // janela de 7 dias: só a (2d) e b (5d) foram criados nela
    expect((await getMetrics({ windowDays: 7, onlyUserIds: ids, now: NOW })).onboarding).toEqual({ num: 2, den: 2 });
  });

  it("retenção na semana 2: coorte de 14–44 dias, atividade nos dias locais 7–13, lida das tabelas", async () => {
    const SP = "America/Sao_Paulo";
    const mk = async (onboardedDaysAgo: number, timezone = "UTC") => {
      const id = await newUser(ago(onboardedDaysAgo + 1));
      const at = ago(onboardedDaysAgo); // 12:00Z
      await prisma.userSettings.create({
        data: { userId: id, timezone, onboardedAt: at },
      });
      return { id, at };
    };
    const after = (at: Date, ms: number) => new Date(at.getTime() + ms);

    const r1 = await mk(20); // gasto manual no dia 9, sem nenhum evento → retido
    await addExpense(r1.id, after(r1.at, 9 * DAY));
    const r2 = await mk(30); // só gasto de conta fixa (e lembrete) no dia 8 → não retido
    await addExpense(r2.id, after(r2.at, 8 * DAY), { recurring: true });
    await addEvent(r2.id, "reminder_sent", after(r2.at, 8 * DAY));
    const r3 = await mk(25); // dia sem gasto no dia 13 → retido
    await addCheckin(r3.id, isoDate(after(r3.at, 13 * DAY)));
    const r4 = await mk(25); // dia 6 e dia 14 → fora do intervalo
    await addExpense(r4.id, after(r4.at, 6 * DAY));
    await addExpense(r4.id, after(r4.at, 14 * DAY));
    await addCheckin(r4.id, isoDate(after(r4.at, 6 * DAY)));
    await addCheckin(r4.id, isoDate(after(r4.at, 14 * DAY)));
    const r5 = await mk(40); // dia 7 exato → retido (limite inclusivo)
    await addExpense(r5.id, after(r5.at, 7 * DAY));
    // Em São Paulo (UTC-3), 02:00Z ainda é o dia local anterior:
    const r6 = await mk(30, SP); // 02:00Z do dia 7 UTC = dia local 6 → não retido
    await addExpense(r6.id, after(r6.at, 6 * DAY + 14 * HOUR));
    const r7 = await mk(30, SP); // 02:00Z do dia 14 UTC = dia local 13 → retido
    await addExpense(r7.id, after(r7.at, 13 * DAY + 14 * HOUR));
    const tooNew = await mk(10); // onboarding há 10 dias: fora da coorte
    await addExpense(tooNew.id, after(tooNew.at, 8 * DAY - 6 * DAY));
    const tooOld = await mk(50); // há 50 dias: fora da coorte
    await addExpense(tooOld.id, after(tooOld.at, 9 * DAY));

    const ids = [r1, r2, r3, r4, r5, r6, r7, tooNew, tooOld].map((u) => u.id);
    // independe da janela escolhida
    for (const windowDays of [7, 90]) {
      const m = await getMetrics({ windowDays, onlyUserIds: ids, now: NOW });
      expect(m.weekTwoRetention).toEqual({ num: 4, den: 7 });
    }

    // Isolados: no total, os dois casos de fuso se cancelariam sob um erro de fuso.
    const only = (u: { id: string }) =>
      getMetrics({ windowDays: 30, onlyUserIds: [u.id], now: NOW }).then((m) => m.weekTwoRetention);
    expect(await only(r6)).toEqual({ num: 0, den: 1 });
    expect(await only(r7)).toEqual({ num: 1, den: 1 });
  });

  it("lançamentos via notificação, por lembrete enviado", async () => {
    const u = await newUser();
    for (let i = 0; i < 3; i += 1) await addEvent(u, "expense_created", ago(i + 1), manual("quick_entry", "needs"));
    await addEvent(u, "expense_created", ago(1), manual("notification", "needs"));
    await addEvent(u, "expense_created", ago(1), recurring); // fora da razão
    await addEvent(u, "expense_created", ago(40), manual("notification", "needs")); // fora da janela
    await addEvent(u, "reminder_sent", ago(1));
    await addEvent(u, "reminder_sent", ago(2));
    await addEvent(u, "reminder_sent", ago(40)); // fora da janela

    const m = await getMetrics({ windowDays: 30, onlyUserIds: [u], now: NOW });
    expect(m.notificationExpenses).toEqual({ num: 1, den: 4 });
    expect(m.remindersSent).toBe(2);
    expect(m.notificationPerReminder).toEqual({ num: 1, den: 2 });
  });

  it("acerto da sugestão de balde e gastos sem sugestão", async () => {
    const u = await newUser();
    for (let i = 0; i < 3; i += 1) await addEvent(u, "expense_created", ago(1), manual("quick_entry", "needs"));
    await addEvent(u, "expense_created", ago(1), manual("notification", "needs", true)); // trocou
    await addEvent(u, "expense_created", ago(1), manual("quick_entry", null)); // sem sugestão
    await addEvent(u, "expense_created", ago(1), recurring); // ignorado

    const m = await getMetrics({ windowDays: 30, onlyUserIds: [u], now: NOW });
    expect(m.bucketHit).toEqual({ num: 3, den: 4 });
    expect(m.noSuggestion).toEqual({ num: 1, den: 5 });
  });

  it("ativos em 7 dias (das tabelas) e usuários com lembrete ativo", async () => {
    const [manualUser, checkinUser, oldUser, recurringUser, reminderOnly, withoutReminder] =
      await Promise.all([newUser(), newUser(), newUser(), newUser(), newUser(), newUser()]);
    await addExpense(manualUser, ago(3)); // sem evento algum
    await addCheckin(checkinUser, isoDate(ago(2)));
    await addExpense(oldUser, ago(10)); // fora dos últimos 7 dias
    await addExpense(recurringUser, ago(1), { recurring: true }); // conta fixa não conta
    await addEvent(reminderOnly, "reminder_sent", ago(1)); // lembrete recebido não conta
    await prisma.userSettings.create({ data: { userId: reminderOnly, reminderEnabled: true } });
    await prisma.userSettings.create({ data: { userId: withoutReminder, reminderEnabled: false } });

    const m = await getMetrics({
      windowDays: 30,
      onlyUserIds: [manualUser, checkinUser, oldUser, recurringUser, reminderOnly, withoutReminder],
      now: NOW,
    });
    expect(m.activeUsers7d).toBe(2);
    expect(m.usersWithReminder).toBe(1);
  });

  it("exclui os admins, a não ser que a opção os inclua", async () => {
    const [admin, user] = await Promise.all([newUser(ago(2)), newUser(ago(2))]);
    for (const id of [admin, user]) {
      await addEvent(id, "onboarding_completed", ago(2));
      await addEvent(id, "expense_created", ago(1), manual("quick_entry", "needs"));
      await addEvent(id, "reminder_sent", ago(1));
      await addExpense(id, ago(1));
      await prisma.userSettings.create({ data: { userId: id, reminderEnabled: true } });
    }
    const base = { windowDays: 30, onlyUserIds: [admin, user], now: NOW };

    const excluded = await getMetrics({ ...base, excludeUserIds: [admin] });
    expect(excluded.onboarding).toEqual({ num: 1, den: 1 });
    expect(excluded.bucketHit).toEqual({ num: 1, den: 1 });
    expect(excluded.remindersSent).toBe(1);
    expect(excluded.activeUsers7d).toBe(1);
    expect(excluded.usersWithReminder).toBe(1);

    const included = await getMetrics({ ...base, excludeUserIds: [] });
    expect(included.onboarding).toEqual({ num: 2, den: 2 });
    expect(included.bucketHit).toEqual({ num: 2, den: 2 });
    expect(included.remindersSent).toBe(2);
    expect(included.activeUsers7d).toBe(2);
    expect(included.usersWithReminder).toBe(2);
  });

  it("sem dados: denominadores zero (a tela mostra —)", async () => {
    const u = await newUser(ago(100));
    const m = await getMetrics({ windowDays: 7, onlyUserIds: [u], now: NOW });
    expect(m).toEqual({
      windowDays: 7,
      onboarding: { num: 0, den: 0 },
      weekTwoRetention: { num: 0, den: 0 },
      notificationExpenses: { num: 0, den: 0 },
      remindersSent: 0,
      notificationPerReminder: { num: 0, den: 0 },
      bucketHit: { num: 0, den: 0 },
      noSuggestion: { num: 0, den: 0 },
      activeUsers7d: 0,
      usersWithReminder: 0,
    });
  });
});
