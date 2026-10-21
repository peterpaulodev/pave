/** "3/5 · 60%" — numerator, denominator and percentage together, because
 * with few users the percentage alone misleads (design.md D6). "—" when the
 * denominator is zero. */
export function formatRatio(numerator: number, denominator: number): string {
  if (denominator <= 0) return "—";
  const percent = Math.round((numerator / denominator) * 100);
  return `${numerator}/${denominator} · ${percent}%`;
}

/** Parses the comma-separated ADMIN_USER_IDS value: trims, drops empty
 * entries and duplicates. Unset or blank → no admins. */
export function parseAdminIds(envValue: string | undefined): string[] {
  if (!envValue) return [];
  const ids = envValue
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  return [...new Set(ids)];
}

export function isAdmin(userId: string, envValue: string | undefined): boolean {
  if (!userId) return false;
  return parseAdminIds(envValue).includes(userId);
}
