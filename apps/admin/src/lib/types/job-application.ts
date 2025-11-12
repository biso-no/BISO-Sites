import { Models } from '@repo/api'

export interface JobApplication extends Models.Row {
  job_id: string
  applicant_name: string
  applicant_email: string
  applicant_phone?: string
  cover_letter?: string
  status: 'submitted' | 'reviewed' | 'interview' | 'accepted' | 'rejected'
  gdpr_consent: boolean
  consent_date: string
  data_processing_purpose: string
  data_retention_until: string
  resume_file_id?: string
  // Relationship references (populated at runtime)
  job?: {
    $id: string
    title: string
    campus_id: string
    department_id: string
    locale: string
  }
}

export interface JobApplicationFormData {
  applicant_name: string
  applicant_email: string
  applicant_phone?: string
  cover_letter?: string
  gdpr_consent: boolean
  resume?: File
}
