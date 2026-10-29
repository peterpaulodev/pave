import { describe, expect, it } from "vitest";
import { previewImpact, type EntryImpactContext } from "./entry-impact";

const TODAY = "2026-10-21";
const context: EntryImpactContext = {
  today: TODAY,
  availableCents: { needs: 90000, wants: 50000 },
  savedCents: 20000,
  remainingTodayCents: 2700,
};
const draft = (over: Partial<Parameters<typeof previewImpact>[1]>) => ({
  amountCents: 1500,
  bucket: "wants" as const,
  date: TODAY,
  ...over,
});
// Intl usa NBSP entre "R$" e o valor; normaliza para comparar com a spec.
const text = (d: Parameters<typeof previewImpact>[1], c = context) =>
  previewImpact(c, d).text.replace(/\s/g, " ");

describe("previewImpact", () => {
  describe("exemplos da spec", () => {
    it("Lazer hoje: resta R$ 27,00 → R$ 12,00", () => {
      expect(text(draft({ amountCents: 1500 }))).toBe("Lazer hoje: resta R$ 27,00 → R$ 12,00");
    });
    it("Necessidades no mês: R$ 900,00 → R$ 780,00 disponível", () => {
      expect(text(draft({ bucket: "needs", amountCents: 12000 }))).toBe(
        "Necessidades no mês: R$ 900,00 → R$ 780,00 disponível"
      );
    });
  });

  it("Lazer com data anterior usa o disponível do mês", () => {
    expect(text(draft({ date: "2026-10-20", amountCents: 1500 }))).toBe(
      "Lazer no mês: R$ 500,00 → R$ 485,00"
    );
  });

  it("Investimentos: Guardado no mês", () => {
    expect(text(draft({ bucket: "savings", amountCents: 5000 }))).toBe(
      "Guardado no mês: R$ 200,00 → R$ 250,00"
    );
  });

  it("Investimentos nunca fica 'acima do planejado'", () => {
    const r = previewImpact({ ...context, savedCents: 0 }, draft({ bucket: "savings", amountCents: 999999 }));
    expect(r.over).toBe(false);
    expect(r.text).not.toContain("acima");
  });

  describe("resultado negativo", () => {
    it("Lazer hoje acima: 'R$ X acima do planejado'", () => {
      const r = previewImpact(context, draft({ amountCents: 4000 }));
      expect(r.text.replace(/\s/g, " ")).toBe("Lazer hoje: R$ 13,00 acima do planejado");
      expect(r.over).toBe(true);
    });
    it("Necessidades acima", () => {
      const r = previewImpact(context, draft({ bucket: "needs", amountCents: 100000 }));
      expect(r.text.replace(/\s/g, " ")).toBe("Necessidades no mês: R$ 100,00 acima do planejado");
      expect(r.over).toBe(true);
    });
    it("Lazer no mês acima", () => {
      const r = previewImpact(context, draft({ date: "2026-10-01", amountCents: 50001 }));
      expect(r.text.replace(/\s/g, " ")).toBe("Lazer no mês: R$ 0,01 acima do planejado");
    });
    it("já estava negativo antes do gasto: continua informando o quanto passa", () => {
      const r = previewImpact({ ...context, remainingTodayCents: -500 }, draft({ amountCents: 1000 }));
      expect(r.text.replace(/\s/g, " ")).toBe("Lazer hoje: R$ 15,00 acima do planejado");
    });
    it("zerar exato não é 'acima'", () => {
      const r = previewImpact(context, draft({ amountCents: 2700 }));
      expect(r.text.replace(/\s/g, " ")).toBe("Lazer hoje: resta R$ 27,00 → R$ 0,00");
      expect(r.over).toBe(false);
    });
    it("tom neutro: nada de 'estourou' ou 'negativo'", () => {
      const r = previewImpact(context, draft({ amountCents: 999999 }));
      expect(r.text).not.toMatch(/estour|negativ|-\s?R\$/i);
    });
  });

  describe("valor zero", () => {
    it("Lazer hoje: estado atual sem seta", () => {
      const r = previewImpact(context, draft({ amountCents: 0 }));
      expect(r.text.replace(/\s/g, " ")).toBe("Lazer hoje: resta R$ 27,00");
      expect(r.text).not.toContain("→");
    });
    it("Lazer no mês, Necessidades e Guardado", () => {
      expect(text(draft({ amountCents: 0, date: "2026-10-02" }))).toBe("Lazer no mês: R$ 500,00");
      expect(text(draft({ amountCents: 0, bucket: "needs" }))).toBe("Necessidades no mês: R$ 900,00 disponível");
      expect(text(draft({ amountCents: 0, bucket: "savings" }))).toBe("Guardado no mês: R$ 200,00");
    });
    it("estado atual já negativo, sem seta", () => {
      const r = previewImpact({ ...context, remainingTodayCents: -500 }, draft({ amountCents: 0 }));
      expect(r.text.replace(/\s/g, " ")).toBe("Lazer hoje: R$ 5,00 acima do planejado");
      expect(r.over).toBe(true);
    });
  });

  it("não depende do balde Lazer para Necessidades com data antiga", () => {
    expect(text(draft({ bucket: "needs", date: "2026-10-03", amountCents: 12000 }))).toBe(
      "Necessidades no mês: R$ 900,00 → R$ 780,00 disponível"
    );
  });
});
