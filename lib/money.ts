/**
 * Parses a Brazilian-formatted amount ("5000", "5.000", "5000,50",
 * "5.000,50" — "." as thousands separator, "," as decimal separator) into
 * an integer number of cents. Returns `null` for anything that isn't a
 * well-formed, non-negative amount.
 */
export function parseBRL(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "" || !/^-?[\d.,]+$/.test(trimmed)) return null;
  if (trimmed.startsWith("-")) return null; // amounts are never negative

  const commaIndex = trimmed.lastIndexOf(",");
  const [rawInteger, fraction] =
    commaIndex === -1
      ? [trimmed, "0"]
      : [trimmed.slice(0, commaIndex), trimmed.slice(commaIndex + 1)];

  const integer = rawInteger.replace(/\./g, "");
  if (integer === "" || !/^\d+$/.test(integer)) return null;
  if (!/^\d{1,2}$/.test(fraction)) return null;

  const cents = Number(integer) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isFinite(cents) ? cents : null;
}

/** Formats an integer number of cents as a BRL currency string. */
export function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}
