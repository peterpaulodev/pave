import { describe, expect, it } from "vitest";
import { computeDailyAllowance } from "./daily-allowance";
import { buildReminderBody, DEFAULT_REMINDER_BODY } from "./reminder-text";
import { formatBRL } from "@/lib/money";

const allowance = (spentTodayCents: number, committedCents = 105000) =>
  computeDailyAllowance({
    wantsLimitCents: 150000, committedCents, spentTodayCents, today: "2026-10-21",
  });

describe("buildReminderBody", () => {
  it("o texto padrão é o da spec", () => {
    expect(DEFAULT_REMINDER_BODY).toBe("Gastou algo hoje? Leva 5 segundos para registrar.");
  });

  it("opção desativada: texto padrão, mesmo com saldo", () => {
    expect(buildReminderBody(allowance(0), false)).toBe(DEFAULT_REMINDER_BODY);
  });

  it("ok: mostra o que resta hoje, formatado com formatBRL", () => {
    // 4090 − 1390 = 2700
    const body = buildReminderBody(allowance(1390), true);
    expect(body).toBe(`Você ainda tem ${formatBRL(2700)} de lazer hoje. Gastou algo?`);
    expect(body.replace(/\s/g, " ")).toBe("Você ainda tem R$ 27,00 de lazer hoje. Gastou algo?");
  });

  it("ok sem gasto hoje: mostra o valor inteiro do dia", () => {
    expect(buildReminderBody(allowance(0), true)).toBe(
      `Você ainda tem ${formatBRL(4090)} de lazer hoje. Gastou algo?`
    );
  });

  it("over_today: texto padrão", () => {
    const a = allowance(9000);
    expect(a.status).toBe("over_today");
    expect(buildReminderBody(a, true)).toBe(DEFAULT_REMINDER_BODY);
  });

  it("bucket_exhausted: texto padrão", () => {
    const a = allowance(0, 150000);
    expect(a.status).toBe("bucket_exhausted");
    expect(buildReminderBody(a, true)).toBe(DEFAULT_REMINDER_BODY);
  });

  it("sem ciclo (null): texto padrão", () => {
    expect(buildReminderBody(null, true)).toBe(DEFAULT_REMINDER_BODY);
    expect(buildReminderBody(null, false)).toBe(DEFAULT_REMINDER_BODY);
  });

  it("nada sobrando hoje (resta zero): texto padrão, sem 'R$ 0,00'", () => {
    const a = allowance(4090);
    expect(a.status).toBe("ok");
    expect(buildReminderBody(a, true)).toBe(DEFAULT_REMINDER_BODY);
  });
});
