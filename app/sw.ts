/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

// Serwist's addEventListeners() only registers install/activate/fetch/message,
// so the push handlers below live alongside it without touching the
// precache or runtime caching.
serwist.addEventListeners();

interface ReminderPushData {
  title?: string;
  body?: string;
  url?: string;
}

const NO_SPEND_ACTION = "no-spend";
const DEFAULT_URL = "/novo";

self.addEventListener("push", (event) => {
  let data: ReminderPushData = {};
  try {
    data = (event.data?.json() as ReminderPushData | undefined) ?? {};
  } catch {
    // non-JSON payload: fall back to the defaults below
  }

  // `actions` isn't in the webworker lib's NotificationOptions typing yet;
  // browsers without support (iOS) simply ignore it.
  const options: NotificationOptions & {
    actions?: { action: string; title: string }[];
  } = {
    body: data.body ?? "Gastou algo hoje? Leva 5 segundos para registrar.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: "daily-reminder",
    data: { url: data.url ?? DEFAULT_URL },
    actions: [{ action: NO_SPEND_ACTION, title: "Não gastei nada" }],
  };

  event.waitUntil(self.registration.showNotification(data.title ?? "Pave", options));
});

// "Não gastei nada" calls POST /api/checkin/no-spend from the SW. The fetch
// is same-origin, so the browser attaches the Neon Auth session cookies
// (credentials: "include"); `redirect: "manual"` stops an expired session
// from being silently followed to the /login page (which would look like a
// 200). On anything but a clean success we fall back to opening /novo.
async function markNoSpendFromNotification(): Promise<boolean> {
  try {
    const response = await fetch("/api/checkin/no-spend", {
      method: "POST",
      credentials: "include",
      redirect: "manual",
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function openOrFocusApp(url: string): Promise<void> {
  const target = new URL(url, self.location.origin).href;
  const windows = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  for (const client of windows) {
    if (new URL(client.url).origin !== self.location.origin) continue;
    try {
      await client.focus();
      await client.navigate(target);
    } catch {
      // navigate() can fail on a window we don't control; focusing is enough
    }
    return;
  }

  await self.clients.openWindow(target);
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | null)?.url ?? DEFAULT_URL;

  event.waitUntil(
    (async () => {
      if (event.action === NO_SPEND_ACTION && (await markNoSpendFromNotification())) {
        return;
      }
      await openOrFocusApp(url);
    })()
  );
});
