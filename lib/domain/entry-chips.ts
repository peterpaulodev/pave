import type { Bucket } from "./buckets";
import { cleanDescription, descriptionKey } from "./description-key";

/** A description the user has typed before, with the bucket they used last. */
export interface FrequentDescription {
  label: string;
  bucket: Bucket;
}

export interface EntryChip extends FrequentDescription {
  /** `history` chips show "como da última vez", `starter` ones "sugerido". */
  source: "history" | "starter";
}

/** Suggestions for users with little or no history (design.md D3). */
export const STARTER_CHIPS: readonly FrequentDescription[] = [
  { label: "Mercado", bucket: "needs" },
  { label: "Transporte", bucket: "needs" },
  { label: "Farmácia", bucket: "needs" },
  { label: "Restaurante", bucket: "wants" },
  { label: "Delivery", bucket: "wants" },
  { label: "Assinaturas", bucket: "wants" },
];

/** One (description, bucket) group, as the aggregated query returns it. */
export interface DescriptionStat {
  description: string;
  bucket: Bucket;
  count: number;
  /** Date of the group's latest expense, "YYYY-MM-DD". */
  lastOccurredOn: string;
  /** Creation time (ms) of that latest expense; breaks ties on the same date. */
  lastCreatedAt: number;
}

type Recency = Pick<DescriptionStat, "lastOccurredOn" | "lastCreatedAt">;

/** Positive when `a` is more recent than `b`. */
function compareRecency(a: Recency, b: Recency): number {
  if (a.lastOccurredOn !== b.lastOccurredOn) {
    return a.lastOccurredOn < b.lastOccurredOn ? -1 : 1;
  }
  return a.lastCreatedAt - b.lastCreatedAt;
}

interface Group {
  count: number;
  latest: DescriptionStat;
  /** Spellings without digits → how often each was used and how recently. */
  spellings: Map<string, { count: number } & Recency>;
}

/**
 * Merges the per-(description, bucket) counts into the user's frequent
 * descriptions (design.md D3). Descriptions are the same when they only differ
 * by digits, case, accents or spacing. Per group: the label is the most
 * frequent spelling without digits (a tie goes to the most recent spelling),
 * the bucket is the latest expense's, and groups sort by total count, then by
 * recency.
 */
export function groupFrequentDescriptions(
  stats: readonly DescriptionStat[],
  limit: number
): FrequentDescription[] {
  const groups = new Map<string, Group>();

  for (const stat of stats) {
    const key = descriptionKey(stat.description);
    const spelling = cleanDescription(stat.description) || stat.description.trim();
    const group = groups.get(key) ?? { count: 0, latest: stat, spellings: new Map() };

    group.count += stat.count;
    if (compareRecency(stat, group.latest) > 0) group.latest = stat;

    const known = group.spellings.get(spelling);
    const newer = !known || compareRecency(stat, known) > 0;
    group.spellings.set(spelling, {
      count: (known?.count ?? 0) + stat.count,
      lastOccurredOn: newer ? stat.lastOccurredOn : known.lastOccurredOn,
      lastCreatedAt: newer ? stat.lastCreatedAt : known.lastCreatedAt,
    });
    groups.set(key, group);
  }

  return [...groups.values()]
    .sort((a, b) => b.count - a.count || compareRecency(b.latest, a.latest))
    .slice(0, limit)
    .map((group) => {
      const [label] = [...group.spellings.entries()].sort(
        ([, a], [, b]) => b.count - a.count || compareRecency(b, a)
      )[0];
      return { label, bucket: group.latest.bucket };
    });
}

/**
 * The chips shown on the entry screen: the user's own frequent descriptions
 * first, then starters (skipping any the history already has) until `limit`.
 * The "+ Outro" chip is not counted here; the UI always adds it.
 */
export function buildEntryChips(
  history: readonly FrequentDescription[],
  starters: readonly FrequentDescription[],
  limit: number
): EntryChip[] {
  const chips: EntryChip[] = history
    .slice(0, limit)
    .map((chip) => ({ ...chip, source: "history" }));

  const seen = new Set(chips.map((chip) => descriptionKey(chip.label)));
  for (const starter of starters) {
    if (chips.length >= limit) break;
    if (seen.has(descriptionKey(starter.label))) continue;
    chips.push({ ...starter, source: "starter" });
  }
  return chips;
}
