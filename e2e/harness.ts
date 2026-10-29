import { spawn, type ChildProcess } from "node:child_process";
import { chromium, type Browser } from "playwright-core";
import { prisma } from "@/lib/db";
import { localDate } from "@/lib/domain/local-date";
import { currentPeriod } from "@/lib/domain/period";

// Shared by every e2e file: `next dev` with the dev auth bypass (one user per
// server) plus the cached Chromium. Needs port 3100 free and no other
// `next dev` in this directory (Next allows one per project), so each file
// starts its server in beforeAll and tears the whole process group down in
// afterAll; files run one after another (vitest.e2e.config.ts).
export const PORT = 3100;
export const BASE = `http://localhost:${PORT}`;
export const TZ = "America/Sao_Paulo";

export interface App {
  browser: Browser;
  stop: () => Promise<void>;
}

export async function startApp(bypassUserId: string): Promise<App> {
  let log = "";
  const server: ChildProcess = spawn("pnpm", ["exec", "next", "dev", "-p", String(PORT)], {
    env: { ...process.env, DEV_AUTH_BYPASS_USER_ID: bypassUserId },
    detached: true, // own process group, so the whole tree can be killed
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout?.on("data", (chunk) => (log += chunk));
  server.stderr?.on("data", (chunk) => (log += chunk));

  const stopServer = () => {
    if (!server.pid) return;
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      // already gone
    }
  };

  try {
    const deadline = Date.now() + 90_000;
    for (;;) {
      if (server.exitCode !== null) throw new Error(`next dev saiu com código ${server.exitCode}:\n${log}`);
      try {
        if ((await fetch(`${BASE}/api/health`)).ok) break;
      } catch {
        // not up yet
      }
      if (Date.now() > deadline) throw new Error(`next dev não respondeu em 90s:\n${log}`);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    return {
      browser,
      stop: async () => {
        await browser.close();
        if (process.env.E2E_SERVER_LOG) console.log(log);
        stopServer();
        // Give the port back before the next file starts its own server.
        await new Promise((resolve) => setTimeout(resolve, 1500));
      },
    };
  } catch (error) {
    stopServer();
    throw error;
  }
}

/** Polls until `read` returns a truthy value (events and `after()` writes are async). */
export async function eventually<T>(read: () => Promise<T | null | undefined | false>, ms = 15_000): Promise<T> {
  const deadline = Date.now() + ms;
  for (;;) {
    const value = await read();
    if (value) return value;
    if (Date.now() > deadline) throw new Error("condição não atendida a tempo");
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

/** An onboarded user with this month's cycle and a history of manual expenses
 * (Mercado ×2 in Necessidades, iFood ×3 in Lazer), so both show up as chips. */
export async function seedEntryUser(userId: string) {
  const today = localDate(TZ);
  const period = currentPeriod(TZ);
  const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
  await prisma.user.create({ data: { id: userId, email: `${userId}@dev-bypass.local`, name: "E2E" } });
  await prisma.userSettings.create({
    data: { userId, timezone: TZ, defaultIncomeCents: 500000, onboardedAt: new Date() },
  });
  const cycle = await prisma.budgetCycle.create({
    data: {
      userId, period: period, incomeCents: 500000,
      needsLimitCents: 250000, wantsLimitCents: 150000, savingsLimitCents: 100000,
    },
  });
  // History: Mercado (Necessidades) ×2 and iFood (Lazer) ×3, so both are chips of the user.
  const rows = [
    ["Mercado", "needs"], ["Mercado", "needs"], ["iFood", "wants"], ["iFood", "wants"], ["iFood", "wants"],
  ] as const;
  for (const [description, bucket] of rows) {
    await prisma.expense.create({
      data: { userId, cycleId: cycle.id, amountCents: 3000, description, bucket, occurredOn: day(today) },
    });
  }
}
