import { resolveDueDate } from "./recurring";

/**
 * Returns the current period ("YYYY-MM") as of the given IANA time zone's
 * local wall-clock date — not UTC's. Near a month boundary, the local date
 * in `timeZone` can be a different month than UTC's.
 */
export function currentPeriod(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) {
    throw new Error(`Não foi possível determinar o período para o fuso "${timeZone}".`);
  }

  return `${year}-${month}`;
}

/**
 * Today's date in `timeZone`, as "YYYY-MM-DD" — the user's local calendar
 * date, not UTC's (see design.md D8). Expenses record this as a "pure"
 * date (`new Date(`${todayInTimezone(tz)}T00:00:00.000Z`)`), never a
 * timestamp, so a user near midnight always gets today's date in their
 * own time zone instead of the server's.
 */
export function todayInTimezone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error(`Não foi possível determinar a data para o fuso "${timeZone}".`);
  }

  return `${year}-${month}-${day}`;
}

const PERIOD_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

function parsePeriod(period: string): { year: number; month: number } {
  const match = PERIOD_PATTERN.exec(period);
  if (!match) {
    throw new Error(`Período inválido: "${period}" (esperado YYYY-MM).`);
  }
  return { year: Number(match[1]), month: Number(match[2]) };
}

/** The period before `period` ("YYYY-MM"); January goes to the previous December. */
export function previousPeriod(period: string): string {
  const { year, month } = parsePeriod(period);
  const [y, m] = month === 1 ? [year - 1, 12] : [year, month - 1];
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}`;
}

/**
 * Month name in pt-BR, lowercase ("outubro"), of `period`. A "pure" calendar
 * month: formatted in UTC from a UTC date, so the process time zone never
 * shifts it.
 */
export function periodLabel(period: string): string {
  const { year, month } = parsePeriod(period);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1))
  );
}

/** Number of days in `period` ("YYYY-MM"), by the same last-day rule recurring expenses use. */
export function daysInPeriod(period: string): number {
  return Number(resolveDueDate(period, 31).slice(-2));
}
