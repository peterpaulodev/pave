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
  /** Cohort onboarded 14–44 days ago (user_settings.onboarded_at); retained =
   * manual expense or no-spend check-in on local days 7–13 after onboarding,
   * read from expenses/daily_checkins. Independent of the window. */
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

    // From the source tables, not events, so activity before the analytics
    // deploy counts. Days are the user's local dates (user_settings.timezone,
    // as in getRegisteredDates): "day N" = onboarding local date + N.
    ratio(Prisma.sql`
      WITH cohort AS (
        SELECT s.user_id,
               s.timezone,
               (s.onboarded_at AT TIME ZONE s.timezone)::date AS onboarded_day
          FROM user_settings s
         WHERE s.onboarded_at >= ${cohortFrom}::timestamptz
           AND s.onboarded_at <= ${cohortTo}::timestamptz
           AND ${notExcluded(Prisma.sql`s.user_id`)}
      )
      SELECT
        COUNT(*) FILTER (WHERE
          EXISTS (
            SELECT 1 FROM expenses x
             WHERE x.user_id = c.user_id
               AND x.recurring_expense_id IS NULL
               AND (x.created_at AT TIME ZONE c.timezone)::date
                   BETWEEN c.onboarded_day + 7 AND c.onboarded_day + 13
          )
          OR EXISTS (
            SELECT 1 FROM daily_checkins d
             WHERE d.user_id = c.user_id
               AND d.date BETWEEN c.onboarded_day + 7 AND c.onboarded_day + 13
          )
        )::int AS num,
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
    // check-in) on one of the user's last 7 local days — from the source
    // tables, like retention. Reminders sent to them don't count.
    prisma.$queryRaw<{ n: number }[]>(Prisma.sql`
      WITH u AS (
        SELECT us.id AS user_id,
               COALESCE(s.timezone, 'America/Sao_Paulo') AS timezone,
               (${now}::timestamptz AT TIME ZONE COALESCE(s.timezone, 'America/Sao_Paulo'))::date AS today
          FROM "user" us
          LEFT JOIN user_settings s ON s.user_id = us.id
         WHERE ${notExcluded(Prisma.sql`us.id`)}
      )
      SELECT COUNT(*)::int AS n
        FROM u
       WHERE EXISTS (
               SELECT 1 FROM expenses x
                WHERE x.user_id = u.user_id
                  AND x.recurring_expense_id IS NULL
                  AND x.created_at <= ${now}::timestamptz
                  AND (x.created_at AT TIME ZONE u.timezone)::date > u.today - 7
             )
          OR EXISTS (
               SELECT 1 FROM daily_checkins d
                WHERE d.user_id = u.user_id
                  AND d.date > u.today - 7 AND d.date <= u.today
             )
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
