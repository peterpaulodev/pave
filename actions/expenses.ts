"use server";

import { z } from "zod";
import { getSessionUserOrRedirect } from "@/lib/auth/session";
import {
  createExpense as createExpenseForUser,
  getOrCreateCycle,
  getUserSettings,
  removeExpense,
} from "@/server/queries";
import { trackEvent } from "@/server/analytics";
import { suggestBucket } from "@/lib/domain/suggest-bucket";
import { currentPeriod, todayInTimezone } from "@/lib/domain/period";

const createExpenseSchema = z.object({
  amountCents: z
    .number()
    .int()
    .positive({ message: "Informe um valor maior que zero" }),
  description: z.string().trim().min(1, "Informe uma descrição"),
  bucket: z.enum(["needs", "wants", "savings"]),
  // Only for metrics (design.md D3): "recurring" is never accepted from the
  // client, and the bucket suggestion is recomputed here, not trusted.
  source: z.enum(["quick_entry", "notification"]).default("quick_entry"),
});

export type CreateExpenseInput = z.input<typeof createExpenseSchema>;

export interface CreateExpenseResult {
  error?: string;
  data?: { id: string };
}

/** Validates and saves a quick-entry expense against the current month's
 * cycle (creating it on demand — e.g. the user's very first expense). */
export async function createExpense(
  input: CreateExpenseInput
): Promise<CreateExpenseResult> {
  const parsed = createExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const { id: userId } = await getSessionUserOrRedirect();
  const settings = await getUserSettings(userId);
  const timezone = settings?.timezone ?? "America/Sao_Paulo";

  const cycle = await getOrCreateCycle(userId, currentPeriod(timezone));
  const expense = await createExpenseForUser(userId, {
    cycleId: cycle.id,
    amountCents: parsed.data.amountCents,
    description: parsed.data.description,
    bucket: parsed.data.bucket,
    // "Pure" local date, never a timestamp — see design.md D8.
    occurredOn: new Date(`${todayInTimezone(timezone)}T00:00:00.000Z`),
  });

  const suggestedBucket = suggestBucket(parsed.data.description);
  trackEvent(userId, "expense_created", {
    source: parsed.data.source,
    bucket: parsed.data.bucket,
    suggestedBucket,
    overridden: suggestedBucket !== null && suggestedBucket !== parsed.data.bucket,
  });

  return { data: { id: expense.id } };
}

/** Powers the "Desfazer" (undo) action on the post-save toast. */
export async function deleteExpense(
  expenseId: string
): Promise<{ data: { deleted: boolean } }> {
  const { id: userId } = await getSessionUserOrRedirect();
  const removed = await removeExpense(userId, expenseId);
  if (removed) trackEvent(userId, "expense_deleted", removed);
  return { data: { deleted: removed !== null } };
}
