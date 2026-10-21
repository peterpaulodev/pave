import "server-only";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";

// Product metrics (design.md D6), aggregated in SQL. Every value reaches the
// query as a bound parameter through Prisma.sql — never string interpolation.
// `excludeUserIds` (the admins) is bound as a text[]; an empty array excludes
// nobody.

export interface Ratio {
  num: number;
  den: number;
}

export interface Metrics {
  windowDays: number;
  /** Users created in the window that completed onboarding. */
  onboarding: Ratio;
  /** Cohort onboarded 14–44 days ago; retained = manual expense or no-spend
   * check-in on days 7–13 after onboarding. Independent of the window. */
  weekTwoRetention: Ratio;
  /** Manual expenses that came from the reminder notification. */
  notificationExpenses: Ratio;
  remindersSent: number;
  /** Notification expenses ÷ reminders sent. */
  notificationPerReminder: Ratio;
  /** Manual expenses with a suggestion that kept the suggested bucket. */
  bucketHit: Ratio;
  /** Manual expenses the dictionary had no suggestion for. */
  noSuggestion: Ratio;
  activeUsers7d: number;
  usersWithReminder: number;
}

export interface MetricsOptions {
  windowDays: number;
  excludeUserIds?: string[];
  /** Restricts every metric to these users (tests, so other rows in the
   * shared dev database don't leak in). */
  onlyUserIds?: string[];
  now?: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

async function ratio(query: Prisma.Sql): Promise<Ratio> {
  const [row] = await prisma.$queryRaw<Ratio[]>(query);
  return { num: row?.num ?? 0, den: row?.den ?? 0 };
}

export async function getMetrics(options: MetricsOptions): Promise<Metrics> {
  const { windowDays } = options;
  const excluded = options.excludeUserIds ?? [];
  const now = options.now ?? new Date();
  const since = new Date(now.getTime() - windowDays * DAY_MS);
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  // Retention cohort: onboarded between 44 and 14 days ago.
  const cohortFrom = new Date(now.getTime() - 44 * DAY_MS);
  const cohortTo = new Date(now.getTime() - 14 * DAY_MS);

  const only = options.onlyUserIds ?? null;
  const notExcluded = (column: Prisma.Sql) =>
    Prisma.sql`NOT (${column} = ANY(${excluded}::text[]))
      AND (${only}::text[] IS NULL OR ${column} = ANY(${only}::text[]))`;

  const [
    onboarding,
    weekTwoRetention,
    notificationExpenses,
    remindersSent,
    bucketHit,
    noSuggestion,
    active,
    reminderUsers,
  ] = await Promise.all([
    // "user"."created_at" is a plain timestamp holding UTC.
    ratio(Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM events e
           WHERE e.user_id = u.id AND e.name = 'onboarding_completed'
        ))::int AS num,
        COUNT(*)::int AS den
      FROM "user" u
      WHERE (u.created_at AT TIME ZONE 'UTC') >= ${since}::timestamptz
        AND (u.created_at AT TIME ZONE 'UTC') <= ${now}::timestamptz
        AND ${notExcluded(Prisma.sql`u.id`)}
    `),

    ratio(Prisma.sql`
      WITH cohort AS (
        SELECT e.user_id, MIN(e.created_at) AS onboarded_at
          FROM events e
         WHERE e.name = 'onboarding_completed'
           AND ${notExcluded(Prisma.sql`e.user_id`)}
         GROUP BY e.user_id
        HAVING MIN(e.created_at) >= ${cohortFrom}::timestamptz
           AND MIN(e.created_at) <= ${cohortTo}::timestamptz
      )
      SELECT
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM events a
           WHERE a.user_id = c.user_id
             AND a.created_at >= c.onboarded_at + interval '7 days'
             AND a.created_at <  c.onboarded_at + interval '14 days'
             AND (
               a.name = 'no_spend_checkin'
               OR (a.name = 'expense_created'
                   AND a.props->>'source' IN ('quick_entry', 'notification'))
             )
        ))::int AS num,
        COUNT(*)::int AS den
      FROM cohort c
    `),

    ratio(Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE e.props->>'source' = 'notification')::int AS num,
        COUNT(*)::int AS den
      FROM events e
      WHERE e.name = 'expense_created'
        AND e.props->>'source' IN ('quick_entry', 'notification')
        AND e.created_at >= ${since}::timestamptz AND e.created_at <= ${now}::timestamptz
        AND ${notExcluded(Prisma.sql`e.user_id`)}
    `),

    prisma.$queryRaw<{ n: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS n
        FROM events e
       WHERE e.name = 'reminder_sent'
         AND e.created_at >= ${since}::timestamptz AND e.created_at <= ${now}::timestamptz
         AND ${notExcluded(Prisma.sql`e.user_id`)}
    `),

    ratio(Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE e.props->>'overridden' = 'false')::int AS num,
        COUNT(*)::int AS den
      FROM events e
      WHERE e.name = 'expense_created'
        AND e.props->>'source' IN ('quick_entry', 'notification')
        AND e.props->>'suggestedBucket' IS NOT NULL
        AND e.created_at >= ${since}::timestamptz AND e.created_at <= ${now}::timestamptz
        AND ${notExcluded(Prisma.sql`e.user_id`)}
    `),

    ratio(Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE e.props->>'suggestedBucket' IS NULL)::int AS num,
        COUNT(*)::int AS den
      FROM events e
      WHERE e.name = 'expense_created'
        AND e.props->>'source' IN ('quick_entry', 'notification')
        AND e.created_at >= ${since}::timestamptz AND e.created_at <= ${now}::timestamptz
        AND ${notExcluded(Prisma.sql`e.user_id`)}
    `),

    // Active = registered something themselves (manual expense or no-spend
    // check-in) in the last 7 days; reminders sent to them don't count.
    prisma.$queryRaw<{ n: number }[]>(Prisma.sql`
      SELECT COUNT(DISTINCT e.user_id)::int AS n
        FROM events e
       WHERE e.created_at >= ${weekAgo}::timestamptz AND e.created_at <= ${now}::timestamptz
         AND (e.name = 'no_spend_checkin'
              OR (e.name = 'expense_created'
                  AND e.props->>'source' IN ('quick_entry', 'notification')))
         AND ${notExcluded(Prisma.sql`e.user_id`)}
    `),

    prisma.$queryRaw<{ n: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS n
        FROM user_settings s
       WHERE s.reminder_enabled
         AND ${notExcluded(Prisma.sql`s.user_id`)}
    `),
  ]);

  const reminders = remindersSent[0]?.n ?? 0;
  return {
    windowDays,
    onboarding,
    weekTwoRetention,
    notificationExpenses,
    remindersSent: reminders,
    notificationPerReminder: { num: notificationExpenses.num, den: reminders },
    bucketHit,
    noSuggestion,
    activeUsers7d: active[0]?.n ?? 0,
    usersWithReminder: reminderUsers[0]?.n ?? 0,
  };
}
