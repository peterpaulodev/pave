import { describe, expect, it } from "vitest";
import { localDate, localHour } from "./local-date";

describe("localDate / localHour", () => {
  it("usa a data local, não a UTC, na virada do dia", () => {
    // 23:30 em São Paulo (UTC-3) = 02:30 UTC do dia seguinte
    const now = new Date("2026-03-11T02:30:00.000Z");
    expect(localDate("America/Sao_Paulo", now)).toBe("2026-03-10");
    expect(localDate("UTC", now)).toBe("2026-03-11");
    expect(localHour("America/Sao_Paulo", now)).toBe(23);
    expect(localHour("UTC", now)).toBe(2);
  });

  it("retorna 0 (não 24) à meia-noite local", () => {
    const now = new Date("2026-03-11T03:00:00.000Z");
    expect(localHour("America/Sao_Paulo", now)).toBe(0);
    expect(localDate("America/Sao_Paulo", now)).toBe("2026-03-11");
  });

  it("cruza a virada de mês pelo fuso", () => {
    const now = new Date("2026-05-01T01:00:00.000Z");
    expect(localDate("America/Sao_Paulo", now)).toBe("2026-04-30");
  });

  it("usa o instante atual por padrão", () => {
    expect(localDate("UTC")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(localHour("UTC")).toBeGreaterThanOrEqual(0);
    expect(localHour("UTC")).toBeLessThanOrEqual(23);
  });
});
