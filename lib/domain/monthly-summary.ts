import { BUCKET_ORDER, type Bucket } from "./buckets";
import { daysInPeriod } from "./period";
import { normalizeText } from "./suggest-bucket";
import { formatBRL } from "@/lib/money";

export interface MonthlySummaryInput {
  /** "YYYY-MM" */
  period: string;
  limits: Record<Bucket, number>;
  /** Everything spent per bucket, recurring bills included. */
  spent: Record<Bucket, number>;
  /** The part of `spent` that came from recurring bills. */
  fixed: Record<Bucket, number>;
  /** Every Lazer (`wants`) expense of the cycle. */
  wantsExpenses: { description: string; amountCents: number }[];
  /** Local dates ("YYYY-MM-DD") with a manual expense or a no-spend check-in. */
  registeredDates: string[];
  /** Local date ("YYYY-MM-DD") the cycle was created on. */
  cycleStartDate: string;
}

export type HighlightKind =
  | "all_within"
  | "saved_goal"
  | "wants_within"
  | "consistent"
  | "first_month"
  | "default";

export interface MonthlySummary {
  buckets: Record<Bucket, { limitCents: number; spentCents: number; diffCents: number }>;
  savings: { savedCents: number; goalCents: number };
  fixed: { totalCents: number; needsCents: number };
  /** Top 3 Lazer destinations; empty when the section is omitted. */
  wantsDestinations: { name: string; totalCents: number }[];
  registeredDays: number;
  trackedDays: number;
  /** Day of the month the tracking started, or `null` when it was day 1. */
  startedOnDay: number | null;
  highlight: { kind: HighlightKind; text: string };
}

const CONSISTENCY_THRESHOLD = 0.7;
const MIN_WANTS_EXPENSES_FOR_DESTINATIONS = 2;
const MAX_DESTINATIONS = 3;

function day(date: string): number {
  return Number(date.slice(8, 10));
}

/** Description without digits and extra spaces, original case kept. */
function cleanDescription(description: string): string {
  return description.replace(/\d+/g, "").replace(/\s+/g, " ").trim();
}

function groupKey(description: string): string {
  const key = normalizeText(cleanDescription(description));
  // A description made only of digits would collapse to "": keep it distinct.
  return key || normalizeText(description).trim();
}

function topDestinations(
  expenses: MonthlySummaryInput["wantsExpenses"]
): MonthlySummary["wantsDestinations"] {
  if (expenses.length < MIN_WANTS_EXPENSES_FOR_DESTINATIONS) return [];

  const groups = new Map<string, { totalCents: number; names: Map<string, number> }>();
  for (const { description, amountCents } of expenses) {
    const key = groupKey(description);
    const name = cleanDescription(description) || description.trim();
    const group = groups.get(key) ?? { totalCents: 0, names: new Map() };
    group.totalCents += amountCents;
    group.names.set(name, (group.names.get(name) ?? 0) + 1);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .map(([key, group]) => {
      // Most frequent spelling; ties keep the first one seen (Map keeps insertion order).
      let name = "";
      let best = 0;
      for (const [candidate, count] of group.names) {
        if (count > best) {
          name = candidate;
          best = count;
        }
      }
      return { key, name, totalCents: group.totalCents };
    })
    .sort((a, b) => b.totalCents - a.totalCents || a.key.localeCompare(b.key))
    .slice(0, MAX_DESTINATIONS)
    .map(({ name, totalCents }) => ({ name, totalCents }));
}

/**
 * Builds the month-end summary (design.md D3/D4). Pure: periods and dates are
 * "YYYY-MM"/"YYYY-MM-DD" strings, never `Date`s in a time zone.
 */
export function buildMonthlySummary(input: MonthlySummaryInput): MonthlySummary {
  const { period, limits, spent, fixed } = input;

  const buckets = {} as MonthlySummary["buckets"];
  for (const bucket of BUCKET_ORDER) {
    buckets[bucket] = {
      limitCents: limits[bucket],
      spentCents: spent[bucket],
      diffCents: limits[bucket] - spent[bucket],
    };
  }

  const savings = { savedCents: spent.savings, goalCents: limits.savings };

  // Tracking window: from the cycle's creation day (clamped to the month) to its last day.
  const monthStart = `${period}-01`;
  const lastDay = daysInPeriod(period);
  const monthEnd = `${period}-${String(lastDay).padStart(2, "0")}`;
  const windowStart =
    input.cycleStartDate < monthStart
      ? monthStart
      : input.cycleStartDate > monthEnd
        ? monthEnd
        : input.cycleStartDate;
  const trackedDays = lastDay - day(windowStart) + 1;
  const startedOnDay = day(windowStart) > 1 ? day(windowStart) : null;

  const registeredDays = new Set(
    input.registeredDates.filter((date) => date >= windowStart && date <= monthEnd)
  ).size;

  // Investimentos is a goal: saving more than the limit is good, so "within"
  // only applies to Necessidades and Lazer; the goal covers the third bucket.
  const goalReached = savings.savedCents >= savings.goalCents;
  const wantsFolgaCents = buckets.wants.diffCents;

  let highlight: MonthlySummary["highlight"];
  if (buckets.needs.diffCents >= 0 && wantsFolgaCents >= 0 && goalReached) {
    highlight = {
      kind: "all_within",
      text: "Mês fechado no azul: todos os baldes dentro do planejado.",
    };
  } else if (goalReached) {
    highlight = { kind: "saved_goal", text: "Você bateu a meta de guardar 20%." };
  } else if (wantsFolgaCents >= 0) {
    highlight = {
      kind: "wants_within",
      text: `Seu lazer coube no planejado, com ${formatBRL(wantsFolgaCents)} de folga.`,
    };
  } else if (registeredDays / trackedDays >= CONSISTENCY_THRESHOLD) {
    highlight = {
      kind: "consistent",
      text: `Você registrou em ${registeredDays} dos ${trackedDays} dias. É assim que o controle funciona.`,
    };
  } else if (startedOnDay !== null) {
    highlight = {
      kind: "first_month",
      text: "Primeiro mês concluído. Agora você sabe para onde vai seu dinheiro.",
    };
  } else {
    highlight = {
      kind: "default",
      text: "Mês fechado. Cada mês registrado deixa o próximo mais fácil.",
    };
  }

  return {
    buckets,
    savings,
    fixed: {
      totalCents: fixed.needs + fixed.wants + fixed.savings,
      needsCents: fixed.needs,
    },
    wantsDestinations: topDestinations(input.wantsExpenses),
    registeredDays,
    trackedDays,
    startedOnDay,
    highlight,
  };
}

const SUMMARY_LINK_LAST_DAY = 7;

/** Whether the panel offers the "Ver resumo" link: days 1–7 of the month.
 * `today` is the user's local date ("YYYY-MM-DD"). */
export function canShowSummaryLink(today: string): boolean {
  return day(today) <= SUMMARY_LINK_LAST_DAY;
}
