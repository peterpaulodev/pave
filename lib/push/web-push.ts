import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/db";

export interface PushPayload {
  title: string;
  body: string;
  /** Where the notification opens the app (design.md D5). */
  url: string;
}

export interface SendResult {
  /** Subscriptions the push service accepted. */
  sent: number;
  /** Expired/revoked subscriptions (404/410) that were deleted. */
  removed: number;
  /** Other failures (network, 5xx, ...) — subscription kept. */
  failed: number;
}

let configured = false;

function configureVapid() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      "NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_SUBJECT devem estar definidas (veja .env.example)."
    );
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

function isGone(error: unknown): boolean {
  const status = (error as { statusCode?: number } | null)?.statusCode;
  return status === 404 || status === 410;
}

/**
 * Sends `payload` to every device the user subscribed. Uses
 * Promise.allSettled so one dead device never blocks the others, and drops
 * subscriptions the push service says no longer exist (design.md D5).
 */
export async function sendToUser(
  userId: string,
  payload: PushPayload
): Promise<SendResult> {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });
  if (subscriptions.length === 0) return { sent: 0, removed: 0, failed: 0 };

  configureVapid();
  const body = JSON.stringify(payload);

  const results = await Promise.allSettled(
    subscriptions.map((subscription) =>
      webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        body,
        { TTL: 60 * 60 }
      )
    )
  );

  const goneIds: string[] = [];
  let sent = 0;
  let failed = 0;
  results.forEach((result, index) => {
    if (result.status === "fulfilled") sent += 1;
    else if (isGone(result.reason)) goneIds.push(subscriptions[index].id);
    else failed += 1;
  });

  if (goneIds.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { id: { in: goneIds }, userId },
    });
  }

  return { sent, removed: goneIds.length, failed };
}
