import { describe, expect, it } from "vitest";
import { parseQuickEntry } from "./parse-quick-entry";

describe("parseQuickEntry", () => {
  it("aceita valor depois da descrição", () => {
    expect(parseQuickEntry("mercado 120")).toEqual({
      description: "mercado",
      amountCents: 12000,
    });
  });

  it("aceita valor antes da descrição", () => {
    expect(parseQuickEntry("120 mercado")).toEqual({
      description: "mercado",
      amountCents: 12000,
    });
  });

  it("aceita decimal com vírgula", () => {
    expect(parseQuickEntry("uber 23,50")).toEqual({
      description: "uber",
      amountCents: 2350,
    });
  });

  it("aceita decimal com ponto", () => {
    expect(parseQuickEntry("uber 23.50")).toEqual({
      description: "uber",
      amountCents: 2350,
    });
  });

  it("retorna null sem valor", () => {
    expect(parseQuickEntry("apenas texto")).toBeNull();
  });

  it("retorna null sem descrição", () => {
    expect(parseQuickEntry("120")).toBeNull();
  });
});
