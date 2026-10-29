import { normalizeText } from "./suggest-bucket";

/** Description without numbers ("45,90" included) and extra spaces, original case kept. */
export function cleanDescription(description: string): string {
  return description.replace(/\d+(?:[.,]\d+)*/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Key that makes "ifood 30", "iFood" and "IFOOD" the same thing: digits,
 * case, accents and spacing are ignored.
 */
export function descriptionKey(description: string): string {
  const key = normalizeText(cleanDescription(description));
  // A description made only of digits would collapse to "": keep it distinct.
  return key || normalizeText(description).trim();
}
