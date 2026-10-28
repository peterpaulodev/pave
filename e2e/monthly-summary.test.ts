import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { chromium, type Browser } from "playwright-core";
import { prisma } from "@/lib/db";
import { currentPeriod, periodLabel, previousPeriod } from "@/lib/domain/period";

// Real browser against `next dev` (dev auth bypass) and the real Neon dev
// database — run via `pnpm test:e2e`. Needs port 3100 free and no other
// `next dev` running in this directory (Next allows one per project).
const PORT = 3100;
const BASE = `http://localhost:${PORT}`;
const TZ = "America/Sao_Paulo";
const CURRENT = currentPeriod(TZ);
const PREVIOUS = previousPeriod(CURRENT);
const USER_ID = `test-e2e-${randomUUID()}`;

let server: ChildProcess | undefined;
let serverLog = "";
let browser: Browser | undefined;

async function waitForServer(timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (server?.exitCode !== null && server?.exitCode !== undefined) {
      throw new Error(`next dev saiu com código ${server.exitCode}:\n${serverLog}`);
    }
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`next dev não respondeu em ${timeoutMs}ms:\n${serverLog}`);
}

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

  server = spawn("pnpm", ["exec", "next", "dev", "-p", String(PORT)], {
    env: { ...process.env, DEV_AUTH_BYPASS_USER_ID: USER_ID },
    detached: true, // own process group, so the whole tree can be killed
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout?.on("data", (chunk) => (serverLog += chunk));
  server.stderr?.on("data", (chunk) => (serverLog += chunk));
  await waitForServer(90_000);

  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
});

afterAll(async () => {
  await browser?.close();
  if (server?.pid) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      // already gone
    }
  }
  await prisma.user.deleteMany({ where: { id: USER_ID } });
});

describe("resumo do mês — fluxo completo", () => {
  it("painel → redirect → Começar → painel → recarregar sem novo redirect → visto gravado", async () => {
    const context = await browser!.newContext({ viewport: { width: 390, height: 844 } });
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
