import { benefitsForCampus } from "@repo/shared/utils/benefit-public";
import { getPurchasableMembershipPlans } from "@repo/shared/utils/membership-catalog";
import { onePerDuration } from "@repo/shared/utils/membership-seasons";
import type { Metadata } from "next";
import { getLocale } from "@/app/actions/locale";
import { MembershipV2 } from "@/components/membership/v2/membership-v2";
import { getUserPreferences } from "@/lib/auth-utils";
import { getPublicBenefits } from "@/lib/data/benefits";
import { cachedShellCampuses } from "@/lib/data/public-content";

export const metadata: Metadata = {
  title: "BISO Membership | BI Student Organisation",
  description:
    "Become a BISO member and unlock benefits, discounts, and access to events across BI Norwegian Business School.",
};

// `getPublicBenefits` waits for the request (`connection()`), so this page must
// be allowed to block, like `/students` and `/campus`.
export const instant = false;

/**
 * The redesigned page reads the two tables the old one ignored: the real
 * membership catalog (prices live in `memberships`, not in the message
 * bundle) and `campus_benefits`, which only the signed-in portal read.
 */
export default async function MembershipPage() {
  const prefs = await getUserPreferences();
  const campusId = prefs?.campusId ?? null;

  const [plans, benefits, locale, campuses] = await Promise.all([
    // What someone with no membership may buy now, one card per duration —
    // labelled by duration only, as the portal's cards are. The join wizard
    // offers the this/next-season choice. A catalog outage drops the price
    // cards for this render only; every CTA still leads to the join flow.
    getPurchasableMembershipPlans()
      .then(onePerDuration)
      .catch(() => []),
    // Throws on a backend failure; the fallback lives at the call site.
    getPublicBenefits().catch(() => []),
    getLocale(),
    // A cached reader throws on a transient failure; the fallback is here,
    // for this render only: the page titles itself without a campus.
    cachedShellCampuses().catch(() => []),
  ]);

  return (
    <MembershipV2
      benefits={benefitsForCampus(benefits, campusId)}
      campusName={campuses.find((c) => c.$id === campusId)?.name ?? null}
      locale={locale}
      plans={plans}
    />
  );
}
