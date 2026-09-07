import type { Metadata } from "next";
import { getLocale } from "@/app/actions/locale";
import { getMemberPortalBenefits } from "@/app/actions/member-portal";
import { MembershipV2 } from "@/components/membership/v2/membership-v2";
import { getUserPreferences } from "@/lib/auth-utils";
import { cachedShellCampuses } from "@/lib/data/public-content";
import { getPurchasableMembershipPlans } from "@/lib/membership-catalog";

export const metadata: Metadata = {
  title: "BISO Membership | BI Student Organisation",
  description:
    "Become a BISO member and unlock benefits, discounts, and access to events across BI Norwegian Business School.",
};

/**
 * The redesigned page reads the two tables the current one ignores: the real
 * membership catalog (prices live in `memberships`, not in the message
 * bundle) and `campus_benefits`, which only the signed-in portal read.
 */
export default async function MembershipPage() {
  const prefs = await getUserPreferences();
  const campusId = prefs?.campusId ?? null;

  const [plans, benefits, locale, campuses] = await Promise.all([
    getPurchasableMembershipPlans(),
    getMemberPortalBenefits(campusId),
    getLocale(),
    cachedShellCampuses(),
  ]);

  return (
    <MembershipV2
      benefits={benefits}
      campusName={campuses.find((c) => c.$id === campusId)?.name ?? null}
      locale={locale}
      plans={plans}
    />
  );
}
