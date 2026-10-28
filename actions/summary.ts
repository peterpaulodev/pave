"use server";

import { getSessionUserOrRedirect } from "@/lib/auth/session";
import { markSummarySeenFor, periodSchema } from "@/server/monthly-summary";

/** "Começar [mês]": confirms the summary was read. Only the previous period
 * (as the server computes it) is recorded — any other value is ignored. */
export async function markSummarySeen(period: string): Promise<{ ok: true }> {
  const { id: userId } = await getSessionUserOrRedirect();
  const parsed = periodSchema.safeParse(period);
  if (parsed.success) {
    await markSummarySeenFor(userId, parsed.data);
  }
  return { ok: true };
}
