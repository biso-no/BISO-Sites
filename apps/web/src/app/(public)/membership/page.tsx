import type { Locale } from "@repo/i18n/config";
import type { Metadata } from "next";
import { getCampusData } from "@/app/actions/campus";
import { getLocale } from "@/app/actions/locale";

export const metadata: Metadata = {
  title: "BISO Membership | BI Student Organisation",
  description:
    "Become a BISO member and unlock benefits, discounts, and access to events across BI Norwegian Business School.",
};

import { getGlobalMembershipBenefits } from "@/app/actions/membership";
import { getUserPreferences } from "@/lib/auth-utils";
import type { CampusData } from "@/lib/types/campus-data";
import { MembershipPageClient } from "./membership-page-client";

export const revalidate = 0;

export default async function MembershipPage() {
  const prefs = await getUserPreferences();

  const [campusData, globalBenefits, locale] = await Promise.all([
    getCampusData(prefs?.campusId),
    getGlobalMembershipBenefits(),
    getLocale(),
  ]);

  return (
    <MembershipPageClient
      campusData={Array.isArray(campusData) ? (campusData as CampusData[]) : []}
      globalBenefits={globalBenefits}
      locale={(locale as Locale) ?? "no"}
    />
  );
}
