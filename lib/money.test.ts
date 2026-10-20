import { describe, expect, it } from "vitest";
import { formatBRL, parseBRL } from "./money";

describe("parseBRL", () => {
  it.each([
    ["5000", 500000],
    ["5.000", 500000],
    ["5000,50", 500050],
    ["5.000,50", 500050],
  ])("parses %s as %i centavos", (input, expectedCents) => {
    expect(parseBRL(input)).toBe(expectedCents);
  });

  it("retorna null para string vazia", () => {
    expect(parseBRL("")).toBeNull();
    expect(parseBRL("   ")).toBeNull();
  });

  it("aceita zero", () => {
    expect(parseBRL("0")).toBe(0);
  });

  it("rejeita valores negativos", () => {
    expect(parseBRL("-50")).toBeNull();
  });

  it("rejeita entrada inválida", () => {
    expect(parseBRL("abc")).toBeNull();
  });
});

describe("formatBRL", () => {
  it("formata centavos como moeda BRL", () => {
    expect(formatBRL(500000)).toBe("R$ 5.000,00");
  });

  it("formata zero", () => {
    expect(formatBRL(0)).toBe("R$ 0,00");
  });
});
