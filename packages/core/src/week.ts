const DAY_MS = 86_400_000;

/** The Monday (UTC) of the ISO week containing `date`, as "YYYY-MM-DD". */
export function weekStart(date: Date): string {
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid date");
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const sinceMonday = (date.getUTCDay() + 6) % 7; // Mon = 0 ... Sun = 6
  return new Date(midnight - sinceMonday * DAY_MS).toISOString().slice(0, 10);
}