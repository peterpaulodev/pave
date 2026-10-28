import { describe, expect, it } from "vitest";
import { formatBRL } from "@/lib/money";
import { buildMonthlySummary, type MonthlySummaryInput } from "./monthly-summary";

const OCT = "2026-10";

function days(count: number, from = 1, period = OCT): string[] {
  return Array.from({ length: count }, (_, i) => `${period}-${String(from + i).padStart(2, "0")}`);
}

/**
 * A month where only the default highlight applies: Necessidades and Lazer
 * over the limit, savings below the goal, 5 of 31 days, cycle started on
 * day 1. Each test overrides only what its rule needs.
 */
function input(overrides: Partial<MonthlySummaryInput> = {}): MonthlySummaryInput {
  return {
    period: OCT,
    limits: { needs: 100000, wants: 60000, savings: 40000 },
    spent: { needs: 120000, wants: 70000, savings: 10000 },
    fixed: { needs: 0, wants: 0, savings: 0 },
    wantsExpenses: [],
    registeredDates: days(5),
    cycleStartDate: `${OCT}-01`,
    ...overrides,
  };
}

const WITHIN = { needs: 90000, wants: 50000, savings: 40000 };

describe("buildMonthlySummary — baldes", () => {
  it("balde abaixo do limite: diffCents positivo", () => {
    const s = buildMonthlySummary(
      input({ limits: { needs: 100000, wants: 150000, savings: 40000 }, spent: { needs: 100000, wants: 138000, savings: 0 } })
    );
    expect(s.buckets.wants).toEqual({ limitCents: 150000, spentCents: 138000, diffCents: 12000 });
  });

  it("balde acima do limite: diffCents negativo", () => {
    const s = buildMonthlySummary(input({ spent: { needs: 120000, wants: 0, savings: 0 } }));
    expect(s.buckets.needs).toEqual({ limitCents: 100000, spentCents: 120000, diffCents: -20000 });
  });

  it("gasto exatamente no limite: diffCents zero", () => {
    const s = buildMonthlySummary(input({ spent: { needs: 100000, wants: 0, savings: 0 } }));
    expect(s.buckets.needs.diffCents).toBe(0);
  });

  it("Investimentos: guardado frente à meta", () => {
    const s = buildMonthlySummary(
      input({ limits: { needs: 0, wants: 0, savings: 100000 }, spent: { needs: 0, wants: 0, savings: 60000 } })
    );
    expect(s.savings).toEqual({ savedCents: 60000, goalCents: 100000 });
  });

  it("Contas fixas: total do mês e quanto ocuparam de Necessidades", () => {
    const s = buildMonthlySummary(input({ fixed: { needs: 150000, wants: 12000, savings: 8000 } }));
    expect(s.fixed).toEqual({ totalCents: 170000, needsCents: 150000 });
  });
});

describe("buildMonthlySummary — destaque", () => {
  it("all_within: baldes dentro do limite e meta de guardar atingida", () => {
    const s = buildMonthlySummary(input({ spent: WITHIN }));
    expect(s.highlight).toEqual({
      kind: "all_within",
      text: "Mês fechado no azul: todos os baldes dentro do planejado.",
    });
  });

  it("all_within não se aplica se Lazer estourou (cai em saved_goal)", () => {
    const s = buildMonthlySummary(input({ spent: { ...WITHIN, wants: 60001 } }));
    expect(s.highlight.kind).toBe("saved_goal");
  });

  it("saved_goal: meta atingida com Necessidades estourada", () => {
    const s = buildMonthlySummary(input({ spent: { needs: 120000, wants: 70000, savings: 40000 } }));
    expect(s.highlight).toEqual({
      kind: "saved_goal",
      text: "Você bateu a meta de guardar 20%.",
    });
  });

  it("wants_within: Lazer coube, com a folga no texto", () => {
    const s = buildMonthlySummary(input({ spent: { needs: 120000, wants: 48000, savings: 10000 } }));
    expect(s.highlight).toEqual({
      kind: "wants_within",
      text: `Seu lazer coube no planejado, com ${formatBRL(12000)} de folga.`,
    });
  });

  it("wants_within vale com folga zero (gasto exatamente no limite)", () => {
    const s = buildMonthlySummary(input({ spent: { needs: 120000, wants: 60000, savings: 10000 } }));
    expect(s.highlight.kind).toBe("wants_within");
  });

  it("consistent: 25 de 31 dias, com os baldes estourados (exemplo da spec)", () => {
    const s = buildMonthlySummary(input({ registeredDates: days(25) }));
    expect(s.registeredDays).toBe(25);
    expect(s.trackedDays).toBe(31);
    expect(s.highlight).toEqual({
      kind: "consistent",
      text: "Você registrou em 25 dos 31 dias. É assim que o controle funciona.",
    });
  });

  it("consistent: o limiar de 70% é inclusivo (21 de 30)", () => {
    const s = buildMonthlySummary(
      input({ period: "2026-11", cycleStartDate: "2026-11-01", registeredDates: days(21, 1, "2026-11") })
    );
    expect(s.highlight.kind).toBe("consistent");
  });

  it("logo abaixo de 70% não é consistent (20 de 30)", () => {
    const s = buildMonthlySummary(
      input({ period: "2026-11", cycleStartDate: "2026-11-01", registeredDates: days(20, 1, "2026-11") })
    );
    expect(s.highlight.kind).toBe("default");
  });

  it("first_month: ciclo começou no dia 15 e nada antes se aplica (exemplo da spec)", () => {
    const s = buildMonthlySummary(input({ cycleStartDate: `${OCT}-15`, registeredDates: days(3, 15) }));
    expect(s.highlight).toEqual({
      kind: "first_month",
      text: "Primeiro mês concluído. Agora você sabe para onde vai seu dinheiro.",
    });
  });

  it("default: nenhuma regra anterior", () => {
    const s = buildMonthlySummary(input());
    expect(s.highlight).toEqual({
      kind: "default",
      text: "Mês fechado. Cada mês registrado deixa o próximo mais fácil.",
    });
  });
});

describe("buildMonthlySummary — prioridade quando duas regras se aplicam", () => {
  it("all_within vence saved_goal (ambas verdadeiras)", () => {
    const s = buildMonthlySummary(input({ spent: WITHIN }));
    expect(s.savings.savedCents).toBeGreaterThanOrEqual(s.savings.goalCents); // saved_goal também vale
    expect(s.highlight.kind).toBe("all_within");
  });

  it("saved_goal vence wants_within (ambas verdadeiras)", () => {
    const s = buildMonthlySummary(input({ spent: { needs: 120000, wants: 48000, savings: 40000 } }));
    expect(s.buckets.wants.diffCents).toBeGreaterThanOrEqual(0); // wants_within também vale
    expect(s.highlight.kind).toBe("saved_goal");
  });

  it("wants_within vence consistent (ambas verdadeiras)", () => {
    const s = buildMonthlySummary(
      input({ spent: { needs: 120000, wants: 48000, savings: 10000 }, registeredDates: days(28) })
    );
    expect(s.registeredDays / s.trackedDays).toBeGreaterThanOrEqual(0.7); // consistent também vale
    expect(s.highlight.kind).toBe("wants_within");
  });

  it("consistent vence first_month (ambas verdadeiras)", () => {
    const s = buildMonthlySummary(input({ cycleStartDate: `${OCT}-15`, registeredDates: days(15, 15) }));
    expect(s.startedOnDay).toBe(15); // first_month também vale
    expect(s.highlight.kind).toBe("consistent");
  });

  it("first_month vence default (ambas verdadeiras)", () => {
    const s = buildMonthlySummary(input({ cycleStartDate: `${OCT}-02` }));
    expect(s.highlight.kind).toBe("first_month");
  });
});

describe("buildMonthlySummary — dias registrados e mês incompleto", () => {
  it("mês completo: 22 dos 31 dias", () => {
    const s = buildMonthlySummary(input({ registeredDates: days(22) }));
    expect(s.registeredDays).toBe(22);
    expect(s.trackedDays).toBe(31);
    expect(s.startedOnDay).toBeNull();
  });

  it("início no dia 15: 17 dias considerados e startedOnDay 15", () => {
    const s = buildMonthlySummary(input({ cycleStartDate: `${OCT}-15`, registeredDates: days(4, 15) }));
    expect(s.trackedDays).toBe(17);
    expect(s.startedOnDay).toBe(15);
    expect(s.registeredDays).toBe(4);
  });

  it("datas repetidas contam uma vez; datas fora do período ou antes do início são ignoradas", () => {
    const s = buildMonthlySummary(
      input({
        cycleStartDate: `${OCT}-15`,
        registeredDates: [`${OCT}-15`, `${OCT}-15`, `${OCT}-10`, "2026-09-20", "2026-11-02"],
      })
    );
    expect(s.registeredDays).toBe(1);
  });

  it("ciclo criado fora do mês é limitado ao mês", () => {
    expect(buildMonthlySummary(input({ cycleStartDate: "2026-09-28" })).trackedDays).toBe(31);
    expect(buildMonthlySummary(input({ cycleStartDate: "2026-11-03" })).trackedDays).toBe(1);
  });

  it("fevereiro bissexto tem 29 dias", () => {
    const s = buildMonthlySummary(
      input({ period: "2028-02", cycleStartDate: "2028-02-01", registeredDates: ["2028-02-29"] })
    );
    expect(s.trackedDays).toBe(29);
    expect(s.registeredDays).toBe(1);
  });
});

describe("buildMonthlySummary — destinos do Lazer", () => {
  const spec = [
    { description: "iFood 45", amountCents: 4500 },
    { description: "ifood 30", amountCents: 3000 },
    { description: "Cinema 60", amountCents: 6000 },
    { description: "IFOOD 25", amountCents: 2500 },
  ];

  it("agrupa descrições equivalentes: iFood R$ 100,00 antes de Cinema R$ 60,00", () => {
    const s = buildMonthlySummary(input({ wantsExpenses: spec }));
    expect(s.wantsDestinations).toEqual([
      { name: "iFood", totalCents: 10000 },
      { name: "Cinema", totalCents: 6000 },
    ]);
  });

  it("o nome exibido é a descrição mais frequente do grupo", () => {
    const s = buildMonthlySummary(
      input({
        wantsExpenses: [
          { description: "Ifood", amountCents: 1000 },
          { description: "iFood", amountCents: 1000 },
          { description: "iFood", amountCents: 1000 },
        ],
      })
    );
    expect(s.wantsDestinations[0].name).toBe("iFood");
  });

  it("ignora acentos, números e espaços extras ao agrupar", () => {
    const s = buildMonthlySummary(
      input({
        wantsExpenses: [
          { description: "Café  da  esquina", amountCents: 1000 },
          { description: "cafe da esquina 12", amountCents: 500 },
        ],
      })
    );
    expect(s.wantsDestinations).toHaveLength(1);
    expect(s.wantsDestinations[0].totalCents).toBe(1500);
  });

  it("limita a 3 destinos, por soma decrescente", () => {
    const s = buildMonthlySummary(
      input({
        wantsExpenses: [
          { description: "a", amountCents: 100 },
          { description: "b", amountCents: 400 },
          { description: "c", amountCents: 300 },
          { description: "d", amountCents: 200 },
        ],
      })
    );
    expect(s.wantsDestinations.map((d) => d.name)).toEqual(["b", "c", "d"]);
  });

  it("menos de 2 gastos de Lazer: seção omitida", () => {
    expect(buildMonthlySummary(input({ wantsExpenses: [] })).wantsDestinations).toEqual([]);
    expect(buildMonthlySummary(input({ wantsExpenses: [spec[0]] })).wantsDestinations).toEqual([]);
  });

  it("descrição só com números não some do agrupamento", () => {
    const s = buildMonthlySummary(
      input({
        wantsExpenses: [
          { description: "123", amountCents: 100 },
          { description: "123", amountCents: 100 },
        ],
      })
    );
    expect(s.wantsDestinations).toEqual([{ name: "123", totalCents: 200 }]);
  });
});
