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

  it("retenção na semana 2: coorte de 14–44 dias, atividade entre os dias 7 e 13", async () => {
    const mk = async (onboardedDaysAgo: number) => {
      const id = await newUser(ago(onboardedDaysAgo + 1));
      const at = ago(onboardedDaysAgo);
      await addEvent(id, "onboarding_completed", at);
      return { id, at };
    };
    const after = (at: Date, ms: number) => new Date(at.getTime() + ms);

    const r1 = await mk(20); // gasto manual no dia 9 → retido
    await addEvent(r1.id, "expense_created", after(r1.at, 9 * DAY), manual("quick_entry", "needs"));
    const r2 = await mk(30); // só gasto automático e lembrete no dia 8 → não retido
    await addEvent(r2.id, "expense_created", after(r2.at, 8 * DAY), recurring);
    await addEvent(r2.id, "reminder_sent", after(r2.at, 8 * DAY));
    const r3 = await mk(25); // dia sem gasto no dia 13 → retido
    await addEvent(r3.id, "no_spend_checkin", after(r3.at, 13 * DAY + 12 * HOUR), { via: "app" });
    const r4 = await mk(25); // dia 6 e exatamente 14 dias → fora do intervalo
    await addEvent(r4.id, "expense_created", after(r4.at, 7 * DAY - HOUR), manual("quick_entry", "needs"));
    await addEvent(r4.id, "expense_created", after(r4.at, 14 * DAY), manual("quick_entry", "needs"));
    const r5 = await mk(40); // exatamente 7 dias → retido (limite inclusivo)
    await addEvent(r5.id, "expense_created", after(r5.at, 7 * DAY), manual("notification", "needs"));
    const tooNew = await mk(10); // onboarding há 10 dias: fora da coorte
    await addEvent(tooNew.id, "expense_created", after(tooNew.at, 8 * DAY - 6 * DAY), manual("quick_entry", "needs"));
    const tooOld = await mk(50); // há 50 dias: fora da coorte
    await addEvent(tooOld.id, "expense_created", after(tooOld.at, 9 * DAY), manual("quick_entry", "needs"));

    const ids = [r1, r2, r3, r4, r5, tooNew, tooOld].map((u) => u.id);
    // independe da janela escolhida
    for (const windowDays of [7, 90]) {
      const m = await getMetrics({ windowDays, onlyUserIds: ids, now: NOW });
      expect(m.weekTwoRetention).toEqual({ num: 3, den: 5 });
    }
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

  it("ativos em 7 dias e usuários com lembrete ativo", async () => {
    const [active, inactive, withReminder, withoutReminder] = await Promise.all([
      newUser(), newUser(), newUser(), newUser(),
    ]);
    await addEvent(active, "no_spend_checkin", ago(3), { via: "app" });
    await addEvent(inactive, "expense_created", ago(10), manual("quick_entry", "needs"));
    await addEvent(inactive, "reminder_sent", ago(1)); // lembrete recebido não é atividade
    await prisma.userSettings.create({ data: { userId: withReminder, reminderEnabled: true } });
    await prisma.userSettings.create({ data: { userId: withoutReminder, reminderEnabled: false } });

    const m = await getMetrics({
      windowDays: 30, onlyUserIds: [active, inactive, withReminder, withoutReminder], now: NOW,
    });
    expect(m.activeUsers7d).toBe(1);
    expect(m.usersWithReminder).toBe(1);
  });

  it("exclui os admins, a não ser que a opção os inclua", async () => {
    const [admin, user] = await Promise.all([newUser(ago(2)), newUser(ago(2))]);
    for (const id of [admin, user]) {
      await addEvent(id, "onboarding_completed", ago(2));
      await addEvent(id, "expense_created", ago(1), manual("quick_entry", "needs"));
      await addEvent(id, "reminder_sent", ago(1));
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
