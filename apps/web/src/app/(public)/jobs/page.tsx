import { Suspense } from 'react'
import { listJobs } from '@/app/actions/jobs'
import { getLocale } from '@/app/actions/locale'
import { JobsListClient } from '@/components/jobs/jobs-list-client'
import { JobsHero } from '@/components/jobs/jobs-hero'
import { Skeleton } from '@repo/ui/components/ui/skeleton'
import { parseJobMetadata, jobCategories } from '@/lib/types/job'

// This is a server component
export const metadata = {
  title: 'Join Our Team | BISO',
  description: 'Discover open positions at BISO and join our team',
}

async function JobsList({ locale }: { locale: 'en' | 'no' }) {
  // Fetch jobs on the server
  const jobs = await listJobs({
    locale,
    status: 'published',
    limit: 100,
  })

  // Calculate stats for hero
  const paidPositions = jobs.filter(job => {
    const metadata = parseJobMetadata(job.job_ref?.metadata)
    return metadata.paid === true
  }).length

  const departmentCount = new Set(
    jobs.map(job => job.job_ref?.department_id).filter(Boolean)
  ).size || jobCategories.length

  return (
    <>
      <JobsHero 
        totalPositions={jobs.length}
        paidPositions={paidPositions}
        departmentCount={departmentCount}
      />
      <JobsListClient jobs={jobs} />
    </>
  )
}

function JobsListSkeleton() {
  return (
    <>
      <div className="relative h-[60vh]">
        <Skeleton className="w-full h-full" />
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-2 gap-8">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export default async function JobsPage() {
  const locale = await getLocale()

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
      <Suspense fallback={<JobsListSkeleton />}>
        <JobsList locale={locale} />
      </Suspense>
    </div>
  )
}
