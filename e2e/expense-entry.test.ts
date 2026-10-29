import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { Page } from "playwright-core";
import { prisma } from "@/lib/db";
import { localDate } from "@/lib/domain/local-date";
import { currentPeriod } from "@/lib/domain/period";
import { BASE, TZ, eventually, seedEntryUser, startApp, type App } from "./harness";

// Real browser against `next dev` (dev auth bypass) and the real Neon dev
// database — run via `pnpm test:e2e` (see e2e/harness.ts).
const USER_ID = `test-e2e-${randomUUID()}`;
const TODAY = localDate(TZ);
const PERIOD = currentPeriod(TZ);

let app: App;

beforeAll(async () => {
  await seedEntryUser(USER_ID);
  app = await startApp(USER_ID);
});

afterAll(async () => {
  await app?.stop();
  await prisma.user.deleteMany({ where: { id: USER_ID } });
});

async function open(path = "/") {
  const context = await app.browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  await page.goto(`${BASE}${path}`);
  // React attaches its fiber to DOM nodes on hydration; a key press before
  // that would be lost.
  await page.waitForFunction(() =>
    Object.keys(document.body.querySelector("main") ?? {}).some((key) => key.startsWith("__reactFiber"))
  );
  return { page, context };
}

async function type(page: Page, digits: string) {
  for (const d of digits) await page.getByRole("button", { name: d, exact: true }).click();
}

const countExpenses = () => prisma.expense.count({ where: { userId: USER_ID } });
const dialog = (page: Page) => page.getByRole("dialog");

describe("lançamento de gasto — sheet e tela cheia", () => {
  it("6.1 painel → sheet → valor → chip → salvar → toast → painel atualizado → Desfazer", async () => {
    const before = await countExpenses();
    const { page, context } = await open("/");

    await page.getByRole("link", { name: "Novo gasto" }).click();
    await page.waitForURL(`${BASE}/novo`);
    await dialog(page).waitFor();
    // the dashboard stays behind the sheet
    await expect(page.locator("h1", { hasText: "Seu mês" }).isVisible()).resolves.toBe(true);

    await type(page, "1200");
    await expect(dialog(page).getByTestId("amount").getAttribute("aria-label")).resolves.toMatch(/Valor R\$\s12,00/);

    await dialog(page).getByRole("button", { name: "Mercado", exact: true }).click();
    await expect(dialog(page).getByRole("radio", { name: /Necessidades/ }).getAttribute("aria-checked")).resolves.toBe("true");
    await expect(dialog(page).getByText("como da última vez").isVisible()).resolves.toBe(true);
    await expect(dialog(page).getByTestId("impact").textContent()).resolves.toMatch(/Necessidades no mês: .* → .* disponível/);

    await dialog(page).getByRole("button", { name: /^Salvar R\$\s12,00$/ }).click();
    await page.getByText(/Mercado · R\$\s12,00 salvo/).waitFor();
    await dialog(page).waitFor({ state: "detached" });
    await page.waitForURL(`${BASE}/`);

    // saved with today's date, and the event carries the chip data
    const saved = await prisma.expense.findFirstOrThrow({ where: { userId: USER_ID }, orderBy: { createdAt: "desc" } });
    expect(await countExpenses()).toBe(before + 1);
    expect([saved.amountCents, saved.description, saved.bucket, saved.occurredOn.toISOString().slice(0, 10)]).toEqual([
      1200, "Mercado", "needs", TODAY,
    ]);
    const event = await eventually(() =>
      prisma.event.findFirst({ where: { userId: USER_ID, name: "expense_created" }, orderBy: { createdAt: "desc" } })
    );
    expect(event.props).toMatchObject({ usedChip: true, chipSource: "history", source: "quick_entry" });
    expect((event.props as { durationMs: number }).durationMs % 100).toBe(0);

    // the dashboard shows the new expense without a manual reload
    await expect(page.getByText("R$ 12,00", { exact: false }).first().isVisible()).resolves.toBe(true);
    await expect(page.locator("main li", { hasText: "Mercado" }).filter({ hasText: /R\$\s12,00/ }).count()).resolves.toBe(1);

    // Desfazer
    await page.getByRole("button", { name: "Desfazer" }).click();
    await eventually(async () => (await countExpenses()) === before);
    await eventually(async () => (await page.locator("main li", { hasText: "Mercado" }).filter({ hasText: /R\$\s12,00/ }).count()) === 0);

    await context.close();
  });

  it("6.2 /novo?src=notification em tela cheia → salvar → Lançar outro mantém a data", async () => {
    const { page, context } = await open("/novo?src=notification");
    expect(await dialog(page).count()).toBe(0); // full screen, not a sheet
    await expect(page.getByRole("heading", { name: "Novo gasto" }).isVisible()).resolves.toBe(true);

    // a date other than today (the 1st), unless today is the 1st itself
    const target = TODAY.endsWith("-01") ? TODAY : `${PERIOD}-01`;
    if (target !== TODAY) await page.getByLabel("Outra data").fill(target);

    // physical keyboard works like the keypad; Enter saves when enabled
    await page.keyboard.press("5");
    await page.keyboard.press("0");
    await page.keyboard.press("0");
    await page.keyboard.press("0");
    await expect(page.getByTestId("amount").getAttribute("aria-label")).resolves.toMatch(/R\$\s50,00/);
    await page.getByRole("button", { name: "iFood", exact: true }).click();
    await expect(page.getByRole("radio", { name: /Lazer/ }).getAttribute("aria-checked")).resolves.toBe("true");
    await page.keyboard.press("Enter");

    await page.getByRole("button", { name: "Lançar outro" }).waitFor();
    await expect(page.getByRole("button", { name: "Ir para o painel" }).isVisible()).resolves.toBe(true);
    const saved = await prisma.expense.findFirstOrThrow({ where: { userId: USER_ID }, orderBy: { createdAt: "desc" } });
    expect([saved.amountCents, saved.description, saved.occurredOn.toISOString().slice(0, 10)]).toEqual([5000, "iFood", target]);
    const event = await eventually(() =>
      prisma.event.findFirst({ where: { userId: USER_ID, name: "expense_created", props: { path: ["source"], equals: "notification" } } })
    );
    expect(event.props).toMatchObject({ source: "notification", usedChip: true });

    // Lançar outro: amount and description cleared, date kept
    await page.getByRole("button", { name: "Lançar outro" }).click();
    await expect(page.getByTestId("amount").getAttribute("aria-label")).resolves.toMatch(/R\$\s0,00/);
    await expect(page.getByRole("button", { name: "iFood", exact: true }).getAttribute("aria-pressed")).resolves.toBe("false");
    if (target !== TODAY) {
      await expect(page.getByRole("button", { name: /^01\/\d\d$/ }).getAttribute("aria-pressed")).resolves.toBe("true");
    }
    expect(await page.getByRole("button", { name: /^Salvar/ }).isDisabled()).toBe(true);

    // back to the dashboard
    await type(page, "100");
    await page.getByRole("button", { name: "Mercado", exact: true }).click();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Ir para o painel" }).click();
    await page.waitForURL(`${BASE}/`);

    await context.close();
  });

  it("6.3 refresh com o sheet aberto abre a tela cheia; voltar fecha sem registrar", async () => {
    const before = await countExpenses();
    const { page, context } = await open("/");

    // refresh
    await page.getByRole("link", { name: "Novo gasto" }).click();
    await dialog(page).waitFor();
    await page.reload();
    await page.waitForURL(`${BASE}/novo`);
    await page.getByRole("heading", { name: "Novo gasto" }).waitFor();
    expect(await dialog(page).count()).toBe(0);

    // system back from the full page returns to the dashboard
    await page.goto(`${BASE}/`);
    await page.getByRole("link", { name: "Novo gasto" }).click();
    await dialog(page).waitFor();
    await type(page, "99"); // a draft that must not be saved
    await page.goBack();
    await page.waitForURL(`${BASE}/`);
    await dialog(page).waitFor({ state: "detached" });
    await expect(page.getByRole("heading", { name: "Seu mês" }).isVisible()).resolves.toBe(true);

    // forward reopens it
    await page.goForward();
    await dialog(page).waitFor();

    // dragging the handle down closes it
    const handle = await dialog(page).getByTestId("sheet-handle").boundingBox();
    await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + 260, { steps: 8 });
    await page.mouse.up();
    await dialog(page).waitFor({ state: "detached" });
    await page.waitForURL(`${BASE}/`);

    expect(await countExpenses()).toBe(before);
    await context.close();
  });

  it("Outro: sugere o balde pelo texto e move o valor de 'padaria 12,50' para o teclado", async () => {
    const { page, context } = await open("/novo");

    await page.getByRole("button", { name: "+ Outro" }).click();
    const field = page.getByLabel("Descrição do gasto").last();
    await field.fill("cinema");
    await expect(page.getByRole("radio", { name: /Lazer/ }).getAttribute("aria-checked")).resolves.toBe("true");
    await expect(page.getByText("sugerido").isVisible()).resolves.toBe(true);
    // the system keyboard is up: the amount keypad is out of the way
    expect(await page.getByRole("group", { name: "Teclado numérico" }).isVisible()).toBe(false);

    await field.fill("padaria 12,50");
    await page.getByRole("button", { name: "OK" }).click();
    await expect(page.getByTestId("amount").getAttribute("aria-label")).resolves.toMatch(/R\$\s12,50/);
    await expect(field.inputValue()).resolves.toBe("padaria");
    expect(await page.getByRole("group", { name: "Teclado numérico" }).isVisible()).toBe(true);
    expect(await page.getByRole("button", { name: /^Salvar R\$\s12,50$/ }).isEnabled()).toBe(true);

    await context.close();
  });
});
