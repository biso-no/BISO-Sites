/**
 * Date parsing for `memberships.startDate` / `memberships.expiryDate`.
 *
 * Both columns are plain strings. The 24SevenOffice product sync writes ISO
 * dates (`2026-12-31`), but rows curated by hand use the Norwegian
 * `DD.MM.YYYY` form (`31.12.2026`). Every reader normalises through here so
 * either form compares, sorts and renders the same way.
 */

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;
const NORWEGIAN_DATE_RE = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/;

function toIsoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  if (!isRealDate) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * The calendar date a membership date string names, as `YYYY-MM-DD`, or
 * `null` when it is not a real date in either supported form.
 *
 * An ISO date-time is read by its date part.
 */
export function normalizeMembershipDate(
  raw: string | null | undefined
): string | null {
  const value = raw?.trim() ?? "";

  const iso = ISO_DATE_RE.exec(value);
  if (iso) {
    return toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const norwegian = NORWEGIAN_DATE_RE.exec(value);
  if (norwegian) {
    return toIsoDate(
      Number(norwegian[3]),
      Number(norwegian[2]),
      Number(norwegian[1])
    );
  }

  return null;
}
