import { describe, expect, it } from "vitest";
import { isDuePassed, resolveDueDate } from "./recurring";

describe("resolveDueDate", () => {
  it("mantém o dia quando ele existe no mês", () => {
    expect(resolveDueDate("2026-03", 10)).toBe("2026-03-10");
  });

  it("dia 1 vira o primeiro dia do mês", () => {
    expect(resolveDueDate("2026-03", 1)).toBe("2026-03-01");
  });

  it("dia 31 em mês de 30 dias cai no dia 30", () => {
    expect(resolveDueDate("2026-04", 31)).toBe("2026-04-30");
  });

  it("dia 31 em mês de 31 dias permanece 31", () => {
    expect(resolveDueDate("2026-05", 31)).toBe("2026-05-31");
  });

  it("dia 30 e 31 em fevereiro comum caem no 28", () => {
    expect(resolveDueDate("2027-02", 30)).toBe("2027-02-28");
    expect(resolveDueDate("2027-02", 31)).toBe("2027-02-28");
  });

  it("dia 30 e 31 em fevereiro bissexto caem no 29", () => {
    expect(resolveDueDate("2028-02", 30)).toBe("2028-02-29");
    expect(resolveDueDate("2028-02", 31)).toBe("2028-02-29");
  });

  it("rejeita dia fora de 1..31 e período inválido", () => {
    expect(() => resolveDueDate("2026-03", 0)).toThrow();
    expect(() => resolveDueDate("2026-03", 32)).toThrow();
    expect(() => resolveDueDate("2026-03", 1.5)).toThrow();
    expect(() => resolveDueDate("2026-13", 10)).toThrow();
    expect(() => resolveDueDate("2026/03", 10)).toThrow();
  });
});

describe("isDuePassed", () => {
  it("vencimento anterior a hoje já passou", () => {
    expect(isDuePassed("2026-03-10", "2026-03-11")).toBe(true);
  });

  it("vencimento hoje conta como não passado", () => {
    expect(isDuePassed("2026-03-10", "2026-03-10")).toBe(false);
  });

  it("vencimento futuro não passou", () => {
    expect(isDuePassed("2026-03-10", "2026-03-09")).toBe(false);
  });
});
