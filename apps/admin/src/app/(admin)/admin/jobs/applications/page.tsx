import { listJobApplications, listJobs } from '@/app/actions/jobs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ApplicationStatusBadge } from './components/application-status-badge'
import { ApplicationActions } from './components/application-actions'

export default async function JobApplicationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams
  const jobId = params.job_id
  
  const [applications, jobs] = await Promise.all([
    listJobApplications(jobId),
    listJobs({ limit: 100 })
  ])
  
  const jobsMap = new Map(jobs.map(job => [job.$id, job]))

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Job Applications</h1>
          <p className="text-muted-foreground">
            {applications.length} application{applications.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/jobs">← Back to Jobs</Link>
        </Button>
      </header>

      <div className="space-y-4">
        {applications.map(application => {
          const job = jobsMap.get(application.job_id)
          return (
            <Card key={application.$id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold">{application.applicant_name}</h3>
                      <ApplicationStatusBadge status={application.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">{application.applicant_email}</p>
                    {application.applicant_phone && (
                      <p className="text-sm text-muted-foreground">{application.applicant_phone}</p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Applied: {new Date(application.$createdAt).toLocaleDateString()}</span>
                      {job && <span>• Position: {job.title}</span>}
                    </div>
                  </div>
                  
                  <ApplicationActions application={application} />
                </div>
                
                {application.cover_letter && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-medium mb-2">Cover Letter</h4>
                    <p className="text-sm whitespace-pre-wrap">{application.cover_letter}</p>
                  </div>
                )}
                
                {/* GDPR Information */}
                <div className="mt-4 pt-4 border-t bg-muted/30 -mx-6 -mb-6 px-6 py-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Data retention until: {new Date(application.data_retention_until).toLocaleDateString()}</span>
                    <span>Consent given: {new Date(application.consent_date).toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
        
        {applications.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">No applications found.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}