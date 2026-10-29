const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `true` for a real calendar date written exactly as "YYYY-MM-DD". */
function isRealDate(date: string): boolean {
  const match = DATE_PATTERN.exec(date);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const parsed = new Date(Date.UTC(year, month - 1, day));
  // Date.UTC rolls "02-30" over to March: a round trip catches it.
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

/**
 * Dates an expense can be dated with (design.md D6): from the first day of
 * `today`'s month through `today` itself. `today` is the user's local date
 * ("YYYY-MM-DD"); everything here is string math, never a `Date` in a time zone.
 */
export function allowedDateRange(today: string): { min: string; max: string } {
  if (!isRealDate(today)) {
    throw new Error(`Data inválida: "${today}" (esperado YYYY-MM-DD).`);
  }
  return { min: `${today.slice(0, 8)}01`, max: today };
}

/** "Ontem" belongs to the previous month on the 1st, so it's not allowed. */
export function isYesterdayAllowed(today: string): boolean {
  return Number(allowedDateRange(today).max.slice(8, 10)) > 1;
}

/** Whether `date` is a real date inside `allowedDateRange(today)`. Never throws. */
export function isDateAllowed(date: string, today: string): boolean {
  if (!isRealDate(date)) return false;
  const { min, max } = allowedDateRange(today);
  // Same-width ISO strings sort like the dates they spell.
  return date >= min && date <= max;
}

/** The calendar day before `date` ("YYYY-MM-DD"), string-in string-out. */
export function previousDay(date: string): string {
  if (!isRealDate(date)) throw new Error(`Data inválida: "${date}" (esperado YYYY-MM-DD).`);
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
