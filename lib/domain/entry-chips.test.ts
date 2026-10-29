import { describe, expect, it } from "vitest";
import {
  STARTER_CHIPS,
  buildEntryChips,
  groupFrequentDescriptions,
  type DescriptionStat,
  type FrequentDescription,
} from "./entry-chips";

let seq = 0;
/** One (description, bucket) group as the SQL aggregate returns it. */
function stat(
  description: string,
  count: number,
  over: Partial<Omit<DescriptionStat, "description" | "count">> = {}
): DescriptionStat {
  seq += 1;
  return {
    description,
    bucket: "needs",
    count,
    lastOccurredOn: "2026-10-10",
    lastCreatedAt: 1_000_000 + seq,
    ...over,
  };
}
const labels = (rows: { label: string }[]) => rows.map((r) => r.label);

describe("groupFrequentDescriptions", () => {
  it("ordena por quantidade: Mercado 8, iFood 5, Uber 3 (exemplo da spec)", () => {
    const rows = [
      stat("Uber", 3, { bucket: "needs" }),
      stat("iFood", 5, { bucket: "wants" }),
      stat("Mercado", 8, { bucket: "needs" }),
    ];
    expect(groupFrequentDescriptions(rows, 6)).toEqual([
      { label: "Mercado", bucket: "needs" },
      { label: "iFood", bucket: "wants" },
      { label: "Uber", bucket: "needs" },
    ]);
  });

  describe("descrições equivalentes", () => {
    it("'ifood 30', 'iFood' e 'IFOOD' formam um único chip rotulado 'iFood' (exemplo da spec)", () => {
      const rows = [
        stat("ifood 30", 1, { lastOccurredOn: "2026-10-01" }),
        stat("IFOOD", 1, { lastOccurredOn: "2026-10-02" }),
        stat("iFood", 1, { lastOccurredOn: "2026-10-03" }),
      ];
      expect(groupFrequentDescriptions(rows, 6)).toEqual([{ label: "iFood", bucket: "needs" }]);
    });

    it("o rótulo é a grafia mais frequente, sem números", () => {
      const rows = [stat("iFood", 1), stat("IFOOD", 3), stat("ifood 45,90", 2)];
      expect(labels(groupFrequentDescriptions(rows, 6))).toEqual(["IFOOD"]);
    });

    it("a mesma grafia em dois baldes soma as contagens ao escolher o rótulo", () => {
      const rows = [
        stat("IFOOD", 1, { bucket: "needs", lastOccurredOn: "2026-10-01" }),
        stat("IFOOD", 1, { bucket: "wants", lastOccurredOn: "2026-10-02" }),
        stat("iFood", 1, { lastOccurredOn: "2026-10-05" }),
      ];
      expect(groupFrequentDescriptions(rows, 6)).toEqual([{ label: "IFOOD", bucket: "needs" }]);
    });

    it("a contagem do grupo soma todas as grafias (não só a maior)", () => {
      const rows = [
        stat("Uber", 4),
        stat("Padaria", 3),
        stat("padaria 5", 2), // Padaria: 5 no total, passa Uber
      ];
      expect(labels(groupFrequentDescriptions(rows, 6))).toEqual(["Padaria", "Uber"]);
    });

    it("ignora acentos e caixa: 'Farmácia' e 'farmacia'", () => {
      const rows = [
        stat("farmacia", 1, { lastOccurredOn: "2026-10-01" }),
        stat("Farmácia", 1, { lastOccurredOn: "2026-10-05" }),
      ];
      expect(labels(groupFrequentDescriptions(rows, 6))).toEqual(["Farmácia"]);
    });

    it("descrição só de números não some", () => {
      expect(labels(groupFrequentDescriptions([stat("123", 2)], 6))).toEqual(["123"]);
    });
  });

  describe("balde = o do gasto mais recente do grupo", () => {
    it("pela data do gasto", () => {
      const rows = [
        stat("iFood", 9, { bucket: "needs", lastOccurredOn: "2026-09-01" }),
        stat("iFood", 1, { bucket: "wants", lastOccurredOn: "2026-10-15" }),
      ];
      expect(groupFrequentDescriptions(rows, 6)).toEqual([{ label: "iFood", bucket: "wants" }]);
    });

    it("no empate de data, pelo lançamento mais novo", () => {
      const rows = [
        stat("iFood", 1, { bucket: "needs", lastOccurredOn: "2026-10-15", lastCreatedAt: 200 }),
        stat("iFood", 1, { bucket: "wants", lastOccurredOn: "2026-10-15", lastCreatedAt: 100 }),
      ];
      expect(groupFrequentDescriptions(rows, 6)[0].bucket).toBe("needs");
    });
  });

  describe("desempate por recência", () => {
    it("mesma quantidade: o mais recente vem primeiro", () => {
      const rows = [
        stat("Antigo", 2, { lastOccurredOn: "2026-09-01" }),
        stat("Novo", 2, { lastOccurredOn: "2026-10-20" }),
      ];
      expect(labels(groupFrequentDescriptions(rows, 6))).toEqual(["Novo", "Antigo"]);
    });

    it("mesma data: o lançamento mais novo vem primeiro", () => {
      const rows = [
        stat("A", 1, { lastOccurredOn: "2026-10-01", lastCreatedAt: 1 }),
        stat("B", 1, { lastOccurredOn: "2026-10-01", lastCreatedAt: 2 }),
      ];
      expect(labels(groupFrequentDescriptions(rows, 6))).toEqual(["B", "A"]);
    });

    it("grafias empatadas em quantidade: vence a mais recente", () => {
      const rows = [
        stat("IFOOD", 1, { lastOccurredOn: "2026-10-03" }),
        stat("iFood", 1, { lastOccurredOn: "2026-10-01" }),
      ];
      expect(labels(groupFrequentDescriptions(rows, 6))).toEqual(["IFOOD"]);
    });
  });

  it("respeita o limite", () => {
    const rows = ["a", "b", "c", "d"].map((d, i) => stat(d, 10 - i));
    expect(labels(groupFrequentDescriptions(rows, 2))).toEqual(["a", "b"]);
  });

  it("sem histórico, lista vazia", () => {
    expect(groupFrequentDescriptions([], 6)).toEqual([]);
  });
});

describe("STARTER_CHIPS", () => {
  it("são os seis da spec, nessa ordem", () => {
    expect(STARTER_CHIPS).toEqual([
      { label: "Mercado", bucket: "needs" },
      { label: "Transporte", bucket: "needs" },
      { label: "Farmácia", bucket: "needs" },
      { label: "Restaurante", bucket: "wants" },
      { label: "Delivery", bucket: "wants" },
      { label: "Assinaturas", bucket: "wants" },
    ]);
  });
});

describe("buildEntryChips", () => {
  const history = (...ls: string[]): FrequentDescription[] =>
    ls.map((label) => ({ label, bucket: "wants" }));

  it("usuário novo: os seis iniciais, marcados como 'starter'", () => {
    const chips = buildEntryChips([], STARTER_CHIPS, 6);
    expect(labels(chips)).toEqual([
      "Mercado", "Transporte", "Farmácia", "Restaurante", "Delivery", "Assinaturas",
    ]);
    expect(new Set(chips.map((c) => c.source))).toEqual(new Set(["starter"]));
  });

  it("histórico completo (6): nenhum inicial entra", () => {
    const chips = buildEntryChips(history("a", "b", "c", "d", "e", "f"), STARTER_CHIPS, 6);
    expect(labels(chips)).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(chips.every((c) => c.source === "history")).toBe(true);
  });

  it("mais histórico que o limite: corta no limite", () => {
    expect(buildEntryChips(history("a", "b", "c", "d", "e", "f", "g"), STARTER_CHIPS, 6)).toHaveLength(6);
  });

  it("histórico parcial: histórico primeiro, completado com iniciais até o limite", () => {
    const chips = buildEntryChips(history("iFood", "Uber"), STARTER_CHIPS, 6);
    expect(labels(chips)).toEqual(["iFood", "Uber", "Mercado", "Transporte", "Farmácia", "Restaurante"]);
    expect(chips.map((c) => c.source)).toEqual([
      "history", "history", "starter", "starter", "starter", "starter",
    ]);
  });

  it("duplicata entre histórico e inicial é pulada (sem acento e sem caixa)", () => {
    const chips = buildEntryChips(
      [{ label: "mercado", bucket: "wants" }, { label: "FARMACIA", bucket: "needs" }],
      STARTER_CHIPS,
      6
    );
    expect(labels(chips)).toEqual(["mercado", "FARMACIA", "Transporte", "Restaurante", "Delivery", "Assinaturas"]);
    // o chip do histórico mantém o balde do usuário, não o do inicial
    expect(chips[0]).toEqual({ label: "mercado", bucket: "wants", source: "history" });
  });

  it("limite menor que o histórico e limite zero", () => {
    expect(labels(buildEntryChips(history("a", "b", "c"), STARTER_CHIPS, 2))).toEqual(["a", "b"]);
    expect(buildEntryChips(history("a"), STARTER_CHIPS, 0)).toEqual([]);
  });

  it("sem iniciais disponíveis, devolve só o histórico", () => {
    expect(labels(buildEntryChips(history("a"), [], 6))).toEqual(["a"]);
  });
});
