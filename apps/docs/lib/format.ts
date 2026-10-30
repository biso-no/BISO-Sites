const updatedFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Oslo",
});

/** Formats a date as "27 Oct 2026", or null when it is missing or invalid. */
export function formatUpdated(
  date: Date | string | null | undefined
): string | null {
  if (!date) {
    return null;
  }
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return updatedFormat.format(parsed);
}
