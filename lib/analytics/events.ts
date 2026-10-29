import type { Bucket } from "@/lib/domain/buckets";

/**
 * Every product event and the exact shape of its `props` (design.md D1).
 * `props` MUST NOT carry descriptions, amounts, income or any free text the
 * user typed (D4) — only enums, booleans and small numbers.
 */
export type EventMap = {
  onboarding_completed: Record<string, never>;
  expense_created: {
    source: "quick_entry" | "notification" | "recurring";
    bucket: Bucket;
    suggestedBucket: Bucket | null;
    overridden: boolean; // the user changed the suggested bucket
    // Manual entries only (recurring ones omit all three; refactor-expense-entry D8).
    usedChip?: boolean;
    chipSource?: "history" | "starter" | null;
    durationMs?: number; // screen open → submit, rounded to 100ms, 0–600000
  };
  expense_deleted: { wasRecurring: boolean };
  recurring_created: { bucket: Bucket; alsoThisMonth: boolean };
  reminder_enabled: { hour: number };
  reminder_disabled: Record<string, never>;
  reminder_sent: Record<string, never>;
  no_spend_checkin: { via: "app" | "notification" };
  monthly_summary_viewed: { auto: boolean };
};

export type EventName = keyof EventMap;

// `satisfies` makes this list exhaustive: adding an event to EventMap without
// listing it here is a type error.
const EVENT_NAME_SET = {
  onboarding_completed: true,
  expense_created: true,
  expense_deleted: true,
  recurring_created: true,
  reminder_enabled: true,
  reminder_disabled: true,
  reminder_sent: true,
  no_spend_checkin: true,
  monthly_summary_viewed: true,
} satisfies Record<EventName, true>;

export const EVENT_NAMES = Object.keys(EVENT_NAME_SET) as EventName[];
