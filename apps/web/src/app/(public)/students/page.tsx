import type { Locale } from "@repo/i18n/config";
import { getCampusData } from "@/app/actions/campus";
import { listEvents } from "@/app/actions/events";
import { listJobs } from "@/app/actions/jobs";
import { getLocale } from "@/app/actions/locale";
import { getGlobalMembershipBenefits } from "@/app/actions/membership";
import { getDepartments } from "@/lib/actions/departments";
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
      campusData={campusData}
      departments={departments}
      events={events}
      globalBenefits={globalBenefits}
      jobs={jobs}
      locale={locale}
    />
  );
}
