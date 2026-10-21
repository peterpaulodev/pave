import "server-only";
import { prisma } from "@/lib/db";
import { localDate, localHour } from "@/lib/domain/local-date";
import { getRegisteredDates } from "@/server/checkin";
import { sendToUser, type PushPayload } from "@/lib/push/web-push";
import { trackEvents } from "@/server/analytics";
import { computeDailyAllowance } from "@/lib/domain/daily-allowance";
import { buildReminderBody, DEFAULT_REMINDER_BODY } from "@/lib/domain/reminder-text";
import { getDailyAllowanceInputs } from "@/server/daily-allowance";

export const REMINDER_PAYLOAD: PushPayload = {
  title: "Pave",
  body: DEFAULT_REMINDER_BODY,
  // src=notification lets /novo tag the expense as coming from the reminder.
  url: "/novo?src=notification",
};

export interface ReminderCandidate {
  userId: string;
  localDate: string;
  /** The user opted in to the leftover leisure amount in the text. */
  showAmount: boolean;
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

    due.push({
      userId: user.userId,
      localDate: today,
      showAmount: user.reminderShowAmount,
    });
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

/**
 * The push payload for one user (design.md D5). Only for users who opted in:
 * looks up the period's *existing* cycle (never creates one — the cron must
 * not have side effects on the budget) and builds the text from today's
 * leisure allowance. Anything that goes wrong falls back to the default text
 * so a reminder is never lost over the amount.
 */
async function payloadFor(candidate: ReminderCandidate): Promise<PushPayload> {
  if (!candidate.showAmount) return REMINDER_PAYLOAD;

  try {
    const cycle = await prisma.budgetCycle.findUnique({
      where: {
        userId_period: {
          userId: candidate.userId,
          period: candidate.localDate.slice(0, 7),
        },
      },
      select: { id: true },
    });
    const inputs = cycle
      ? await getDailyAllowanceInputs(candidate.userId, cycle.id, candidate.localDate)
      : null;
    const allowance = inputs
      ? computeDailyAllowance({ ...inputs, today: candidate.localDate })
      : null;
    return { ...REMINDER_PAYLOAD, body: buildReminderBody(allowance, true) };
  } catch (error) {
    console.error("[reminders] falha ao montar o texto com o valor diário", error);
    return REMINDER_PAYLOAD;
  }
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
      return sendToUser(candidate.userId, await payloadFor(candidate));
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
