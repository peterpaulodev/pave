"use client";

import { savePushSubscription, setReminderSettings } from "@/actions/push";
import { subscribeToPush } from "@/lib/push/client";

export type EnableReminderResult = "enabled" | "denied" | "error";

/**
 * Asks for notification permission (only ever called from a user tap — iOS
 * requires it), subscribes this device and turns the reminder on.
 */
export async function enableReminderOnThisDevice(
  hour: number
): Promise<EnableReminderResult> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";

    const subscription = await subscribeToPush();
    const saved = await savePushSubscription(subscription);
    if (!saved.ok) return "error";

    const settings = await setReminderSettings({ enabled: true, hour });
    return settings.ok ? "enabled" : "error";
  } catch {
    return "error";
  }
}
