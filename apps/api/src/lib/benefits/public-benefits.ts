import "server-only";
import { type Models, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import {
  BENEFIT_PUBLIC_COLUMNS,
  type BenefitPartnerInput,
  type BenefitRowInput,
  benefitsForCampus,
  type PublicBenefit,
  publicBenefitsFromRows,
} from "@repo/shared/utils/benefit-public";

// Same bounds as the website's reader (apps/web/src/lib/data/benefits.ts).
const BENEFIT_LIMIT = 1000;
const BENEFIT_PARTNER_LIMIT = 500;

// The list is anonymous and identical for every caller, and the app asks for
// it on every visit. Holding the raw rows briefly (per server instance) turns
// a burst of visits into one pair of reads. Only the rows are cached: which
// benefits are visible is still decided with each request's `now`, so a deal
// never outlives its end date. A failed read is never cached.
const CACHE_TTL_MS = 45 * 1000;

interface RawBenefitRows {
  benefits: BenefitRowInput[];
  partners: BenefitPartnerInput[];
}

let cached: { fetchedAt: number; rows: RawBenefitRows } | null = null;

/** Drops the cached rows. For tests. */
export function clearPublicBenefitsCache(): void {
  cached = null;
}

async function readRows(): Promise<RawBenefitRows> {
  const { db } = await createAdminClient();
  const [benefitRows, partnerRows] = await Promise.all([
    db.listRows<BenefitRowInput & Models.Row>("app", "campus_benefits", [
      Query.equal("status", "published"),
      Query.select(["$id", "$createdAt", ...BENEFIT_PUBLIC_COLUMNS]),
      Query.orderDesc("$createdAt"),
      Query.limit(BENEFIT_LIMIT),
    ]),
    db.listRows<BenefitPartnerInput & Models.Row>("app", "benefit_partners", [
      Query.limit(BENEFIT_PARTNER_LIMIT),
    ]),
  ]);
  return { benefits: benefitRows.rows, partners: partnerRows.rows };
}

async function cachedRows(): Promise<RawBenefitRows> {
  const fetchedAt = Date.now();
  if (cached && fetchedAt - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rows;
  }
  const rows = await readRows();
  cached = { fetchedAt, rows };
  return rows;
}

/**
 * Published benefits visible now, scoped to a campus (campus first, then
 * national). Reads published rows only and never selects `redemption_value`.
 * Throws on a backend failure; the caller decides how to report it.
 */
export async function getPublicBenefitsForCampus(
  campusId: string | null,
  now: Date = new Date()
): Promise<PublicBenefit[]> {
  const { benefits, partners } = await cachedRows();
  return benefitsForCampus(
    publicBenefitsFromRows(benefits, partners, now),
    campusId
  );
}
