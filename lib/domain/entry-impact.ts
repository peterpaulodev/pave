import type { Bucket } from "./buckets";
import { formatBRL } from "@/lib/money";

/** What the screen knows when it opens (loaded on the server, design.md D5). */
export interface EntryImpactContext {
  /** The user's local date, "YYYY-MM-DD". */
  today: string;
  /** Limit minus spent in the current cycle, for the buckets that have a cap. */
  availableCents: Record<"needs" | "wants", number>;
  /** Already put away in Investimentos this cycle. */
  savedCents: number;
  /** Today's leisure allowance left (can be negative); see `DailyAllowance`. */
  remainingTodayCents: number;
}

export interface EntryImpactDraft {
  amountCents: number;
  bucket: Bucket;
  /** "YYYY-MM-DD" */
  date: string;
}

export interface EntryImpact {
  text: string;
  /** The expense goes past what was planned (always `false` for Investimentos). */
  over: boolean;
}

const brl = (cents: number) => formatBRL(cents);
const above = (cents: number) => `${brl(-cents)} acima do planejado`;

/**
 * Effect of the draft on the selected bucket (design.md D5). Pure and run on
 * every key press, so it never asks the server for anything. Past a cap the
 * text states how far over, in a neutral tone.
 */
export function previewImpact(
  context: EntryImpactContext,
  draft: EntryImpactDraft
): EntryImpact {
  const { amountCents, bucket } = draft;

  if (bucket === "savings") {
    const before = context.savedCents;
    const text = `Guardado no mês: ${
      amountCents === 0 ? brl(before) : `${brl(before)} → ${brl(before + amountCents)}`
    }`;
    return { text, over: false };
  }

  const isToday = bucket === "wants" && draft.date === context.today;
  const label = isToday ? "Lazer hoje" : bucket === "wants" ? "Lazer no mês" : "Necessidades no mês";
  const before = isToday ? context.remainingTodayCents : context.availableCents[bucket];
  const after = before - amountCents;
  // "resta" only reads right for the daily figure; Necessidades closes with "disponível".
  const show = (cents: number) => (isToday ? `resta ${brl(cents)}` : brl(cents));
  const tail = bucket === "needs" ? " disponível" : "";

  if (after < 0) return { text: `${label}: ${above(after)}`, over: true };
  if (amountCents === 0) return { text: `${label}: ${show(before)}${tail}`, over: false };

  const arrowTarget = isToday ? brl(after) : `${brl(after)}${tail}`;
  return { text: `${label}: ${show(before)} → ${arrowTarget}`, over: false };
}
