"use client"

import { Badge } from '@/components/ui/badge'
import { JobApplication } from '@/lib/types/job-application'

interface ApplicationStatusBadgeProps {
  status: JobApplication['status']
}

export function ApplicationStatusBadge({ status }: ApplicationStatusBadgeProps) {
  const statusConfig = {
    submitted: { label: 'Submitted', variant: 'secondary' as const },
    reviewed: { label: 'Reviewed', variant: 'outline' as const },
    interview: { label: 'Interview', variant: 'default' as const },
    accepted: { label: 'Accepted', variant: 'default' as const },
    rejected: { label: 'Rejected', variant: 'destructive' as const }
  }

  const config = statusConfig[status] || statusConfig.submitted

  return (
    <Badge variant={config.variant} className={
      status === 'accepted' ? 'bg-green-100 text-green-800 hover:bg-green-200' : ''
    }>
      {config.label}
    </Badge>
  )
}
