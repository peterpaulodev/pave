"use server";

import { z } from "zod";
import { getSessionUserOrRedirect } from "@/lib/auth/session";
import { markSummarySeenFor } from "@/server/monthly-summary";

const periodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

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
