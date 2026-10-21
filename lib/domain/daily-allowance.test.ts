import { describe, expect, it } from "vitest";
import { computeDailyAllowance, daysLeftInMonth } from "./daily-allowance";

describe("daysLeftInMonth", () => {
  it("dia 1: o mês inteiro", () => {
    expect(daysLeftInMonth("2026-10-01")).toBe(31);
    expect(daysLeftInMonth("2026-11-01")).toBe(30);
  });

  it("meio do mês conta hoje", () => {
    expect(daysLeftInMonth("2026-10-21")).toBe(11);
    expect(daysLeftInMonth("2026-10-15")).toBe(17);
  });

  it("último dia vale 1 (meses de 30 e 31 dias)", () => {
    expect(daysLeftInMonth("2026-10-31")).toBe(1);
    expect(daysLeftInMonth("2026-11-30")).toBe(1);
  });

  it("fevereiro comum e bissexto", () => {
    expect(daysLeftInMonth("2027-02-01")).toBe(28);
    expect(daysLeftInMonth("2027-02-28")).toBe(1);
    expect(daysLeftInMonth("2028-02-01")).toBe(29);
    expect(daysLeftInMonth("2028-02-28")).toBe(2);
    expect(daysLeftInMonth("2028-02-29")).toBe(1);
  });

  it("rejeita datas inválidas", () => {
    expect(() => daysLeftInMonth("2026-10-32")).toThrow();
    expect(() => daysLeftInMonth("2027-02-29")).toThrow();
    expect(() => daysLeftInMonth("21/10/2026")).toThrow();
    expect(() => daysLeftInMonth("2026-13-01")).toThrow();
  });
});

describe("computeDailyAllowance", () => {
  const base = { wantsLimitCents: 150000, committedCents: 105000, spentTodayCents: 0 };

  it("exemplo da spec: R$ 450,00 ÷ 11 dias = R$ 40,90", () => {
    expect(computeDailyAllowance({ ...base, today: "2026-10-21" })).toEqual({
      allowanceCents: 4090,
      spentTodayCents: 0,
      remainingTodayCents: 4090,
      daysLeft: 11,
      status: "ok",
    });
  });

  it("arredonda para baixo em centavos", () => {
    // 45000 / 11 = 4090,9…
    expect(computeDailyAllowance({ ...base, today: "2026-10-21" }).allowanceCents).toBe(4090);
    // 100 / 3 = 33,3…
    const r = computeDailyAllowance({
      wantsLimitCents: 100, committedCents: 0, spentTodayCents: 0, today: "2026-10-29",
    });
    expect(r.daysLeft).toBe(3);
    expect(r.allowanceCents).toBe(33);
  });

  it("gasto de hoje reduz o que resta, não o valor do dia", () => {
    const r = computeDailyAllowance({ ...base, spentTodayCents: 1500, today: "2026-10-21" });
    expect(r.allowanceCents).toBe(4090);
    expect(r.spentTodayCents).toBe(1500);
    expect(r.remainingTodayCents).toBe(2590);
    expect(r.status).toBe("ok");
  });

  it("gastar exatamente o valor do dia ainda é ok (resta zero)", () => {
    const r = computeDailyAllowance({ ...base, spentTodayCents: 4090, today: "2026-10-21" });
    expect(r.remainingTodayCents).toBe(0);
    expect(r.status).toBe("ok");
  });

  it("passou do valor de hoje: resta negativo e status over_today", () => {
    const r = computeDailyAllowance({
      wantsLimitCents: 46200, committedCents: 0, spentTodayCents: 5000, today: "2026-10-21",
    });
    expect(r.allowanceCents).toBe(4200); // 46200 / 11
    expect(r.remainingTodayCents).toBe(-800);
    expect(r.status).toBe("over_today");
  });

  it("saldo zero: bucket_exhausted", () => {
    const r = computeDailyAllowance({
      wantsLimitCents: 150000, committedCents: 150000, spentTodayCents: 0, today: "2026-10-21",
    });
    expect(r).toMatchObject({ allowanceCents: 0, remainingTodayCents: 0, status: "bucket_exhausted" });
  });

  it("saldo negativo: bucket_exhausted com valor zero (nunca negativo)", () => {
    const r = computeDailyAllowance({
      wantsLimitCents: 150000, committedCents: 170000, spentTodayCents: 0, today: "2026-10-21",
    });
    expect(r.allowanceCents).toBe(0);
    expect(r.status).toBe("bucket_exhausted");
  });

  it("esgotado + gasto hoje: continua bucket_exhausted, não over_today", () => {
    const r = computeDailyAllowance({
      wantsLimitCents: 150000, committedCents: 150000, spentTodayCents: 2000, today: "2026-10-21",
    });
    expect(r.remainingTodayCents).toBe(-2000);
    expect(r.status).toBe("bucket_exhausted");
  });

  it("último dia do mês: todo o saldo restante", () => {
    const r = computeDailyAllowance({
      wantsLimitCents: 150000, committedCents: 140000, spentTodayCents: 0, today: "2026-10-31",
    });
    expect(r).toMatchObject({ daysLeft: 1, allowanceCents: 10000, remainingTodayCents: 10000, status: "ok" });
  });

  it("saldo menor que os dias restantes: valor 0 sem estar esgotado", () => {
    const r = computeDailyAllowance({
      wantsLimitCents: 10, committedCents: 0, spentTodayCents: 0, today: "2026-10-01",
    });
    expect(r.allowanceCents).toBe(0);
    expect(r.status).toBe("ok");
  });
});
