// Calendar-day helpers for reimbursement booking dates. Receipt dates are
// stored as Appwrite datetimes, but the booking date is a calendar day in the
// Europe/Oslo time zone.

const OSLO_TIME_ZONE = "Europe/Oslo";

const osloDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: OSLO_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

// Fails loudly if the runtime's ICU data ever formats the day differently.
function formatOsloDay(date: Date): string {
  const formatted = osloDay.format(date);
  if (!ISO_DAY.test(formatted)) {
    throw new Error(`Unexpected Oslo date format: "${formatted}"`);
  }
  return formatted;
}

/** The Oslo calendar day (`YYYY-MM-DD`) of an Appwrite datetime string. */
export function receiptDateInOslo(
  value: string | null | undefined
): string | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return formatOsloDay(parsed);
}

/** Today's Oslo calendar day (`YYYY-MM-DD`). */
export function todayInOslo(now: Date = new Date()): string {
  return formatOsloDay(now);
}
