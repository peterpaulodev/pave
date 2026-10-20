"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSessionUserOrRedirect } from "@/lib/auth/session";
import { completeOnboarding as completeOnboardingForUser } from "@/server/queries";

const incomeCentsSchema = z
  .number()
  .int()
  .positive({ message: "Informe quanto você recebe por mês" });

export interface CompleteOnboardingResult {
  error?: string;
}

/**
 * Validates and saves the user's income, creates the current period's
 * cycle (server/queries.ts's completeOnboarding — see it for how double
 * submits stay idempotent), then redirects to the dashboard with a
 * one-time `onboarded=1` marker that triggers the PWA install suggestion
 * there (see components/install-pwa-prompt.tsx) — "sem bloquear o fluxo"
 * per specs/onboarding/spec.md means the suggestion must not gate arriving
 * at the dashboard, not that it has to happen before leaving this page.
 */
export async function completeOnboarding(
  incomeCents: number
): Promise<CompleteOnboardingResult> {
  const parsed = incomeCentsSchema.safeParse(incomeCents);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Valor inválido" };
  }

  const { id: userId } = await getSessionUserOrRedirect();
  await completeOnboardingForUser(userId, parsed.data);

  redirect("/?onboarded=1");
}
