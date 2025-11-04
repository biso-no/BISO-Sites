import type { ContentTranslations } from '@repo/api/types/appwrite'

export interface JobMetadata {
  category?: string
  paid?: boolean
  salary?: string
  openings?: number
  responsibilities?: string[]
  requirements?: string[]
  deadline?: string
  type?: string
  start_date?: string
  contact_name?: string
  contact_email?: string
  apply_url?: string
  image?: string
  [key: string]: unknown
}

export const jobCategories = [
  'Academic Associations',
  'Societies', 
  'Staff Functions',
  'Projects'
] as const

export type JobCategory = typeof jobCategories[number]

export function parseJobMetadata(metadataString: string | null | undefined): JobMetadata {
  if (!metadataString) return {}
  
  try {
    return JSON.parse(metadataString)
  } catch {
    return {}
  }
}

export function getJobCategory(metadata: JobMetadata): JobCategory {
  const category = metadata.category as JobCategory
  return jobCategories.includes(category) ? category : 'Staff Functions'
}

export function formatSalary(salary: string | number | null | undefined): string | null {
  if (!salary) return null
  return typeof salary === 'string' ? salary : `${salary} NOK`
}
