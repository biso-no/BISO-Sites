import { listEvents } from '@/app/actions/events'
import { listJobs } from '@/app/actions/jobs'
import { listNews } from '@/app/actions/news'
import { getDepartments, type Department as DepartmentRecord } from '@/lib/admin/departments'
import { getCampusData, getCampusMetadata } from '@/app/actions/campus'
import { getLocale } from '@/app/actions/locale'
import type { CampusData } from '@/lib/types/campus-data'
import type { Event } from '@/lib/types/event'
import type { Job } from '@/lib/types/job'
import type { NewsItem, NewsItemWithTranslations } from '@/lib/types/news'
import type { Locale } from '@/i18n/config'
import { CampusPageClient } from './campus-page-client'

export const revalidate = 0

export default async function CampusPage() {
  const [events, jobs, news, departments, campusData, campusMetadata, locale] = await Promise.all([
    listEvents({ status: 'publish', limit: 100 }),
    listJobs({ status: 'published', limit: 100 }),
    listNews({ limit: 12 }),
    getDepartments({ active: true, limit: 300 }),
    getCampusData(),
    getCampusMetadata(),
    getLocale()
  ])

  return (
    <CampusPageClient
      events={Array.isArray(events) ? (events as Event[]) : []}
      jobs={Array.isArray(jobs) ? (jobs as Job[]) : []}
      news={Array.isArray(news) ? (news as NewsItem[]) : []}
      departments={Array.isArray(departments) ? (departments as DepartmentRecord[]) : []}
      campusData={Array.isArray(campusData) ? (campusData as CampusData[]) : []}
      campusMetadata={campusMetadata}
      locale={locale as Locale}
    />
  )
}
