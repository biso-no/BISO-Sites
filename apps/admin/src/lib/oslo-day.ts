// Calendar days in the Europe/Oslo time zone. Receipt dates are stored as
// Appwrite datetimes but mean a calendar day. Mirrors `apps/api/src/lib/receipt-date.ts`.

const osloDay = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Europe/Oslo",
  year: "numeric",
});

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Today's Oslo calendar day (`YYYY-MM-DD`). */
export function todayInOslo(now: Date = new Date()): string {
  const formatted = osloDay.format(now);
  if (!ISO_DAY.test(formatted)) {
    throw new Error(`Unexpected Oslo date format: "${formatted}"`);
  }
  return formatted;
}

/** The Oslo calendar day of an Appwrite datetime string, or null. */
export function osloDayOf(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : todayInOslo(parsed);
}
