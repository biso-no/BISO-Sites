import { listEvents } from '@/app/actions/events'
import { listJobs } from '@/app/actions/jobs'
import { listNews } from '@/app/actions/news'
import { getDepartments } from '@/lib/actions/departments'
import { getCampusData, getCampusMetadata } from '@/app/actions/campus'
import { getLocale } from '@/app/actions/locale'
import type { CampusData } from '@/lib/types/campus-data'
import type { ContentTranslations, Departments } from '@repo/api/types/appwrite'
import type { Locale } from '@/i18n/config'
import { CampusPageClient } from './client'

export const revalidate = 0

export default async function CampusPage() {
  const [events, jobs, news, departments, campusData, campusMetadata, locale] = await Promise.all([
    listEvents({ status: 'publish', limit: 100 }),
    listJobs({ status: 'open', limit: 100 }),
    listNews({ limit: 12 }),
    getDepartments({ isActive: true }),
    getCampusData(),
    getCampusMetadata(),
    getLocale()
  ])

  return (
    <CampusPageClient
      events={Array.isArray(events) ? (events as ContentTranslations[]) : []}
      jobs={Array.isArray(jobs) ? (jobs as ContentTranslations[]) : []}
      news={Array.isArray(news) ? (news as ContentTranslations[]) : []}
      departments={Array.isArray(departments) ? (departments as unknown as Departments[]) : []}
      campusData={Array.isArray(campusData) ? (campusData as CampusData[]) : []}
      campusMetadata={campusMetadata}
      locale={locale as Locale}
    />
  )
}