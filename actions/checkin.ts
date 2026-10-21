"use server";

import { getSessionUserOrRedirect } from "@/lib/auth/session";
import { localDate } from "@/lib/domain/local-date";
import { getUserSettings } from "@/server/queries";
import { markNoSpend } from "@/server/checkin";

/** "Não gastei nada hoje": the day is today in the user's own time zone,
 * computed here — never sent by the client. */
export async function markNoSpendToday(): Promise<{ ok: true }> {
  const { id: userId } = await getSessionUserOrRedirect();
  const settings = await getUserSettings(userId);
  const timezone = settings?.timezone ?? "America/Sao_Paulo";
  await markNoSpend(userId, localDate(timezone));
  return { ok: true };
}
