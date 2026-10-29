import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { BASE, TZ, startApp, type App } from "./harness";
import { currentPeriod, periodLabel, previousPeriod } from "@/lib/domain/period";

// Real browser against `next dev` (dev auth bypass) and the real Neon dev
// database — run via `pnpm test:e2e` (see e2e/harness.ts).
const CURRENT = currentPeriod(TZ);
const PREVIOUS = previousPeriod(CURRENT);
const USER_ID = `test-e2e-${randomUUID()}`;

let app: App | undefined;
const browser = () => app!.browser;

beforeAll(async () => {
  // Seed: an onboarded user with last month's cycle and real activity.
  await prisma.user.create({
    data: { id: USER_ID, email: `${USER_ID}@dev-bypass.local`, name: "E2E" },
  });
  await prisma.userSettings.create({
    data: { userId: USER_ID, timezone: TZ, defaultIncomeCents: 500000, onboardedAt: new Date() },
  });
  const cycle = await prisma.budgetCycle.create({
    data: {
      userId: USER_ID, period: PREVIOUS, incomeCents: 500000, needsLimitCents: 250000,
      wantsLimitCents: 150000, savingsLimitCents: 100000,
    },
  });
  await prisma.expense.create({
    data: {
      userId: USER_ID, cycleId: cycle.id, amountCents: 4500, description: "iFood",
      bucket: "wants", occurredOn: new Date(`${PREVIOUS}-10T00:00:00.000Z`),
    },
  });

  app = await startApp(USER_ID);
});

afterAll(async () => {
  await app?.stop();
  await prisma.user.deleteMany({ where: { id: USER_ID } });
});

describe("resumo do mês — fluxo completo", () => {
  it("painel → redirect → Começar → painel → recarregar sem novo redirect → visto gravado", async () => {
    const context = await browser().newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    page.setDefaultTimeout(90_000);

    // 1. first visit of the new month: the panel redirects to the summary
    await page.goto(`${BASE}/`);
    await page.waitForURL(`${BASE}/resumo/${PREVIOUS}?auto=1`);
    await expect(page.getByRole("heading", { name: `Resumo de ${periodLabel(PREVIOUS)}` }).isVisible()).resolves.toBe(true);

    // nothing is marked as seen just by opening it
    expect((await prisma.userSettings.findUniqueOrThrow({ where: { userId: USER_ID } })).lastSummarySeenPeriod).toBeNull();

    // 2. "Começar [mês]" → back to the panel (no redirect loop)
    await page.getByRole("button", { name: `Começar ${periodLabel(CURRENT)}` }).click();
    await page.waitForURL(`${BASE}/?summary=seen`);
    await expect(page.getByRole("heading", { name: "Seu mês" }).isVisible()).resolves.toBe(true);

    // 3. the confirmation was written
    const seen = async () =>
      (await prisma.userSettings.findUniqueOrThrow({ where: { userId: USER_ID } })).lastSummarySeenPeriod;
    expect(await seen()).toBe(PREVIOUS);

    // 4. a fresh load of the panel does not redirect again
    await page.goto(`${BASE}/`);
    await expect(page.getByRole("heading", { name: "Seu mês" }).isVisible()).resolves.toBe(true);
    expect(new URL(page.url()).pathname).toBe("/");
    await page.reload();
    await expect(page.getByRole("heading", { name: "Seu mês" }).isVisible()).resolves.toBe(true);
    expect(new URL(page.url()).pathname).toBe("/");

    await context.close();
  });
});
