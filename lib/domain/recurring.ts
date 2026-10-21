const PERIOD_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

/**
 * Due date ("YYYY-MM-DD") of a recurring expense in `period` ("YYYY-MM").
 * A `dayOfMonth` past the month's last day falls on the last day instead
 * (31 → 30 in April, 28/29 in February) — design.md D1.
 */
export function resolveDueDate(period: string, dayOfMonth: number): string {
  const match = PERIOD_PATTERN.exec(period);
  if (!match) {
    throw new Error(`Período inválido: "${period}" (esperado YYYY-MM).`);
  }
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
    throw new Error(`Dia do vencimento inválido: ${dayOfMonth} (esperado 1 a 31).`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  // Dia 0 do mês seguinte = último dia deste mês.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(dayOfMonth, lastDay);

  return `${match[1]}-${match[2]}-${String(day).padStart(2, "0")}`;
}

/** Both "YYYY-MM-DD". A due date that is today has not passed yet. */
export function isDuePassed(dueDate: string, today: string): boolean {
  return dueDate < today;
}
