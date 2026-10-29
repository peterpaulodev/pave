import { describe, expect, it } from "vitest";
import { allowedDateRange, isDateAllowed, isYesterdayAllowed } from "./entry-date";

describe("allowedDateRange", () => {
  it("meio do mês: do dia 1 até hoje", () => {
    expect(allowedDateRange("2026-10-21")).toEqual({ min: "2026-10-01", max: "2026-10-21" });
  });
  it("dia 1: min = max = hoje", () => {
    expect(allowedDateRange("2026-10-01")).toEqual({ min: "2026-10-01", max: "2026-10-01" });
  });
  it("último dia do mês, incluindo fevereiro bissexto", () => {
    expect(allowedDateRange("2026-10-31")).toEqual({ min: "2026-10-01", max: "2026-10-31" });
    expect(allowedDateRange("2028-02-29")).toEqual({ min: "2028-02-01", max: "2028-02-29" });
  });
  it("data de hoje inválida lança erro", () => {
    expect(() => allowedDateRange("2026-13-01")).toThrow();
    expect(() => allowedDateRange("2026-02-30")).toThrow();
    expect(() => allowedDateRange("hoje")).toThrow();
  });
});

describe("isYesterdayAllowed", () => {
  it("dia 1: ontem é do mês anterior", () => {
    expect(isYesterdayAllowed("2026-10-01")).toBe(false);
    expect(isYesterdayAllowed("2026-01-01")).toBe(false);
  });
  it("dia 2 em diante: permitido", () => {
    expect(isYesterdayAllowed("2026-10-02")).toBe(true);
    expect(isYesterdayAllowed("2026-10-21")).toBe(true);
    expect(isYesterdayAllowed("2026-10-31")).toBe(true);
  });
});

describe("isDateAllowed", () => {
  const today = "2026-10-21";
  it("hoje, ontem e o dia 1 são permitidos", () => {
    expect(isDateAllowed("2026-10-21", today)).toBe(true);
    expect(isDateAllowed("2026-10-20", today)).toBe(true);
    expect(isDateAllowed("2026-10-01", today)).toBe(true);
  });
  it("data futura é recusada (amanhã e fim do mês)", () => {
    expect(isDateAllowed("2026-10-22", today)).toBe(false);
    expect(isDateAllowed("2026-10-31", today)).toBe(false);
    expect(isDateAllowed("2026-11-01", today)).toBe(false);
  });
  it("mês anterior é recusado (último dia e mesmo dia do mês)", () => {
    expect(isDateAllowed("2026-09-30", today)).toBe(false);
    expect(isDateAllowed("2025-10-21", today)).toBe(false);
  });
  it("dia 1: só hoje é permitido", () => {
    expect(isDateAllowed("2026-10-01", "2026-10-01")).toBe(true);
    expect(isDateAllowed("2026-09-30", "2026-10-01")).toBe(false);
    expect(isDateAllowed("2026-10-02", "2026-10-01")).toBe(false);
  });
  it("formato inválido ou data impossível é recusado, sem lançar", () => {
    expect(isDateAllowed("", today)).toBe(false);
    expect(isDateAllowed("2026-10-1", today)).toBe(false);
    expect(isDateAllowed("21/10/2026", today)).toBe(false);
    expect(isDateAllowed("2026-02-30", "2026-02-28")).toBe(false);
    expect(isDateAllowed("2026-10-21T00:00:00Z", today)).toBe(false);
  });
});
