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

/**
 * Published benefits visible now, scoped to a campus (campus first, then
 * national). Reads published rows only and never selects `redemption_value`.
 * Throws on a backend failure; the caller decides how to report it.
 */
export async function getPublicBenefitsForCampus(
  campusId: string | null,
  now: Date = new Date()
): Promise<PublicBenefit[]> {
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
  return benefitsForCampus(
    publicBenefitsFromRows(benefitRows.rows, partnerRows.rows, now),
    campusId
  );
}
