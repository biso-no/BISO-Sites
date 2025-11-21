import { getCampusData } from "@/app/actions/campus";
import { getLocale } from "@/app/actions/locale";
import { getGlobalMembershipBenefits } from "@/app/actions/membership";
import type { Locale } from "@/i18n/config";
import type { CampusData } from "@/lib/types/campus-data";
import { MembershipPageClient } from "./membership-page-client";

export const revalidate = 0;

export default async function MembershipPage() {
  const [campusData, globalBenefits, locale] = await Promise.all([
    getCampusData(),
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
