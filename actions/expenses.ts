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
import { isDateAllowed } from "@/lib/domain/entry-date";

const MAX_DURATION_MS = 600_000;

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
  // "YYYY-MM-DD". Whether it is allowed depends on the user's local today, so
  // it is checked below, not here.
  occurredOn: z.string().optional(),
  // Metrics only (refactor-expense-entry D8): anything wrong here is dropped
  // (`.catch`), never a reason to refuse the expense.
  usedChip: z.boolean().catch(false).default(false),
  chipSource: z.enum(["history", "starter"]).nullable().catch(null).default(null),
  durationMs: z.number().int().min(0).max(MAX_DURATION_MS).optional().catch(undefined),
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

  const today = todayInTimezone(timezone);
  const occurredOn = parsed.data.occurredOn ?? today;
  if (!isDateAllowed(occurredOn, today)) {
    return { error: "Escolha hoje ou um dia anterior deste mês" };
  }

  const cycle = await getOrCreateCycle(userId, currentPeriod(timezone));
  const expense = await createExpenseForUser(userId, {
    cycleId: cycle.id,
    amountCents: parsed.data.amountCents,
    description: parsed.data.description,
    bucket: parsed.data.bucket,
    // "Pure" local date, never a timestamp — see design.md D8.
    occurredOn: new Date(`${occurredOn}T00:00:00.000Z`),
  });

  const suggestedBucket = suggestBucket(parsed.data.description);
  trackEvent(userId, "expense_created", {
    source: parsed.data.source,
    bucket: parsed.data.bucket,
    suggestedBucket,
    overridden: suggestedBucket !== null && suggestedBucket !== parsed.data.bucket,
    usedChip: parsed.data.usedChip,
    // A source only makes sense for a chip.
    chipSource: parsed.data.usedChip ? parsed.data.chipSource : null,
    ...(parsed.data.durationMs !== undefined && {
      durationMs: Math.round(parsed.data.durationMs / 100) * 100,
    }),
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
