import { afterEach, describe, expect, it, vi } from "vitest";
import { currentPeriod, daysInPeriod, periodLabel, previousPeriod, todayInTimezone } from "./period";

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

describe("previousPeriod", () => {
  it("volta um mês dentro do mesmo ano", () => {
    expect(previousPeriod("2026-11")).toBe("2026-10");
    expect(previousPeriod("2026-02")).toBe("2026-01");
  });

  it("de janeiro vai para dezembro do ano anterior", () => {
    expect(previousPeriod("2026-01")).toBe("2025-12");
  });

  it("rejeita período inválido", () => {
    expect(() => previousPeriod("2026-13")).toThrow();
    expect(() => previousPeriod("2026-1")).toThrow();
  });
});

describe("periodLabel", () => {
  it("devolve o nome do mês em português, em minúsculas", () => {
    expect(periodLabel("2026-10")).toBe("outubro");
    expect(periodLabel("2026-01")).toBe("janeiro");
    expect(periodLabel("2026-03")).toBe("março");
  });

  it("não depende do fuso do processo", () => {
    const original = process.env.TZ;
    process.env.TZ = "Pacific/Kiritimati";
    try {
      expect(periodLabel("2026-12")).toBe("dezembro");
    } finally {
      process.env.TZ = original;
    }
  });

  it("rejeita período inválido", () => {
    expect(() => periodLabel("2026-00")).toThrow();
  });
});

describe("daysInPeriod", () => {
  it("dias de cada tipo de mês", () => {
    expect(daysInPeriod("2026-10")).toBe(31);
    expect(daysInPeriod("2026-11")).toBe(30);
    expect(daysInPeriod("2026-02")).toBe(28);
    expect(daysInPeriod("2028-02")).toBe(29);
  });
});
