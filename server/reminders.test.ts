import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";

const { sendNotification, setVapidDetails } = vi.hoisted(() => ({
  sendNotification: vi.fn(),
  setVapidDetails: vi.fn(),
}));
// No real call to a push service: web-push is mocked end to end.
vi.mock("web-push", () => ({ default: { sendNotification, setVapidDetails } }));

import { prisma } from "@/lib/db";
import { getOrCreateCycle, upsertUserSettings } from "./queries";
import { markNoSpend } from "./checkin";
import { runReminderCron } from "./reminders";

process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "test-public-key";
process.env.VAPID_PRIVATE_KEY = "test-private-key";
process.env.VAPID_SUBJECT = "mailto:test@example.test";

// 23:00 UTC = 20:00 in São Paulo (UTC-3, no DST in 2027) = 08:00 next day
// in Tokyo. Local date in São Paulo: 2027-03-10.
const NOW = new Date("2027-03-10T23:00:00.000Z");
const SP = "America/Sao_Paulo";

const users: string[] = [];

interface Fixture {
  timezone?: string;
  reminderEnabled?: boolean;
  reminderHour?: number;
  devices?: number;
  showAmount?: boolean;
}

async function newUser(fixture: Fixture = {}) {
  const id = `test-${randomUUID()}`;
  users.push(id);
  await prisma.user.create({ data: { id, email: `${id}@example.test`, name: "T" } });
  await upsertUserSettings(id, {
    defaultIncomeCents: 500000,
    timezone: fixture.timezone ?? SP,
    reminderEnabled: fixture.reminderEnabled ?? true,
    reminderHour: fixture.reminderHour ?? 20,
    reminderShowAmount: fixture.showAmount ?? false,
  });
  const endpoints: string[] = [];
  for (let i = 0; i < (fixture.devices ?? 1); i += 1) {
    const endpoint = `https://push.example.test/${id}/${i}`;
    endpoints.push(endpoint);
    await prisma.pushSubscription.create({
      data: { userId: id, endpoint, p256dh: "p256dh", auth: "auth" },
    });
  }
  return { id, endpoints };
}

async function addExpense(userId: string, createdAt: Date, automatic = false) {
  const cycle = await getOrCreateCycle(userId, "2027-03");
  const recurring = automatic
    ? await prisma.recurringExpense.create({
        data: { userId, description: "Aluguel", amountCents: 100, bucket: "needs", dayOfMonth: 10 },
      })
    : null;
  await prisma.expense.create({
    data: {
      userId, cycleId: cycle.id, amountCents: 500, description: "x", bucket: "wants",
      occurredOn: new Date("2027-03-10T00:00:00.000Z"), createdAt,
      recurringExpenseId: recurring?.id ?? null,
    },
  });
}

const notifiedEndpoints = () =>
  sendNotification.mock.calls.map((call) => (call[0] as { endpoint: string }).endpoint);

beforeEach(() => {
  sendNotification.mockReset();
  sendNotification.mockResolvedValue({ statusCode: 201 });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: users } } });
});

describe("cron de lembretes (integration)", () => {
  it("envia só para quem deve", async () => {
    const due = await newUser();
    const alreadySpent = await newUser();
    await addExpense(alreadySpent.id, new Date("2027-03-10T15:00:00.000Z"));
    const checkedIn = await newUser();
    await markNoSpend(checkedIn.id, "2027-03-10");
    const disabled = await newUser({ reminderEnabled: false });
    const noDevice = await newUser({ devices: 0 });
    const wrongHour = await newUser({ reminderHour: 21 });
    const otherZone = await newUser({ timezone: "Asia/Tokyo" }); // 08:00 there

    const all = [due, alreadySpent, checkedIn, disabled, noDevice, wrongHour, otherZone];
    const result = await runReminderCron(NOW, { onlyUserIds: all.map((u) => u.id) });

    // checked = enabled + at least one device: due, alreadySpent, checkedIn, wrongHour, otherZone
    expect(result).toEqual({ checked: 5, sent: 1, removedSubscriptions: 0 });
    expect(notifiedEndpoints()).toEqual(due.endpoints);
    expect(JSON.parse(sendNotification.mock.calls[0][1] as string)).toMatchObject({
      body: "Gastou algo hoje? Leva 5 segundos para registrar.",
      url: "/novo?src=notification",
    });
  });

  it("não duplica no mesmo dia local, nem com execuções simultâneas", async () => {
    const user = await newUser();
    const only = { onlyUserIds: [user.id] };

    const [a, b] = await Promise.all([runReminderCron(NOW, only), runReminderCron(NOW, only)]);
    expect(a.sent + b.sent).toBe(1);
    expect((await runReminderCron(NOW, only)).sent).toBe(0);
    // 20:30 local, same hour and same local day → still nothing.
    expect((await runReminderCron(new Date("2027-03-10T23:30:00.000Z"), only)).sent).toBe(0);
    expect(sendNotification).toHaveBeenCalledTimes(1);

    const settings = await prisma.userSettings.findUniqueOrThrow({ where: { userId: user.id } });
    expect(settings.lastReminderSentOn?.toISOString().slice(0, 10)).toBe("2027-03-10");

    // Next local day, same hour → sends again.
    const tomorrow = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
    expect((await runReminderCron(tomorrow, only)).sent).toBe(1);
  });

  it("ignora gasto automático de conta fixa: o dia segue sem registro", async () => {
    const user = await newUser();
    await addExpense(user.id, new Date("2027-03-10T15:00:00.000Z"), true);

    const result = await runReminderCron(NOW, { onlyUserIds: [user.id] });
    expect(result.sent).toBe(1);
  });

  it("respeita o timezone ao decidir se o usuário já registrou no dia", async () => {
    // 02:30 UTC on 03-10 is 23:30 on 03-09 in São Paulo, but already 03-10 in UTC.
    const spUser = await newUser({ timezone: SP, reminderHour: 20 });
    const utcUser = await newUser({ timezone: "UTC", reminderHour: 23 });
    const createdAt = new Date("2027-03-10T02:30:00.000Z");
    await addExpense(spUser.id, createdAt);
    await addExpense(utcUser.id, createdAt);

    const result = await runReminderCron(NOW, { onlyUserIds: [spUser.id, utcUser.id] });

    expect(result.sent).toBe(1);
    expect(notifiedEndpoints()).toEqual(spUser.endpoints); // registered "yesterday" locally
  });

  it("remove assinaturas expiradas (404/410) e mantém as que falharam por outro motivo", async () => {
    const user = await newUser({ devices: 3 });
    const [ok, gone, flaky] = user.endpoints;
    sendNotification.mockImplementation(async (subscription: { endpoint: string }) => {
      if (subscription.endpoint === gone) throw Object.assign(new Error("Gone"), { statusCode: 410 });
      if (subscription.endpoint === flaky) throw Object.assign(new Error("Boom"), { statusCode: 500 });
      return { statusCode: 201 };
    });

    const result = await runReminderCron(NOW, { onlyUserIds: [user.id] });

    expect(result).toEqual({ checked: 1, sent: 1, removedSubscriptions: 1 });
    const left = await prisma.pushSubscription.findMany({ where: { userId: user.id } });
    expect(left.map((s) => s.endpoint).sort()).toEqual([ok, flaky].sort());
  });
});

// 2027-03-10 has 22 days left (10 → 31); a R$ 220,00 Lazer limit gives R$ 10,00 a day.
describe("texto com o valor diário (integration)", () => {
  const DEFAULT_BODY = "Gastou algo hoje? Leva 5 segundos para registrar.";

  async function withCycle(
    userId: string,
    expenses: { amountCents: number; occurredOn: string; bucket?: "wants" | "needs" }[] = [],
    wantsLimitCents = 22000
  ) {
    const cycle = await prisma.budgetCycle.create({
      data: {
        userId, period: "2027-03", incomeCents: 100000,
        needsLimitCents: 50000, wantsLimitCents, savingsLimitCents: 20000,
      },
    });
    for (const e of expenses) {
      await prisma.expense.create({
        data: {
          userId, cycleId: cycle.id, amountCents: e.amountCents, description: "x",
          bucket: e.bucket ?? "wants", occurredOn: new Date(`${e.occurredOn}T00:00:00.000Z`),
        },
      });
    }
  }

  async function bodyAfterCron(userId: string) {
    const cyclesBefore = await prisma.budgetCycle.count();
    const result = await runReminderCron(NOW, { onlyUserIds: [userId] });
    expect(result.sent).toBe(1);
    // the cron never creates a cycle
    expect(await prisma.budgetCycle.count()).toBe(cyclesBefore);
    return (JSON.parse(sendNotification.mock.calls[0][1] as string) as { body: string }).body;
  }

  it("opção desativada: texto padrão, mesmo com saldo", async () => {
    const user = await newUser({ showAmount: false });
    await withCycle(user.id);
    expect(await bodyAfterCron(user.id)).toBe(DEFAULT_BODY);
  });

  it("opção ativada com saldo para hoje: mostra o que resta", async () => {
    const user = await newUser({ showAmount: true });
    await withCycle(user.id, [{ amountCents: 300, occurredOn: "2027-03-10" }]);
    const body = await bodyAfterCron(user.id);
    expect(body.replace(/\s/g, " ")).toBe("Você ainda tem R$ 7,00 de lazer hoje. Gastou algo?");
  });

  it("opção ativada, sem gasto hoje: mostra o valor inteiro do dia", async () => {
    const user = await newUser({ showAmount: true });
    await withCycle(user.id);
    expect((await bodyAfterCron(user.id)).replace(/\s/g, " ")).toBe(
      "Você ainda tem R$ 10,00 de lazer hoje. Gastou algo?"
    );
  });

  it("gastos de outros baldes não reduzem o valor", async () => {
    const user = await newUser({ showAmount: true });
    await withCycle(user.id, [{ amountCents: 9000, occurredOn: "2027-03-10", bucket: "needs" }]);
    expect((await bodyAfterCron(user.id)).replace(/\s/g, " ")).toContain("R$ 10,00");
  });

  it("opção ativada e passou do valor de hoje: texto padrão", async () => {
    const user = await newUser({ showAmount: true });
    await withCycle(user.id, [{ amountCents: 1500, occurredOn: "2027-03-10" }]);
    expect(await bodyAfterCron(user.id)).toBe(DEFAULT_BODY);
  });

  it("opção ativada e lazer do mês esgotado: texto padrão", async () => {
    const user = await newUser({ showAmount: true });
    await withCycle(user.id, [{ amountCents: 22000, occurredOn: "2027-03-02" }]);
    expect(await bodyAfterCron(user.id)).toBe(DEFAULT_BODY);
  });

  it("opção ativada sem ciclo no período: texto padrão e nenhum ciclo é criado", async () => {
    const user = await newUser({ showAmount: true });
    expect(await prisma.budgetCycle.count({ where: { userId: user.id } })).toBe(0);
    expect(await bodyAfterCron(user.id)).toBe(DEFAULT_BODY);
    expect(await prisma.budgetCycle.count({ where: { userId: user.id } })).toBe(0);
  });

  it("ciclo só de outro mês conta como sem ciclo", async () => {
    const user = await newUser({ showAmount: true });
    await prisma.budgetCycle.create({
      data: {
        userId: user.id, period: "2027-02", incomeCents: 1,
        needsLimitCents: 1, wantsLimitCents: 99999, savingsLimitCents: 1,
      },
    });
    expect(await bodyAfterCron(user.id)).toBe(DEFAULT_BODY);
  });
});
