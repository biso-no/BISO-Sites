import { listEvents } from "@/app/actions/events"
import { listJobs } from "@/app/actions/jobs"
import { getDepartments } from "@/lib/actions/departments"
import { getCampusData } from "@/app/actions/campus"
import { getGlobalMembershipBenefits } from "@/app/actions/membership"
import { getLocale } from "@/app/actions/locale"
import type { ContentTranslations, Departments } from "@repo/api/types/appwrite"
import type { CampusData } from "@/lib/types/campus-data"
import type { Locale } from "@/i18n/config"
import { StudentsPageClient } from "./students-page-client"

export const revalidate = 0

export default async function StudentsPage() {
  const locale = (await getLocale()) as Locale

  const [events, jobs, departments, campusData, globalBenefits] = await Promise.all([
    listEvents({ status: "published", limit: 24, locale }),
    listJobs({ status: "published", limit: 24, locale }),
    getDepartments({ campusId: "all" }),
    getCampusData(),
    getGlobalMembershipBenefits()
  ])

  return (
    <StudentsPageClient
      events={Array.isArray(events) ? (events as ContentTranslations[]) : []}
      jobs={Array.isArray(jobs) ? (jobs as ContentTranslations[]) : []}
      departments={Array.isArray(departments) ? (departments as unknown as Departments[]) : []}
      campusData={Array.isArray(campusData) ? (campusData as CampusData[]) : []}
      globalBenefits={globalBenefits}
      locale={locale}
    />
  )
}
