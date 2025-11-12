import { NextResponse } from 'next/server'
import { listJobApplications } from '@/app/actions/jobs'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const jobId = searchParams.get('job_id') || ''
  if (!jobId) {
    return NextResponse.json({ error: 'job_id is required' }, { status: 400 })
  }
  const apps = await listJobApplications(jobId)
  const headers = ['job_id','applicant_name','applicant_email','applicant_phone','applied_at']
  const rows = apps.map((a: any) => headers.map(h => (a?.[h] ?? '')).join(','))
  const csv = [headers.join(','), ...rows].join('\n')
  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="applications-${jobId}.csv"`,
    },
  })
}


