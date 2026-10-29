import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";

const { sendNotification, setVapidDetails } = vi.hoisted(() => ({
  sendNotification: vi.fn(),
  setVapidDetails: vi.fn(),
}));
vi.mock("web-push", () => ({ default: { sendNotification, setVapidDetails } }));

// The session is the only thing replaced: actions run for real against the
// dev database, with the user decided by `session.id`.
const session = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/auth/session", () => ({
  getSessionUser: async () => ({ id: session.id, email: "", name: "" }),
  getSessionUserOrRedirect: async () => ({ id: session.id, email: "", name: "" }),
}));

import { prisma } from "@/lib/db";
import { createExpense, deleteExpense } from "@/actions/expenses";
import { createRecurringAction } from "@/actions/recurring";
import { setReminderSettings } from "@/actions/push";
import { markNoSpendToday } from "@/actions/checkin";
import { completeOnboarding } from "@/actions/onboarding";
import { POST as noSpendRoute } from "@/app/api/checkin/no-spend/route";
import { getOrCreateCycle, upsertUserSettings } from "./queries";
import { runReminderCron } from "./reminders";
import { clearAfter, flushAfter } from "./testing/after-queue";

process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "test-public-key";
process.env.VAPID_PRIVATE_KEY = "test-private-key";
process.env.VAPID_SUBJECT = "mailto:test@example.test";

// Hits the real Neon database — run via `pnpm test:integration`.
const users: string[] = [];

async function newUser(settings: Parameters<typeof upsertUserSettings>[1] = {}) {
  const id = `test-${randomUUID()}`;
  users.push(id);
  await prisma.user.create({ data: { id, email: `${id}@example.test`, name: "T" } });
  await upsertUserSettings(id, { defaultIncomeCents: 500000, ...settings });
  session.id = id;
  return id;
}

async function events(userId: string, name?: string) {
  await flushAfter();
  const rows = await prisma.event.findMany({
    where: { userId, ...(name ? { name } : {}) },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((row) => ({ name: row.name, props: row.props }));
}

beforeEach(() => {
  clearAfter();
  sendNotification.mockReset();
  sendNotification.mockResolvedValue({});
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: users } } });
});

describe("expense_created", () => {
  it("aceita a sugestão: recalculada no servidor, sem overridden", async () => {
    const userId = await newUser();
    await createExpense({ amountCents: 12000, description: "mercado", bucket: "needs" });
    expect(await events(userId)).toEqual([
      {
        name: "expense_created",
        props: {
          source: "quick_entry", bucket: "needs", suggestedBucket: "needs", overridden: false,
          usedChip: false, chipSource: null,
        },
      },
    ]);
  });

  it("trocar o balde sugerido marca overridden", async () => {
    const userId = await newUser();
    await createExpense({ amountCents: 12000, description: "mercado", bucket: "wants" });
    expect(await events(userId)).toMatchObject([
      { props: { bucket: "wants", suggestedBucket: "needs", overridden: true } },
    ]);
  });

  it("sem sugestão do dicionário: suggestedBucket nulo e overridden falso", async () => {
    const userId = await newUser();
    await createExpense({ amountCents: 500, description: "zzqxk", bucket: "wants" });
    expect(await events(userId)).toMatchObject([
      { props: { suggestedBucket: null, overridden: false } },
    ]);
  });

  it("source=notification é repassado", async () => {
    const userId = await newUser();
    await createExpense({
      amountCents: 500,
      description: "mercado",
      bucket: "needs",
      source: "notification",
    });
    expect(await events(userId)).toMatchObject([{ props: { source: "notification" } }]);
  });

  it("não aceita source 'recurring' nem suggestedBucket do cliente", async () => {
    const userId = await newUser();
    const rejected = await createExpense({
      amountCents: 500,
      description: "mercado",
      bucket: "needs",
      source: "recurring" as never,
    });
    expect(rejected.error).toBeDefined();

    await createExpense({
      amountCents: 500,
      description: "mercado",
      bucket: "needs",
      suggestedBucket: "savings",
    } as never);
    expect(await events(userId)).toMatchObject([
      { props: { suggestedBucket: "needs", overridden: false } },
    ]);
  });

  it("props não contêm descrição nem valor", async () => {
    const userId = await newUser();
    await createExpense({ amountCents: 8990, description: "farmácia", bucket: "needs" });
    const serialized = JSON.stringify(await events(userId));
    expect(serialized).not.toContain("farmácia");
    expect(serialized).not.toContain("8990");
  });

  it("falha na gravação do evento não quebra createExpense", async () => {
    const userId = await newUser();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const write = vi.spyOn(prisma.event, "create").mockRejectedValue(new Error("db fora"));

    const result = await createExpense({ amountCents: 500, description: "mercado", bucket: "needs" });
    expect(result.data?.id).toBeDefined();
    await expect(flushAfter()).resolves.toBeUndefined();
    expect(write).toHaveBeenCalled();
    expect(error).toHaveBeenCalled();

    write.mockRestore();
    error.mockRestore();
    expect(await prisma.expense.count({ where: { userId } })).toBe(1);
  });
});

describe("expense_deleted", () => {
  it("registra wasRecurring conforme a origem do gasto", async () => {
    const userId = await newUser();
    const manual = await createExpense({ amountCents: 500, description: "mercado", bucket: "needs" });
    const cycle = await getOrCreateCycle(userId, "2031-01");
    const template = await prisma.recurringExpense.create({
      data: { userId, description: "Aluguel", amountCents: 100, bucket: "needs", dayOfMonth: 5 },
    });
    const auto = await prisma.expense.create({
      data: {
        userId, cycleId: cycle.id, recurringExpenseId: template.id, description: "Aluguel",
        amountCents: 100, bucket: "needs", occurredOn: new Date("2031-01-05T00:00:00.000Z"),
      },
    });
    await flushAfter();

    await deleteExpense(manual.data!.id);
    await deleteExpense(auto.id);
    await deleteExpense(auto.id); // já excluído: não registra de novo

    expect(await events(userId, "expense_deleted")).toEqual([
      { name: "expense_deleted", props: { wasRecurring: false } },
      { name: "expense_deleted", props: { wasRecurring: true } },
    ]);
  });
});

describe("contas fixas", () => {
  it("createRecurringAction com alsoThisMonth: recurring_created + expense_created recurring", async () => {
    const userId = await newUser();
    await createRecurringAction({
      description: "Internet", amountCents: 12000, bucket: "needs", dayOfMonth: 10, alsoThisMonth: true,
    });
    const all = await events(userId);
    expect(all).toContainEqual({
      name: "recurring_created",
      props: { bucket: "needs", alsoThisMonth: true },
    });
    expect(all).toContainEqual({
      name: "expense_created",
      props: { source: "recurring", bucket: "needs", suggestedBucket: null, overridden: false },
    });
    expect(JSON.stringify(all)).not.toContain("Internet");
  });

  it("sem alsoThisMonth: só recurring_created", async () => {
    const userId = await newUser();
    await createRecurringAction({ description: "Internet", amountCents: 12000, bucket: "wants", dayOfMonth: 10 });
    expect(await events(userId)).toEqual([
      { name: "recurring_created", props: { bucket: "wants", alsoThisMonth: false } },
    ]);
  });

  it("o lançamento automático do ciclo grava um expense_created por gasto, em lote", async () => {
    const userId = await newUser();
    await prisma.recurringExpense.createMany({
      data: [
        { userId, description: "Aluguel", amountCents: 100, bucket: "needs", dayOfMonth: 5 },
        { userId, description: "Netflix", amountCents: 50, bucket: "wants", dayOfMonth: 8 },
      ],
    });
    const createMany = vi.spyOn(prisma.event, "createMany");

    await getOrCreateCycle(userId, "2031-02");
    const all = await events(userId, "expense_created");

    expect(createMany).toHaveBeenCalledTimes(1);
    createMany.mockRestore();
    expect(all.map((e) => e.props)).toEqual(
      expect.arrayContaining([
        { source: "recurring", bucket: "needs", suggestedBucket: null, overridden: false },
        { source: "recurring", bucket: "wants", suggestedBucket: null, overridden: false },
      ])
    );
    expect(all).toHaveLength(2);

    // ciclo já existente: nada novo
    await getOrCreateCycle(userId, "2031-02");
    expect(await events(userId, "expense_created")).toHaveLength(2);
  });
});

describe("lembrete", () => {
  it("registra ativar e desativar, e ignora troca de horário", async () => {
    const userId = await newUser({ reminderEnabled: false });
    await setReminderSettings({ enabled: true, hour: 20 });
    await setReminderSettings({ enabled: true, hour: 18 });
    await setReminderSettings({ enabled: false, hour: 18 });
    await setReminderSettings({ enabled: false, hour: 18 });
    expect(await events(userId)).toEqual([
      { name: "reminder_enabled", props: { hour: 20 } },
      { name: "reminder_disabled", props: {} },
    ]);
  });
});

describe("no_spend_checkin", () => {
  it("via app e via notificação; repetir o mesmo dia não duplica", async () => {
    const appUser = await newUser();
    await markNoSpendToday();
    await markNoSpendToday();
    expect(await events(appUser)).toEqual([{ name: "no_spend_checkin", props: { via: "app" } }]);

    const pushUser = await newUser();
    const response = await noSpendRoute();
    expect(response.status).toBe(200);
    expect(await events(pushUser)).toEqual([
      { name: "no_spend_checkin", props: { via: "notification" } },
    ]);
  });
});

describe("onboarding_completed", () => {
  it("grava uma vez; reenvio não duplica", async () => {
    const userId = await newUser();
    // redirect() lança NEXT_REDIRECT em caso de sucesso
    await expect(completeOnboarding(500000)).rejects.toThrow();
    await expect(completeOnboarding(500000)).rejects.toThrow();
    expect(await events(userId)).toEqual([{ name: "onboarding_completed", props: {} }]);
  });
});

describe("reminder_sent (cron)", () => {
  const NOW = new Date("2027-03-10T23:00:00.000Z"); // 20:00 em São Paulo

  async function dueUser() {
    const userId = await newUser({ timezone: "America/Sao_Paulo", reminderEnabled: true, reminderHour: 20 });
    await prisma.pushSubscription.create({
      data: { userId, endpoint: `https://push.example.test/${userId}`, p256dh: "p", auth: "a" },
    });
    return userId;
  }

  it("um evento por usuário com envio bem-sucedido, em um único createMany", async () => {
    const a = await dueUser();
    const b = await dueUser();
    const createMany = vi.spyOn(prisma.event, "createMany");

    const result = await runReminderCron(NOW, { onlyUserIds: [a, b] });
    expect(result.sent).toBe(2);
    expect(await events(a)).toEqual([{ name: "reminder_sent", props: {} }]);
    expect(await events(b)).toEqual([{ name: "reminder_sent", props: {} }]);
    expect(createMany).toHaveBeenCalledTimes(1);
    createMany.mockRestore();
  });

  it("sem envio (nenhum dispositivo aceitou) não grava evento", async () => {
    const a = await dueUser();
    sendNotification.mockRejectedValue(new Error("push fora"));
    const result = await runReminderCron(NOW, { onlyUserIds: [a] });
    expect(result.sent).toBe(0);
    expect(await events(a)).toEqual([]);
  });

  it("falha na gravação dos eventos não quebra o cron", async () => {
    const a = await dueUser();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const write = vi.spyOn(prisma.event, "createMany").mockRejectedValue(new Error("db fora"));

    const result = await runReminderCron(NOW, { onlyUserIds: [a] });
    expect(result.sent).toBe(1);
    await expect(flushAfter()).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();

    write.mockRestore();
    error.mockRestore();
  });
});
