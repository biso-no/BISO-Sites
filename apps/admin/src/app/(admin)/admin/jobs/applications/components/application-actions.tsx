"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Download, Trash2, Mail } from 'lucide-react'
import { JobApplication } from '@/lib/types/job-application'
import { updateJobApplicationStatus, exportJobApplicationData, deleteJobApplicationData } from '@/app/actions/jobs'
import { toast } from '@/lib/hooks/use-toast'
import { useRouter } from 'next/navigation'

interface ApplicationActionsProps {
  application: JobApplication
}

export function ApplicationActions({ application }: ApplicationActionsProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleStatusUpdate = async (newStatus: JobApplication['status']) => {
    setIsLoading(true)
    try {
      await updateJobApplicationStatus(application.$id, newStatus)
      toast({ title: 'Application status updated' })
      router.refresh()
    } catch (error) {
      toast({ title: 'Error updating status', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportData = async () => {
    try {
      const data = await exportJobApplicationData(application.$id)
      if (data) {
        // Create downloadable JSON file
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `application-${application.$id}-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        
        toast({ title: 'Application data exported' })
      }
    } catch (error) {
      toast({ title: 'Error exporting data', variant: 'destructive' })
    }
  }

  const handleDeleteData = async () => {
    if (!confirm('Are you sure you want to permanently delete this application data? This action cannot be undone.')) {
      return
    }
    
    setIsLoading(true)
    try {
      const success = await deleteJobApplicationData(application.$id)
      if (success) {
        toast({ title: 'Application data deleted' })
        router.refresh()
      } else {
        throw new Error('Failed to delete')
      }
    } catch (error) {
      toast({ title: 'Error deleting data', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Quick status update buttons */}
      {application.status === 'submitted' && (
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => handleStatusUpdate('reviewed')}
          disabled={isLoading}
        >
          Mark Reviewed
        </Button>
      )}
      
      {application.status === 'reviewed' && (
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => handleStatusUpdate('interview')}
          disabled={isLoading}
        >
          Schedule Interview
        </Button>
      )}
      
      {/* Contact applicant */}
      <Button size="sm" variant="outline" asChild>
        <a href={`mailto:${application.applicant_email}?subject=Re: Application for Job`}>
          <Mail className="h-4 w-4" />
        </a>
      </Button>
      
      {/* More actions menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleStatusUpdate('accepted')}>
            Mark as Accepted
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleStatusUpdate('rejected')}>
            Mark as Rejected
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExportData}>
            <Download className="h-4 w-4 mr-2" />
            Export Data (GDPR)
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={handleDeleteData}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Data (GDPR)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
