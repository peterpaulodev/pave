import { resolveDueDate } from "./recurring";

export type DailyAllowance = {
  allowanceCents: number;
  spentTodayCents: number;
  /** Can be negative: how much the user went over today's allowance. */
  remainingTodayCents: number;
  daysLeft: number;
  status: "ok" | "over_today" | "bucket_exhausted";
};

const TODAY_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/**
 * Days from `today` ("YYYY-MM-DD", the user's local date) through the last
 * day of its month, today included — always ≥ 1. The last day of the month
 * comes from `resolveDueDate`, the same rule recurring expenses use.
 */
export function daysLeftInMonth(today: string): number {
  const match = TODAY_PATTERN.exec(today);
  if (!match) {
    throw new Error(`Data inválida: "${today}" (esperado YYYY-MM-DD).`);
  }
  const day = Number(match[3]);
  const lastDay = Number(resolveDueDate(`${match[1]}-${match[2]}`, 31).slice(-2));
  if (day > lastDay) {
    throw new Error(`Data inválida: "${today}" (o mês só tem ${lastDay} dias).`);
  }
  return lastDay - day + 1;
}

/**
 * Today's leisure allowance (design.md D1/D2). `committedCents` is every
 * leisure expense of the cycle except today's manual ones, so spending today
 * lowers `remainingTodayCents` without moving `allowanceCents`.
 */
export function computeDailyAllowance(input: {
  wantsLimitCents: number;
  committedCents: number;
  spentTodayCents: number;
  today: string; // 'YYYY-MM-DD', local
}): DailyAllowance {
  const { wantsLimitCents, committedCents, spentTodayCents, today } = input;
  const daysLeft = daysLeftInMonth(today);

  const startOfDayCents = Math.max(0, wantsLimitCents - committedCents);
  const allowanceCents = Math.floor(startOfDayCents / daysLeft);
  const remainingTodayCents = allowanceCents - spentTodayCents;

  const status =
    startOfDayCents === 0
      ? "bucket_exhausted"
      : remainingTodayCents < 0
        ? "over_today"
        : "ok";

  return { allowanceCents, spentTodayCents, remainingTodayCents, daysLeft, status };
}
