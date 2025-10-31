import { Models } from '@repo/api'
import { ContentTranslation } from './content-translation'

export interface Job extends Models.Row {
  slug: string
  status: 'draft' | 'published' | 'closed'
  campus_id: string
  department_id?: string
  metadata?: string // JSON string for non-translatable data (dates, contact info, etc.)
  // Relationship references (populated at runtime)
  campus?: { $id: string; name: string }
  department?: { $id: string; Name: string; campus_id: string }
  translations?: ContentTranslation[]
  applications?: Array<{
    $id: string
    applicant_name: string
    applicant_email: string
    status: string
    $createdAt: string
  }>
}

// Helper interface for working with job data including translations
export interface JobWithTranslations extends Job {
  // Convenience properties for the current locale
  title?: string
  description?: string
  type?: string
  application_deadline?: string
  start_date?: string
  contact_name?: string
  contact_email?: string
  apply_url?: string
  image?: string
}


