import { afterAll, beforeAll, describe, it } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import type { Page } from "playwright-core";
import { prisma } from "@/lib/db";
import { BASE, seedEntryUser, startApp, type App } from "./harness";

// Screenshots of the entry screen states at 390px, light and dark (task 6.4).
// Only runs with E2E_SCREENSHOT_DIR set: `E2E_SCREENSHOT_DIR=/tmp/shots pnpm test:e2e`.
const DIR = process.env.E2E_SCREENSHOT_DIR;
const USER_ID = `test-e2e-${randomUUID()}`;
let app: App;

beforeAll(async () => {
  if (!DIR) return;
  mkdirSync(DIR, { recursive: true });
  await seedEntryUser(USER_ID);
  app = await startApp(USER_ID);
});

afterAll(async () => {
  if (!DIR) return;
  await app?.stop();
  await prisma.user.deleteMany({ where: { id: USER_ID } });
});

async function type(page: Page, digits: string) {
  for (const d of digits) await page.getByRole("button", { name: d, exact: true }).click();
}

describe.skipIf(!DIR)("telas de lançamento — capturas", () => {
  for (const theme of ["light", "dark"] as const) {
    it(`sheet e tela cheia (${theme})`, async () => {
      const context = await app.browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        hasTouch: true,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      page.setDefaultTimeout(60_000);
      page.on("console", (m) => m.type() === "error" && console.log("CONSOLE", m.text().slice(0, 600)));
      page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 600)));
      const shot = (name: string) => page.screenshot({ path: `${DIR}/${name}-${theme}.png` });
      // The Next dev badge (a Base UI warning from the dashboard's own buttons) is not part of the screen.
      await context.addInitScript(() => {
        const hide = () => document.head?.insertAdjacentHTML("beforeend", "<style>nextjs-portal{display:none!important}</style>");
        document.addEventListener("DOMContentLoaded", hide);
      });
      const setTheme = () => page.evaluate((t) => document.documentElement.classList.toggle("dark", t === "dark"), theme);
      const hydrated = () =>
        page.waitForFunction(() =>
          Object.keys(document.body.querySelector("main") ?? {}).some((key) => key.startsWith("__reactFiber"))
        );
      const openSheet = async () => {
        await page.goto(`${BASE}/`);
        await hydrated();
        await setTheme();
        await page.getByRole("link", { name: "Novo gasto" }).click();
        await page.getByRole("dialog").waitFor();
        await page.waitForTimeout(400);
        await setTheme();
      };
      const dlg = () => page.getByRole("dialog");

      // 1. empty
      await openSheet();
      await shot("1-vazio");

      // 2. typing
      await type(page, "1250");
      await shot("2-digitando");

      // 3. chip selected (Lazer, from history)
      await dlg().getByRole("button", { name: "iFood", exact: true }).click();
      await shot("3-chip-selecionado");

      // 4. impact over the plan (Necessidades)
      await dlg().getByRole("button", { name: "Mercado", exact: true }).click();
      await type(page, "99999");
      await shot("4-acima-do-planejado");

      // 5. "Outro" with the on-screen keyboard open (viewport shrunk to what is left)
      await page.setViewportSize({ width: 390, height: 520 });
      await dlg().getByRole("button", { name: "+ Outro" }).click();
      await page.keyboard.type("padaria");
      await page.waitForTimeout(200);
      await shot("5-outro-com-teclado");
      await page.setViewportSize({ width: 390, height: 844 });
      await dlg().getByRole("button", { name: "OK" }).click();

      // 6. error: a future date goes past the picker's max, so the server refuses it
      await dlg().getByRole("button", { name: "Mercado", exact: true }).click();
      const future = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
      await page.getByLabel("Outra data").fill(future);
      await dlg().getByRole("button", { name: /^Salvar/ }).click();
      await dlg().getByRole("alert").waitFor();
      await shot("6-erro");

      // 7. success, full screen (/novo)
      await page.goto(`${BASE}/novo`);
      await hydrated();
      await setTheme();
      await type(page, "1200");
      await page.getByRole("button", { name: "Mercado", exact: true }).click();
      await shot("7-tela-cheia");
      await page.getByRole("button", { name: /^Salvar/ }).click();
      await page.getByRole("button", { name: "Lançar outro" }).waitFor();
      await shot("8-sucesso-tela-cheia");

      await context.close();
    });
  }
});
