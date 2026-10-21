/**
 * Local calendar date ("YYYY-MM-DD") and wall-clock hour (0–23) of `now` in
 * the IANA time zone `timeZone` — never UTC's (see design.md D7/D8).
 */
export function localDate(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error(`Não foi possível determinar a data para o fuso "${timeZone}".`);
  }

  return `${year}-${month}-${day}`;
}

export function localHour(timeZone: string, now: Date = new Date()): number {
  // hourCycle h23 evita o "24" que alguns runtimes devolvem à meia-noite.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const hour = parts.find((part) => part.type === "hour")?.value;
  if (!hour) {
    throw new Error(`Não foi possível determinar a hora para o fuso "${timeZone}".`);
  }

  return Number(hour) % 24;
}
