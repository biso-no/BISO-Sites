import { listEvents } from "@/app/actions/events"
import { listJobs } from "@/app/actions/jobs"
import { getDepartments } from "@/lib/admin/departments"
import { getCampusData } from "@/app/actions/campus"
import { getGlobalMembershipBenefits } from "@/app/actions/membership"
import { getLocale } from "@/app/actions/locale"
import type { EventWithTranslations } from "@/lib/types/event"
import type { JobWithTranslations } from "@/lib/types/job"
import type { CampusData } from "@/lib/types/campus-data"
import type { Department } from "@/lib/admin/departments"
import type { Locale } from "@/i18n/config"
import { StudentsPageClient } from "./students-page-client"

export const revalidate = 0

export default async function StudentsPage() {
  const locale = (await getLocale()) as Locale

  const [events, jobs, departments, campusData, globalBenefits] = await Promise.all([
    listEvents({ status: "published", limit: 24, locale }),
    listJobs({ status: "published", limit: 24, locale }),
    getDepartments({ active: true, limit: 300 }),
    getCampusData(),
    getGlobalMembershipBenefits()
  ])

  return (
    <StudentsPageClient
      events={Array.isArray(events) ? (events as EventWithTranslations[]) : []}
      jobs={Array.isArray(jobs) ? (jobs as JobWithTranslations[]) : []}
      departments={Array.isArray(departments) ? (departments as Department[]) : []}
      campusData={Array.isArray(campusData) ? (campusData as CampusData[]) : []}
      globalBenefits={globalBenefits}
      locale={locale}
    />
  )
}
