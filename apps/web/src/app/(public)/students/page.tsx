import type {
  ContentTranslations,
  Departments,
} from "@repo/api/types/appwrite";
import { getCampusData } from "@/app/actions/campus";
import { listEvents } from "@/app/actions/events";
import { listJobs } from "@/app/actions/jobs";
import { getLocale } from "@/app/actions/locale";
import { getGlobalMembershipBenefits } from "@/app/actions/membership";
import type { Locale } from "@/i18n/config";
import { getDepartments } from "@/lib/actions/departments";
import type { CampusData } from "@/lib/types/campus-data";
import { StudentsPageClient } from "./students-page-client";

export const revalidate = 0;

export default async function StudentsPage() {
  const locale = (await getLocale()) as Locale;

  const [events, jobs, departments, campusData, globalBenefits] =
    await Promise.all([
      listEvents({ status: "published", limit: 24, locale }),
      listJobs({ status: "published", limit: 24, locale }),
      getDepartments({ campusId: "all" }),
      getCampusData(),
      getGlobalMembershipBenefits(),
    ]);

  return (
    <StudentsPageClient
      events={events}
      jobs={jobs}
      departments={departments}
      campusData={campusData}
      globalBenefits={globalBenefits}
      locale={locale}
    />
  );
}
