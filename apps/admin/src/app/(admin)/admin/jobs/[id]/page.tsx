import { getJob } from '@/app/actions/jobs'
import { listCampuses, listDepartments } from '@/app/actions/events'
import JobEditor from '../shared/JobEditor'
import Link from 'next/link'

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [job, campuses, departments] = await Promise.all([
    getJob(id),
    listCampuses(),
    listDepartments(),
  ])
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/admin/jobs/${id}`} className="font-medium">Editor</Link>
        <Link href={`/admin/jobs/${id}/applications`} className="text-muted-foreground hover:text-foreground">Applications</Link>
      </div>
      <JobEditor job={job as any} campuses={campuses as any} departments={departments as any} />
    </div>
  )
}
