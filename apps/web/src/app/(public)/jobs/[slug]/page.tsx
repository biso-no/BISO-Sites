import { getJobBySlug } from '@/app/actions/jobs'
import { getLocale } from '@/app/actions/locale'
import { Button } from '@repo/ui/components/ui/button'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { JobApplicationForm } from '@/components/jobs/job-application-form'

export default async function JobDetailBySlug({ params }: { 
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  
  // Get user's preferred locale from their account preferences
  const locale = await getLocale()
  const job = await getJobBySlug(slug, locale)
  
  if (!job) return notFound()
  if (job.status && job.status !== 'published' && job.status !== 'closed') {
    return notFound()
  }
  
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">{job.title}</h1>
        <p className="text-muted-foreground">
          {job.campus?.name || job.campus_id} • {job.department?.Name} • {job.type}
        </p>
        {job.status === 'closed' && (
          <p className="text-sm text-red-600">{locale === 'no' ? 'Søknadsfrist utløpt – stillingen er lukket' : 'This role is closed'}</p>
        )}
        {job.application_deadline && (
          <p className="text-sm text-orange-600">
            Application deadline: {new Date(job.application_deadline).toLocaleDateString()}
          </p>
        )}
      </header>
      
      <article className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: job.description || '' }} />
      
      {job.contact_email && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Contact Information</h2>
          <div className="space-y-2">
            {job.contact_name && <p><strong>Contact:</strong> {job.contact_name}</p>}
            <p><strong>Email:</strong> {job.contact_email}</p>
          </div>
        </section>
      )}
      
      <section className="space-y-6">
        <div className="flex gap-3">
          {job.apply_url && (
            <Button asChild variant="outline">
              <Link href={job.apply_url} target="_blank" rel="noopener noreferrer">
                {locale === 'no' ? 'Ekstern søknad' : 'External Application'}
              </Link>
            </Button>
          )}
          
          <Button variant="outline" asChild>
            <Link href="/jobs">
              {locale === 'no' ? '← Tilbake til stillinger' : '← Back to Jobs'}
            </Link>
          </Button>
        </div>
        
        {/* Application Form */}
        <JobApplicationForm job={job} locale={locale} />
      </section>
    </div>
  )
}

