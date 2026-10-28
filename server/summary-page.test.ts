import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { currentPeriod, previousPeriod } from "@/lib/domain/period";

// Hits the real Neon database — run via `pnpm test:integration`. The session,
// `notFound`/`redirect` and `after()` are replaced: the first so a test picks
// the signed-in user, the next two so they throw like Next's do, and the last
// by a collector we flush by hand (it only works inside a request).
const state = vi.hoisted(() => ({
  userId: "",
  pending: [] as Array<() => Promise<void> | void>,
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUserOrRedirect: async () => ({ id: state.userId, email: "t@example.test", name: "T" }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));
vi.mock("next/server", () => ({
  after: (cb: () => Promise<void> | void) => {
    state.pending.push(cb);
  },
}));

const { default: ResumoPage } = await import("@/app/(app)/resumo/[period]/page");
const { default: NovoPage } = await import("@/app/(app)/novo/page");
const { default: PainelPage } = await import("@/app/(app)/page");

const TZ = "America/Sao_Paulo";
const CURRENT = currentPeriod(TZ);
const PREVIOUS = previousPeriod(CURRENT);
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const users: string[] = [];

async function newUser(settings: { lastSummarySeenPeriod?: string } = {}) {
  const userId = `test-${randomUUID()}`;
  users.push(userId);
  await prisma.user.create({ data: { id: userId, email: `${userId}@example.test`, name: "T" } });
  await prisma.userSettings.create({
    data: { userId, timezone: TZ, defaultIncomeCents: 500000, onboardedAt: new Date(), ...settings },
  });
  return userId;
}

/** A cycle for `period` with one manual expense (so it has activity). */
async function seedCycle(userId: string, period: string) {
  const cycle = await prisma.budgetCycle.create({
    data: {
      userId, period, incomeCents: 500000, needsLimitCents: 250000,
      wantsLimitCents: 150000, savingsLimitCents: 100000,
    },
  });
  await prisma.expense.create({
    data: {
      userId, cycleId: cycle.id, amountCents: 1000, description: "x",
      bucket: "wants", occurredOn: day(`${period}-10`),
    },
  });
  return cycle;
}

function render(period: string, auto?: string) {
  return ResumoPage({
    params: Promise.resolve({ period }),
    searchParams: Promise.resolve(auto === undefined ? {} : { auto }),
  });
}

async function flush() {
  const callbacks = state.pending.splice(0);
  for (const cb of callbacks) await cb();
}

async function viewedEvents(userId: string) {
  return prisma.event.findMany({ where: { userId, name: "monthly_summary_viewed" } });
}

beforeEach(() => {
  state.pending.length = 0;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: users } } });
});

describe("/resumo/[period] — 404", () => {
  it("período de OUTRO usuário responde 404, sem evento", async () => {
    const owner = await newUser();
    const stranger = await newUser();
    await seedCycle(owner, PREVIOUS);
    state.userId = stranger;
    await expect(render(PREVIOUS, "1")).rejects.toThrow("NEXT_NOT_FOUND");
    await flush();
    expect(await viewedEvents(stranger)).toHaveLength(0);
  });

  it("o dono do ciclo não leva 404 no mesmo período (controle do teste acima)", async () => {
    const owner = await newUser();
    await seedCycle(owner, PREVIOUS);
    state.userId = owner;
    await expect(render(PREVIOUS)).resolves.toBeTruthy();
  });

  it.each(["abc", "2026-13", "2026-00", "2026-1", "20261", "2026-10-01", ""])(
    "período inválido %j responde 404",
    async (bad) => {
      state.userId = await newUser();
      await expect(render(bad)).rejects.toThrow("NEXT_NOT_FOUND");
    }
  );

  it("mês atual responde 404, mesmo com ciclo", async () => {
    const userId = await newUser();
    await seedCycle(userId, CURRENT);
    state.userId = userId;
    await expect(render(CURRENT)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("mês futuro responde 404, mesmo com ciclo", async () => {
    const userId = await newUser();
    await seedCycle(userId, "2099-01");
    state.userId = userId;
    await expect(render("2099-01")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("mês passado sem ciclo do usuário responde 404", async () => {
    state.userId = await newUser();
    await expect(render("2020-03")).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("/resumo/[period] — evento monthly_summary_viewed", () => {
  it("auto=1 no mês anterior grava { auto: true } e nenhuma outra prop", async () => {
    const userId = await newUser();
    await seedCycle(userId, PREVIOUS);
    state.userId = userId;
    await render(PREVIOUS, "1");
    await flush();
    const events = await viewedEvents(userId);
    expect(events).toHaveLength(1);
    expect(events[0].props).toEqual({ auto: true });
  });

  it("sem auto grava { auto: false }", async () => {
    const userId = await newUser();
    await seedCycle(userId, PREVIOUS);
    state.userId = userId;
    await render(PREVIOUS);
    await flush();
    expect((await viewedEvents(userId))[0].props).toEqual({ auto: false });
  });

  it("auto=1 forjado em mês antigo grava { auto: false }", async () => {
    const userId = await newUser();
    await seedCycle(userId, "2020-03");
    state.userId = userId;
    await render("2020-03", "1");
    await flush();
    expect((await viewedEvents(userId))[0].props).toEqual({ auto: false });
  });

  it("abrir o resumo não marca como visto", async () => {
    const userId = await newUser();
    await seedCycle(userId, PREVIOUS);
    state.userId = userId;
    await render(PREVIOUS, "1");
    await flush();
    const settings = await prisma.userSettings.findUniqueOrThrow({ where: { userId } });
    expect(settings.lastSummarySeenPeriod).toBeNull();
  });
});

describe("painel e /novo", () => {
  it("painel redireciona (no servidor) para o resumo do mês anterior elegível", async () => {
    const userId = await newUser();
    await seedCycle(userId, PREVIOUS);
    state.userId = userId;
    await expect(PainelPage()).rejects.toThrow(`NEXT_REDIRECT:/resumo/${PREVIOUS}?auto=1`);
  });

  it("painel não redireciona depois de confirmado", async () => {
    const userId = await newUser({ lastSummarySeenPeriod: PREVIOUS });
    await seedCycle(userId, PREVIOUS);
    state.userId = userId;
    await expect(PainelPage()).resolves.toBeTruthy();
  });

  it("painel não redireciona se o mês anterior não teve atividade", async () => {
    const userId = await newUser();
    await prisma.budgetCycle.create({
      data: {
        userId, period: PREVIOUS, incomeCents: 500000, needsLimitCents: 250000,
        wantsLimitCents: 150000, savingsLimitCents: 100000,
      },
    });
    state.userId = userId;
    await expect(PainelPage()).resolves.toBeTruthy();
  });

  it("/novo NÃO redireciona, mesmo com resumo pendente", async () => {
    const userId = await newUser();
    await seedCycle(userId, PREVIOUS);
    state.userId = userId;
    await expect(
      NovoPage({ searchParams: Promise.resolve({ src: "notification" }) })
    ).resolves.toBeTruthy();
  });
});
