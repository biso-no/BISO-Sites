/**
 * Maps `memberships` rows (synced from 24SevenOffice by
 * `syncMembershipsFrom24SO`) into the plan shape the purchase flow and the
 * invoice builder consume.
 *
 * `membership_id` holds the 24SO `ProductId` — the value invoice rows require.
 * It is NOT the `ProductNo` (1009/2004/3004) shown in the 24SO UI.
 */

export type MembershipDuration = "semester" | "year" | "three_years";

/** The duration surfaced as "Popular" everywhere a plan picker renders one. */
export const POPULAR_MEMBERSHIP_DURATION: MembershipDuration = "year";

/** Shared NOK formatter for every membership price display (purchase flow,
 * member portal CTA, admin). Always nb-NO regardless of UI locale — same
 * convention as the shop checkout's own currency formatting. */
export const membershipPriceFormatter = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  maximumFractionDigits: 0,
});

export interface MembershipPlan {
  accrualMonths: 6 | 12 | 36;
  categoryId: number;
  duration: MembershipDuration;
  expiryDate: string;
  id: string;
  name: string;
  price: number;
  productId: number;
  startDate: string;
}

export interface MembershipRowLike {
  $id: string;
  canPurchase?: boolean;
  category?: string | null;
  expiryDate: string;
  membership_id: string;
  name: string;
  price?: number | null;
  startDate: string;
  status?: boolean;
}

export const MEMBERSHIP_DIMENSION_IDS: Record<MembershipDuration, string> = {
  semester: "100",
  year: "200",
  three_years: "300",
};

export const MEMBERSHIP_DIMENSION_LABELS: Record<MembershipDuration, string> = {
  semester: "Semester",
  year: "Year",
  three_years: "3 Years",
};

const ACCRUAL_OPTIONS = [6, 12, 36] as const;

const DURATION_BY_ACCRUAL: Record<6 | 12 | 36, MembershipDuration> = {
  6: "semester",
  12: "year",
  36: "three_years",
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
const DOTTED_DATE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;

/**
 * Parse the two date shapes a `memberships` row can hold, in UTC.
 *
 * **`new Date(string)` is not safe here.** The live catalogue is synced from
 * 24SevenOffice as `DD.MM.YYYY` — "01.07.2026", "31.12.2026" — which V8 does
 * not understand. `31.12.2026` parsed as an Invalid Date, so the Semester plan
 * was dropped from the catalogue and the 350 kr membership could not be
 * bought; the other two plans only survived because "01.07.20XX" was misread
 * as *January 7* on both sides, leaving the month difference accidentally
 * correct. Anything with a day past the 12th had no such luck.
 *
 * ISO is accepted too: the admin UI and older rows write `YYYY-MM-DD`.
 */
function parseMembershipDate(value: string): Date | null {
  const iso = ISO_DATE.exec(value);
  if (iso) {
    return utcDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }
  const dotted = DOTTED_DATE.exec(value);
  if (dotted) {
    return utcDate(Number(dotted[3]), Number(dotted[2]), Number(dotted[1]));
  }
  return null;
}

/** Builds a UTC date and rejects one that rolled over, e.g. 31 February. */
function utcDate(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date
    : null;
}

/**
 * The start of the accrual period a purchase falls into, as `YYYY-MM-DD`.
 *
 * A membership bought in the summer half of the year accrues from **1 July**;
 * one bought in the spring half accrues from **1 January**. The boundary is
 * read in UTC so the accounting period does not depend on the timezone of
 * whichever host fulfils the order.
 *
 * This is a function of *when the student paid*, not of anything on the
 * catalogue row — which is what `AccrualDate` used to be sent from, so every
 * invoice booked the plan's own fixed start regardless of purchase date, in
 * `DD.MM.YYYY` where the API documents an ISO `date`.
 *
 * Idempotent: an accrual start maps to itself, which is how the invoice
 * builder tells a snapshot written at checkout from a legacy catalogue date.
 */
export function membershipAccrualStart(on: Date | string): string | null {
  const date = typeof on === "string" ? parseMembershipDate(on) : on;
  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }
  const year = date.getUTCFullYear();
  const half = date.getUTCMonth() < 6 ? "01" : "07";
  return `${year}-${half}-01`;
}

/**
 * Snaps the calendar span between the product's parsed start and expiry to the
 * nearest supported accrual length. Product names encode e.g. "fall 2026"
 * (Aug–Dec, 4 calendar months) which must still book as a 6-month accrual.
 *
 * Returns null if either date fails to parse (e.g. corrupted 24SO sync data).
 * Callers must not silently default unparseable dates to a standard accrual.
 */
export function deriveAccrualMonths(
  startDate: string,
  expiryDate: string
): 6 | 12 | 36 | null {
  const start = parseMembershipDate(startDate);
  const expiry = parseMembershipDate(expiryDate);

  if (!(start && expiry)) {
    return null;
  }

  const months =
    (expiry.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (expiry.getUTCMonth() - start.getUTCMonth());

  let closest: 6 | 12 | 36 = ACCRUAL_OPTIONS[0];
  for (const option of ACCRUAL_OPTIONS) {
    // Exact tie (e.g. 24 months equidistant from 12 and 36) resolves to the lower option
    if (Math.abs(option - months) < Math.abs(closest - months)) {
      closest = option;
    }
  }
  return closest;
}

export function toMembershipPlan(
  row: MembershipRowLike
): MembershipPlan | null {
  const productId = Number.parseInt(row.membership_id, 10);
  if (!Number.isFinite(productId)) {
    return null;
  }

  const categoryId = row.category
    ? Number.parseInt(row.category, 10)
    : Number.NaN;
  if (!Number.isFinite(categoryId)) {
    return null;
  }

  const price = Number(row.price ?? 0);
  if (!(Number.isFinite(price) && price > 0)) {
    return null;
  }

  const accrualMonths = deriveAccrualMonths(row.startDate, row.expiryDate);
  if (accrualMonths === null) {
    return null;
  }

  return {
    id: row.$id,
    name: row.name,
    price,
    productId,
    categoryId,
    duration: DURATION_BY_ACCRUAL[accrualMonths],
    accrualMonths,
    startDate: row.startDate,
    expiryDate: row.expiryDate,
  };
}
