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
