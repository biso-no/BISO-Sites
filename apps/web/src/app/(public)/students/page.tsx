import type { Locale } from "@repo/i18n/config";
import type { RecruitmentVacancy } from "@repo/shared/types/recruitment";
import type { Metadata } from "next";
import { getCampusData } from "@/app/actions/campus";

export const metadata: Metadata = {
  title: "For Students | BISO",
  description:
    "Resources, events, and opportunities for students at BI Norwegian Business School.",
};

import { listEvents } from "@/app/actions/events";
import { listJobs } from "@/app/actions/jobs";
import { getLocale } from "@/app/actions/locale";
import { getGlobalMembershipBenefits } from "@/app/actions/membership";
import { getDepartments } from "@/lib/actions/departments";
import { StudentsPageClient } from "./students-page-client";

export default async function StudentsPage() {
  const locale = (await getLocale()) as Locale;

  const [eventsResult, jobs, departments, campusData, globalBenefits] =
    await Promise.all([
      listEvents({ status: "published", locale }),
      listJobs({ locale }),
      getDepartments({ campusId: "all", locale }),
      getCampusData(),
      getGlobalMembershipBenefits(),
    ]);
  const events = eventsResult.rows;

  return (
    <StudentsPageClient
      campusData={campusData}
      departments={departments}
      events={events}
      globalBenefits={globalBenefits}
      jobs={jobs.rows as RecruitmentVacancy[]}
      locale={locale}
    />
  );
}
