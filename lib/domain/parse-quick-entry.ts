export interface QuickEntry {
  description: string;
  amountCents: number;
}

// Deliberately not money.ts's parseBRL: a quick entry is informal and
// small, so "," and "." are both accepted as the DECIMAL separator here
// (e.g. "23.50" means 23 reais 50, not 2.350 reais). parseBRL instead
// treats "." as a thousands separator, which is correct for money.ts's own
// formatted-amount use case but would misparse "23.50" as R$ 2.350,00.
function parseQuickAmount(token: string): number | null {
  if (!/^\d+([.,]\d{1,2})?$/.test(token)) return null;
  const value = Number(token.replace(",", "."));
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

/**
 * Parses a free-form quick-entry string ("mercado 120", "120 mercado",
 * "uber 23,50") into a description and an amount in cents. The amount can
 * appear before or after the description. Returns `null` when no valid
 * amount is found, or when nothing is left to use as a description.
 */
export function parseQuickEntry(input: string): QuickEntry | null {
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;

  let amountCents: number | null = null;
  let amountIndex = -1;

  for (let i = 0; i < tokens.length; i++) {
    const parsed = parseQuickAmount(tokens[i]);
    if (parsed !== null) {
      amountCents = parsed;
      amountIndex = i;
      break;
    }
  }

  if (amountCents === null) return null;

  const description = tokens.filter((_, i) => i !== amountIndex).join(" ");
  if (description === "") return null;

  return { description, amountCents };
}
