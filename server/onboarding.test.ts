import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { completeOnboarding } from "./queries";

// Hits the real Neon database — run via `pnpm test:integration`. Each test
// creates and tears down its own user, since completeOnboarding's
// idempotency is exactly what's under test here (see
// "Confirmação repetida" in specs/onboarding/spec.md).
describe("completeOnboarding (integration)", () => {
  const userIds: string[] = [];

  async function createTestUser() {
    const userId = `test-${randomUUID()}`;
    userIds.push(userId);
    await prisma.user.create({
      data: { id: userId, email: `${userId}@example.test`, name: "Test User" },
    });
    return userId;
  }

  afterEach(async () => {
    while (userIds.length > 0) {
      const userId = userIds.pop()!;
      await prisma.user.delete({ where: { id: userId } });
    }
  });

  it("salva a renda padrão, marca onboardedAt e cria o ciclo do período atual", async () => {
    const userId = await createTestUser();

    const { settings, cycle } = await completeOnboarding(userId, 500000);

    expect(settings.defaultIncomeCents).toBe(500000);
    expect(settings.onboardedAt).not.toBeNull();
    expect(cycle.incomeCents).toBe(500000);
    expect(cycle.needsLimitCents + cycle.wantsLimitCents + cycle.savingsLimitCents).toBe(
      500000
    );
  });

  it("é idempotente num reenvio sequencial (retry) — não duplica o ciclo nem sobrescreve a renda", async () => {
    const userId = await createTestUser();

    const first = await completeOnboarding(userId, 500000);
    // A retried submit (e.g. network retry) might arrive with the same
    // value, or a client-side race might resend with a stale one — either
    // way, once onboarded, it must not change anything.
    const second = await completeOnboarding(userId, 700000);

    expect(second.cycle.id).toBe(first.cycle.id);
    expect(second.settings.defaultIncomeCents).toBe(500000); // not 700000
    expect(second.settings.onboardedAt).toEqual(first.settings.onboardedAt);

    const cycleCount = await prisma.budgetCycle.count({ where: { userId } });
    expect(cycleCount).toBe(1);
  });

  it("é idempotente em duplo clique (dois envios concorrentes) — só um ciclo é criado", async () => {
    const userId = await createTestUser();

    const [a, b] = await Promise.all([
      completeOnboarding(userId, 500000),
      completeOnboarding(userId, 500000),
    ]);

    expect(a.cycle.id).toBe(b.cycle.id);

    const cycleCount = await prisma.budgetCycle.count({ where: { userId } });
    expect(cycleCount).toBe(1);

    const settings = await prisma.userSettings.findUniqueOrThrow({
      where: { userId },
    });
    expect(settings.onboardedAt).not.toBeNull();
  });
});
