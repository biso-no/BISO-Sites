import { listJobs, listDepartments, listCampuses } from '@/app/actions/jobs'
import { getLocale } from '@/app/actions/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card'
import { Input } from '@repo/ui/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/ui/select'
import Link from 'next/link'

export default async function JobsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams
  // Public listing shows published jobs only
  const status = 'published'
  const campus = params.campus || 'all'
  const interest = params.interest || 'all'
  const q = params.q
  
  // Get user's preferred locale from their account preferences
  const locale = await getLocale()
  
  const campusFilter = campus !== 'all' ? campus : undefined
  const interestFilter = interest !== 'all' ? [interest] : undefined
  
  const jobs = await listJobs({ 
    limit: 50, 
    status, 
    campus: campusFilter, 
    search: q, 
    locale 
  })
  
  const departments = await listDepartments(campusFilter)
  const campuses = await listCampuses()
  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Open Positions</h1>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Find a role</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-5">
          <form className="contents">
            <Input defaultValue={q || ''} name="q" placeholder="Search by title..." className="md:col-span-2" />
            {/* Status fixed to published for public listing */}
            <Select name="campus" defaultValue={campus}>
              <SelectTrigger>
                <SelectValue placeholder="Campus" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All campuses</SelectItem>
                {campuses.map(c => (
                  <SelectItem key={c.$id} value={c.$id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select name="interest" defaultValue={interest}>
              <SelectTrigger>
                <SelectValue placeholder="Interest" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All interests</SelectItem>
                {(departments || []).map(d => (
                  <SelectItem key={d.$id} value={d.Name}>{d.Name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button type="submit" className="hidden" />
          </form>
        </CardContent>
      </Card>
      <div className="grid gap-4">
        {jobs.map(job => (
          <Card key={job.$id} className="bg-background/50 backdrop-blur-sm border-primary/10 hover:border-primary/20 transition-colors overflow-hidden">
            <CardContent className="p-4">
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-lg">{job.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">{job.description?.replace(/<[^>]+>/g, '').slice(0, 180)}...</p>
                  </div>
                  <span className="text-xs uppercase px-2 py-1 rounded bg-green-600/10 text-green-600">{job.status}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {job.campus?.name || job.campus_id} • {job.department?.Name} • Deadline: {job.application_deadline ? new Date(job.application_deadline).toLocaleDateString() : '—'}
                </div>
              </div>
            </CardContent>
            <div className="px-4 py-3 border-t bg-muted/20 flex justify-end">
              <Link href={`/jobs/${job.slug}`} className="text-sm underline hover:no-underline">View details</Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
} 
