import "server-only";
import { prisma } from "@/lib/db";
import { localDate, localHour } from "@/lib/domain/local-date";
import { getRegisteredDates } from "@/server/checkin";
import { sendToUser, type PushPayload } from "@/lib/push/web-push";
import { trackEvents } from "@/server/analytics";

export const REMINDER_PAYLOAD: PushPayload = {
  title: "Pave",
  body: "Gastou algo hoje? Leva 5 segundos para registrar.",
  // src=notification lets /novo tag the expense as coming from the reminder.
  url: "/novo?src=notification",
};

export interface ReminderCandidate {
  userId: string;
  localDate: string;
}

export interface FindUsersToRemindResult {
  /** Users with the reminder on and at least one subscribed device. */
  checked: number;
  due: ReminderCandidate[];
}

/**
 * Who should get a reminder at `nowUtc` (design.md D7): reminder on, with a
 * device subscribed, local hour == `reminderHour`, not already sent on this
 * local date, and nothing registered today — a manual expense or a "no
 * spend" check-in; automatic recurring expenses don't count (D8).
 * `onlyUserIds` restricts the scan (tests).
 */
export async function findUsersToRemind(
  nowUtc: Date,
  options: { onlyUserIds?: string[] } = {}
): Promise<FindUsersToRemindResult> {
  const settings = await prisma.userSettings.findMany({
    where: {
      reminderEnabled: true,
      user: { pushSubscriptions: { some: {} } },
      ...(options.onlyUserIds ? { userId: { in: options.onlyUserIds } } : {}),
    },
  });

  const due: ReminderCandidate[] = [];
  for (const user of settings) {
    if (localHour(user.timezone, nowUtc) !== user.reminderHour) continue;

    const today = localDate(user.timezone, nowUtc);
    if (user.lastReminderSentOn?.toISOString().slice(0, 10) === today) continue;

    const registered = await getRegisteredDates(user.userId, user.timezone, 1, nowUtc);
    if (registered.includes(today)) continue;

    due.push({ userId: user.userId, localDate: today });
  }

  return { checked: settings.length, due };
}

/** Claims today's reminder for the user. Only one concurrent run wins, so a
 * duplicated cron never double-sends (at-most-once per local day). */
async function claimReminder(candidate: ReminderCandidate): Promise<boolean> {
  const today = new Date(`${candidate.localDate}T00:00:00.000Z`);
  const { count } = await prisma.userSettings.updateMany({
    where: {
      userId: candidate.userId,
      OR: [{ lastReminderSentOn: null }, { lastReminderSentOn: { not: today } }],
    },
    data: { lastReminderSentOn: today },
  });
  return count > 0;
}

export interface ReminderRunResult {
  checked: number;
  sent: number;
  removedSubscriptions: number;
}

export async function runReminderCron(
  nowUtc: Date = new Date(),
  options: { onlyUserIds?: string[] } = {}
): Promise<ReminderRunResult> {
  const { checked, due } = await findUsersToRemind(nowUtc, options);

  const outcomes = await Promise.allSettled(
    due.map(async (candidate) => {
      if (!(await claimReminder(candidate))) return null;
      return sendToUser(candidate.userId, REMINDER_PAYLOAD);
    })
  );

  let sent = 0;
  let removedSubscriptions = 0;
  const sentUserIds: string[] = [];
  outcomes.forEach((outcome, index) => {
    if (outcome.status !== "fulfilled" || outcome.value === null) return;
    if (outcome.value.sent > 0) {
      sent += 1;
      sentUserIds.push(due[index].userId);
    }
    removedSubscriptions += outcome.value.removed;
  });

  trackEvents(sentUserIds, "reminder_sent", sentUserIds.map(() => ({})));

  return { checked, sent, removedSubscriptions };
}
