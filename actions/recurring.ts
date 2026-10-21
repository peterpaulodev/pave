"use server";

import { z } from "zod";
import { getSessionUserOrRedirect } from "@/lib/auth/session";
import { getOrCreateCycle, getUserSettings } from "@/server/queries";
import {
  createRecurring,
  deleteRecurring as deleteRecurringForUser,
  setRecurringActive,
  updateRecurring,
} from "@/server/recurring";
import { currentPeriod } from "@/lib/domain/period";

// userId always comes from the session; the cycle for "Lançar também neste
// mês" is resolved here from the user's own time zone — the client never
// sends either.

const recurringSchema = z.object({
  description: z.string().trim().min(1, "Informe uma descrição"),
  amountCents: z
    .number()
    .int()
    .positive({ message: "Informe um valor maior que zero" }),
  bucket: z.enum(["needs", "wants", "savings"]),
  dayOfMonth: z
    .number({ message: "Informe o dia do vencimento (1 a 31)" })
    .int({ message: "Informe o dia do vencimento (1 a 31)" })
    .min(1, "O dia deve estar entre 1 e 31")
    .max(31, "O dia deve estar entre 1 e 31"),
});

export type RecurringFormInput = z.input<typeof recurringSchema>;

export interface RecurringActionResult {
  error?: string;
  /** Which form field `error` refers to, when it's a validation error. */
  field?: keyof RecurringFormInput;
  ok?: boolean;
}

function validationError(error: z.ZodError): RecurringActionResult {
  const issue = error.issues[0];
  const field = issue?.path[0];
  return {
    error: issue?.message ?? "Dados inválidos",
    field: typeof field === "string" ? (field as keyof RecurringFormInput) : undefined,
  };
}

export async function createRecurringAction(
  input: RecurringFormInput & { alsoThisMonth?: boolean }
): Promise<RecurringActionResult> {
  const { alsoThisMonth, ...rest } = input;
  const parsed = recurringSchema.safeParse(rest);
  if (!parsed.success) return validationError(parsed.error);

  const { id: userId } = await getSessionUserOrRedirect();

  let cycleRef: { cycleId: string } | undefined;
  if (alsoThisMonth === true) {
    const settings = await getUserSettings(userId);
    const timezone = settings?.timezone ?? "America/Sao_Paulo";
    const cycle = await getOrCreateCycle(userId, currentPeriod(timezone));
    cycleRef = { cycleId: cycle.id };
  }

  await createRecurring(userId, { ...parsed.data, alsoThisMonth: cycleRef });
  return { ok: true };
}

export async function updateRecurringAction(
  id: string,
  input: RecurringFormInput
): Promise<RecurringActionResult> {
  const parsed = recurringSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const { id: userId } = await getSessionUserOrRedirect();
  const updated = await updateRecurring(userId, id, parsed.data);
  return updated ? { ok: true } : { error: "Conta fixa não encontrada" };
}

export async function setRecurringActiveAction(
  id: string,
  active: boolean
): Promise<RecurringActionResult> {
  const { id: userId } = await getSessionUserOrRedirect();
  const updated = await setRecurringActive(userId, id, active);
  return updated ? { ok: true } : { error: "Conta fixa não encontrada" };
}

export async function deleteRecurringAction(
  id: string
): Promise<RecurringActionResult> {
  const { id: userId } = await getSessionUserOrRedirect();
  const deleted = await deleteRecurringForUser(userId, id);
  return deleted ? { ok: true } : { error: "Conta fixa não encontrada" };
}
