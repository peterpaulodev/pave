import { afterEach, describe, expect, it, vi } from "vitest";
import { currentPeriod, todayInTimezone } from "./period";

describe("currentPeriod", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("usa o mês em UTC quando o fuso é UTC", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T02:00:00Z"));
    expect(currentPeriod("UTC")).toBe("2026-01");
  });

  it("ainda está no mês anterior em America/Sao_Paulo quando UTC já virou o mês", () => {
    vi.useFakeTimers();
    // 2026-01-01T02:00:00Z é 2025-12-31T23:00:00 em América/São Paulo (UTC-3)
    vi.setSystemTime(new Date("2026-01-01T02:00:00Z"));
    expect(currentPeriod("America/Sao_Paulo")).toBe("2025-12");
  });

  it("os dois fusos concordam fora de uma virada de mês", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00Z"));
    expect(currentPeriod("UTC")).toBe("2026-03");
    expect(currentPeriod("America/Sao_Paulo")).toBe("2026-03");
  });
});

describe("todayInTimezone", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("usa o dia em UTC quando o fuso é UTC", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T02:00:00Z"));
    expect(todayInTimezone("UTC")).toBe("2026-01-01");
  });

  it("ainda está no dia anterior em America/Sao_Paulo quando UTC já virou o dia", () => {
    vi.useFakeTimers();
    // 2026-01-01T02:00:00Z é 2025-12-31T23:00:00 em América/São Paulo (UTC-3)
    vi.setSystemTime(new Date("2026-01-01T02:00:00Z"));
    expect(todayInTimezone("America/Sao_Paulo")).toBe("2025-12-31");
  });
});
