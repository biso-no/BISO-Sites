import type { Locale } from "@repo/i18n/config";
import { getCampusData } from "@/app/actions/campus";
import { getLocale } from "@/app/actions/locale";
import { getGlobalMembershipBenefits } from "@/app/actions/membership";
import type { CampusData } from "@/lib/types/campus-data";
import { MembershipPageClient } from "./membership-page-client";
import { getUserPreferences } from "@/lib/auth-utils";

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
