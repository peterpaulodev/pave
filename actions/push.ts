"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getSessionUserOrRedirect } from "@/lib/auth/session";
import { getUserSettings, upsertUserSettings } from "@/server/queries";
import { trackEvent } from "@/server/analytics";
import {
  removePushSubscription as removeForUser,
  upsertPushSubscription,
} from "@/server/push";

const subscriptionSchema = z.object({
  endpoint: z.url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

const reminderSchema = z.object({
  enabled: z.boolean(),
  hour: z.number().int().min(0).max(23),
});

export interface PushActionResult {
  ok?: boolean;
  error?: string;
}

export async function savePushSubscription(
  subscription: z.input<typeof subscriptionSchema>
): Promise<PushActionResult> {
  const parsed = subscriptionSchema.safeParse(subscription);
  if (!parsed.success) return { error: "Inscrição de push inválida" };

  const { id: userId } = await getSessionUserOrRedirect();
  const userAgent = (await headers()).get("user-agent");
  await upsertPushSubscription(userId, {
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    userAgent,
  });
  return { ok: true };
}

export async function removePushSubscription(
  endpoint: string
): Promise<PushActionResult> {
  const { id: userId } = await getSessionUserOrRedirect();
  await removeForUser(userId, endpoint);
  return { ok: true };
}

/** Turns the daily reminder on/off and sets its local hour (0–23). */
export async function setReminderSettings(
  input: z.input<typeof reminderSchema>
): Promise<PushActionResult> {
  const parsed = reminderSchema.safeParse(input);
  if (!parsed.success) return { error: "Horário inválido" };

  const { id: userId } = await getSessionUserOrRedirect();
  const wasEnabled = (await getUserSettings(userId))?.reminderEnabled ?? false;
  await upsertUserSettings(userId, {
    reminderEnabled: parsed.data.enabled,
    reminderHour: parsed.data.hour,
  });

  // Only on/off transitions: changing the hour of an enabled reminder is
  // neither an activation nor a deactivation.
  if (parsed.data.enabled && !wasEnabled) {
    trackEvent(userId, "reminder_enabled", { hour: parsed.data.hour });
  } else if (!parsed.data.enabled && wasEnabled) {
    trackEvent(userId, "reminder_disabled", {});
  }
  return { ok: true };
}
