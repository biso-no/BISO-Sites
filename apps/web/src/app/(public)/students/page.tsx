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

// `students-page-client.tsx` filters this pool by `activeCampusId` and slices
// to 6 per campus, so a flat 12-row fetch (the paginated-surface default) can
// starve less-represented campuses down to a handful of events/jobs, or none.
// This restores the pre-pagination fetch size for this first-N consumer; the
// paginated `/events` and `/jobs` surfaces keep the `WEB_PAGE_SIZE` default.
const STUDENTS_PAGE_SIZE = 24;

export default async function StudentsPage() {
  const locale = (await getLocale()) as Locale;

  const [eventsResult, jobs, departments, campusData, globalBenefits] =
    await Promise.all([
      // Member-only events are included: `queryEvents` no longer scopes the
      // fetch by membership, and the membership pitch on this page is exactly
      // where they belong.
      listEvents({
        pageSize: STUDENTS_PAGE_SIZE,
        status: "published",
        locale,
      }),
      listJobs({ locale, pageSize: STUDENTS_PAGE_SIZE }),
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
