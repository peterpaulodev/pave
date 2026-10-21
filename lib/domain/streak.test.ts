import { describe, expect, it } from "vitest";
import { computeStreak } from "./streak";

describe("computeStreak", () => {
  it("conta a sequência que termina hoje", () => {
    const dates = ["2026-03-06", "2026-03-07", "2026-03-08", "2026-03-09", "2026-03-10"];
    expect(computeStreak(dates, "2026-03-10")).toBe(5);
  });

  it("sem registro hoje, a sequência termina ontem", () => {
    const dates = ["2026-03-06", "2026-03-07", "2026-03-08", "2026-03-09"];
    expect(computeStreak(dates, "2026-03-10")).toBe(4);
  });

  it("quebrada ontem (sem hoje nem ontem) → 0", () => {
    expect(computeStreak(["2026-03-07", "2026-03-08"], "2026-03-10")).toBe(0);
  });

  it("só conta a sequência contígua mais recente", () => {
    const dates = ["2026-03-01", "2026-03-02", "2026-03-08", "2026-03-09", "2026-03-10"];
    expect(computeStreak(dates, "2026-03-10")).toBe(3);
  });

  it("ignora datas duplicadas e fora de ordem", () => {
    const dates = ["2026-03-10", "2026-03-09", "2026-03-10", "2026-03-08", "2026-03-09"];
    expect(computeStreak(dates, "2026-03-10")).toBe(3);
  });

  it("lista vazia → 0", () => {
    expect(computeStreak([], "2026-03-10")).toBe(0);
  });

  it("atravessa virada de mês e de ano", () => {
    expect(computeStreak(["2026-02-27", "2026-02-28", "2026-03-01"], "2026-03-01")).toBe(3);
    expect(computeStreak(["2025-12-31", "2026-01-01"], "2026-01-01")).toBe(2);
  });

  it("ignora datas futuras", () => {
    expect(computeStreak(["2026-03-11", "2026-03-10"], "2026-03-10")).toBe(1);
  });
});
