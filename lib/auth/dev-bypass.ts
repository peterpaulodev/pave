/**
 * Development-only auth bypass. Returns the user id to impersonate only when
 * NODE_ENV is exactly "development" AND DEV_AUTH_BYPASS_USER_ID is set; in
 * every other case (production, preview, test, unset) it returns null and
 * the bypass has no effect. Reads `process.env` directly so the bundler can
 * inline NODE_ENV and drop the branch from production builds.
 */
export function getDevAuthBypassUserId(): string | null {
  if (process.env.NODE_ENV !== "development") return null;
  const userId = process.env.DEV_AUTH_BYPASS_USER_ID?.trim();
  return userId ? userId : null;
}
