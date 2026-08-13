/**
 * Maps `memberships` rows (synced from 24SevenOffice by
 * `syncMembershipsFrom24SO`) into the plan shape the purchase flow and the
 * invoice builder consume.
 *
 * `membership_id` holds the 24SO `ProductId` — the value invoice rows require.
 * It is NOT the `ProductNo` (1009/2004/3004) shown in the 24SO UI.
 */

export type MembershipDuration = "semester" | "year" | "three_years";

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
  const start = new Date(startDate);
  const expiry = new Date(expiryDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(expiry.getTime())) {
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
