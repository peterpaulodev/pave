const DAY_MS = 24 * 60 * 60 * 1000;

function toDayNumber(date: string): number {
  return Math.round(Date.parse(`${date}T00:00:00.000Z`) / DAY_MS);
}

/**
 * Consecutive registered days ending today ("YYYY-MM-DD" strings). If today
 * isn't registered yet the streak ends yesterday, so it doesn't reset at
 * midnight (design.md D8). Duplicates, ordering and future dates are ignored.
 */
export function computeStreak(dates: string[], today: string): number {
  const todayNumber = toDayNumber(today);
  const days = new Set(
    dates.map(toDayNumber).filter((day) => day <= todayNumber)
  );

  let cursor = days.has(todayNumber) ? todayNumber : todayNumber - 1;
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= 1;
  }

  return streak;
}
