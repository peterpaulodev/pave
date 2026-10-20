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
