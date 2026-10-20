import { describe, expect, it } from "vitest";
import { splitIncome } from "./buckets";

describe("splitIncome", () => {
  it("divide R$ 5.000,00 em 50/30/20 exatos", () => {
    expect(splitIncome(500000)).toEqual({
      needs: 250000,
      wants: 150000,
      savings: 100000,
    });
  });

  it("a soma dos baldes sempre bate com a renda, mesmo com arredondamento", () => {
    const split = splitIncome(123457); // R$ 1.234,57
    expect(split.needs + split.wants + split.savings).toBe(123457);
  });
});
