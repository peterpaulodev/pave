import "server-only";
import { prisma } from "@/lib/db";

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}

/** One row per device (`endpoint` is unique). If the same browser signs in
 * as a different user, the subscription moves to that user — an endpoint
 * must never keep delivering one account's reminders to another's session. */
export function upsertPushSubscription(
  userId: string,
  input: PushSubscriptionInput
) {
  const { endpoint, p256dh, auth, userAgent } = input;
  return prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId, endpoint, p256dh, auth, userAgent: userAgent ?? null },
    update: { userId, p256dh, auth, userAgent: userAgent ?? null },
  });
}

/** Scoped by user: only removes the caller's own subscription. */
export async function removePushSubscription(
  userId: string,
  endpoint: string
): Promise<boolean> {
  const { count } = await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId },
  });
  return count > 0;
}
