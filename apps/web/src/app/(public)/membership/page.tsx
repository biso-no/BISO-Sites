import type { Locale } from "@repo/i18n/config";
import type { Metadata } from "next";
import { getCampusData } from "@/app/actions/campus";
import { getLocale } from "@/app/actions/locale";

export const metadata: Metadata = {
  title: "BISO Membership | BI Student Organisation",
  description:
    "Become a BISO member and unlock benefits, discounts, and access to events across BI Norwegian Business School.",
};

import { getUserPreferences } from "@/lib/auth-utils";
import { getPublicBenefits } from "@/lib/data/benefits";
import type { CampusData } from "@/lib/types/campus-data";
import { MembershipPageClient } from "./membership-page-client";

// `getPublicBenefits` waits for the request (`connection()`), so this page must
// be allowed to block, like `/students` and `/campus`.
export const instant = false;

export default async function MembershipPage() {
  const prefs = await getUserPreferences();

  const [campusData, benefits, locale] = await Promise.all([
    getCampusData(prefs?.campusId),
    // Throws on a backend failure; the fallback lives at the call site.
    getPublicBenefits().catch(() => []),
    getLocale(),
  ]);

  return (
    <MembershipPageClient
      benefits={benefits}
      campusData={Array.isArray(campusData) ? (campusData as CampusData[]) : []}
      locale={(locale as Locale) ?? "no"}
    />
  );
}
