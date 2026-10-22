import { NATIONAL_CAMPUS_ID } from "./benefit-catalog";

export type BenefitDisplayState =
  | "visible"
  | "draft"
  | "scheduled"
  | "expired"
  | "ended"
  | "hidden";

export interface BenefitVisibilityFields {
  partner_id?: string | null;
  publish_end?: string | null;
  publish_start?: string | null;
  status: string;
}

export interface PartnerActivity {
  is_active?: boolean | null;
}

export interface OrderableBenefit {
  $createdAt: string;
  campus_id: string;
  sort_order?: number | null;
}

/** Epoch ms for a date string, or null when absent or unparseable. */
function parseDate(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

export function benefitDisplayState(
  benefit: BenefitVisibilityFields,
  partner: PartnerActivity | null | undefined,
  now: Date
): BenefitDisplayState {
  if (benefit.status === "draft") {
    return "draft";
  }
  if (benefit.status !== "published") {
    return "hidden";
  }
  if (benefit.partner_id && (!partner || partner.is_active === false)) {
    return "ended";
  }
  const nowMs = now.getTime();
  const start = parseDate(benefit.publish_start);
  if (start !== null && start > nowMs) {
    return "scheduled";
  }
  const end = parseDate(benefit.publish_end);
  if (end !== null && end <= nowMs) {
    return "expired";
  }
  return "visible";
}

export function isBenefitVisible(
  benefit: BenefitVisibilityFields,
  partner: PartnerActivity | null | undefined,
  now: Date
): boolean {
  return benefitDisplayState(benefit, partner, now) === "visible";
}

function createdMs(value: string): number {
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? 0 : ms;
}

export function orderBenefitsCampusFirst<T extends OrderableBenefit>(
  rows: readonly T[],
  campusId: string | null | undefined
): T[] {
  const groupOf = (row: T): number => {
    if (campusId && row.campus_id === campusId) {
      return 0;
    }
    return row.campus_id === NATIONAL_CAMPUS_ID ? 1 : 2;
  };
  return [...rows].sort(
    (a, b) =>
      groupOf(a) - groupOf(b) ||
      (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
      createdMs(a.$createdAt) - createdMs(b.$createdAt)
  );
}
