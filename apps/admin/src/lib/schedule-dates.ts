/**
 * Calendar-day keys for the scheduling grids, in the browser's local zone.
 *
 * `toISOString().slice(0, 10)` names the UTC day, and local midnight in
 * Oslo is still the previous day in UTC — so every interview was saved a
 * day before the one clicked.
 */

const pad = (value: number) => String(value).padStart(2, "0");

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The start of an hour slot on a local calendar day. */
export function slotStart(dateKey: string, hour: number): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, hour, 0, 0, 0);
}

/** Grid cell key of a slot: `<local day>-<local hour>`. */
export function slotKey(date: Date): string {
  return `${localDateKey(date)}-${date.getHours()}`;
}
