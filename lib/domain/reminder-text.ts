import { formatBRL } from "@/lib/money";
import type { DailyAllowance } from "./daily-allowance";

export const DEFAULT_REMINDER_BODY =
  "Gastou algo hoje? Leva 5 segundos para registrar.";

/**
 * Reminder text (design.md D5). The amount only appears when the user opted
 * in AND there is something left for today; otherwise — option off, no cycle
 * (`null`), over today's allowance, bucket exhausted, or nothing left — the
 * default text is used.
 */
export function buildReminderBody(
  allowance: DailyAllowance | null,
  showAmount: boolean
): string {
  if (!showAmount || allowance === null) return DEFAULT_REMINDER_BODY;
  if (allowance.status !== "ok" || allowance.remainingTodayCents <= 0) {
    return DEFAULT_REMINDER_BODY;
  }
  return `Você ainda tem ${formatBRL(allowance.remainingTodayCents)} de lazer hoje. Gastou algo?`;
}
