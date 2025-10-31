'use server'

import { createAdminClient, createSessionClient } from '@repo/api/server'
import { Query } from '@repo/api'
import { Job, JobWithTranslations } from '@/lib/types/job'
import { JobApplication, JobApplicationFormData } from '@/lib/types/job-application'
import { ContentTranslation } from '@/lib/types/content-translation'
import { revalidatePath } from 'next/cache'

export interface ListJobsParams {
  limit?: number
  status?: string
  campus?: string
  search?: string
  locale?: 'en' | 'no'
}

export interface CreateJobData {
  slug: string
  status: 'draft' | 'published' | 'closed'
  campus_id: string
  department_id?: string
  metadata?: {
    type?: string
    application_deadline?: string
    start_date?: string
    contact_name?: string
    contact_email?: string
    apply_url?: string
    image?: string
  }
  translations: {
    en?: {
      title: string
      description: string
    }
    no?: {
      title: string
      description: string
    }
  }
}

// Helper function to get translation for a specific locale
function getTranslation(translations: any[], locale: 'en' | 'no'): any | null {
  return translations.find(t => t.locale === locale) || null
}

// Helper function to combine job with its translations using Appwrite's nested relationships
function combineJobWithTranslations(job: Job, locale: 'en' | 'no'): JobWithTranslations {
  const translation = getTranslation(job.translations || [], locale)
  const metadata = job.metadata ? JSON.parse(job.metadata) : {}
  
  return {
    ...job,
    title: translation?.title,
    description: translation?.description,
    ...metadata
  }
}

export async function listJobs(params: ListJobsParams = {}): Promise<JobWithTranslations[]> {
  const {
    limit = 25,
    status = 'published',
    campus,
    search,
    locale
  } = params

  try {
    const { db } = await createAdminClient()
    
    // Get jobs with their translations using Appwrite's nested relationships
    const queries = [
      Query.limit(limit),
      Query.orderDesc('$createdAt')
    ]

    if (status !== 'all') {
      queries.push(Query.equal('status', status))
    }

    if (campus && campus !== 'all') {
      queries.push(Query.equal('campus_id', campus))
    }

    // Appwrite will automatically include the related translations
    const jobsResponse = await db.listRows('app', 'jobs', queries)
    const jobs = jobsResponse.rows as unknown as Job[]

    // Process jobs and apply locale filtering if needed
    let processedJobs = jobs.map(job => {
      if (locale) {
        return combineJobWithTranslations(job, locale)
      }
      return job as JobWithTranslations
    })

    // Apply search filter on translated content if needed
    if (search && locale) {
      processedJobs = processedJobs.filter(job => 
        job.title?.toLowerCase().includes(search.toLowerCase()) ||
        job.description?.toLowerCase().includes(search.toLowerCase())
      )
    }

    // Filter out jobs that don't have the requested locale translation
    if (locale) {
      processedJobs = processedJobs.filter(job => job.title) // Has translation for requested locale
    }

    return processedJobs
  } catch (error) {
    console.error('Error fetching jobs:', error)
    return []
  }
}

export async function getJob(id: string, locale?: 'en' | 'no'): Promise<JobWithTranslations | null> {
  try {
    const { db } = await createAdminClient()
    
    // Get the main job record - Appwrite will automatically include translations relationship
    const job = await db.getRow('app', 'jobs', id) as Job
    
    return locale ? combineJobWithTranslations(job, locale) : job as JobWithTranslations
  } catch (error) {
    console.error('Error fetching job:', error)
    return null
  }
}

export async function getJobBySlug(slug: string, locale: 'en' | 'no'): Promise<JobWithTranslations | null> {
  try {
    const { db } = await createAdminClient()
    
    // Get job by slug
    const jobsResponse = await db.listRows('app', 'jobs', [
      Query.equal('slug', slug),
      Query.limit(1)
    ])
    
    if (jobsResponse.rows.length === 0) return null
    
    const job = jobsResponse.rows[0] as unknown as Job
    
    // Get translation for the requested locale
    const translationsResponse = await db.listRows('app', 'content_translations', [
      Query.equal('content_type', 'job'),
      Query.equal('content_id', job.$id),
      Query.equal('locale', locale)
    ])
    
    job.translations = translationsResponse.rows as unknown as ContentTranslation[]
    
    return combineJobWithTranslations(job, locale)
  } catch (error) {
    console.error('Error fetching job by slug:', error)
    return null
  }
}

export async function createJob(data: CreateJobData, skipRevalidation = false): Promise<Job | null> {
  try {
    const { db } = await createAdminClient()
    
    // Create main job record first
    const jobData = {
      slug: data.slug,
      status: data.status,
      campus_id: data.campus_id,
      department_id: data.department_id,
      metadata: data.metadata ? JSON.stringify(data.metadata) : undefined
    }
    
    const job = await db.createRow('app', 'jobs', 'unique()', jobData) as Job
    
    // Create translations with proper relationships
    const translationsArray = Object.entries(data.translations)
      .filter(([locale, translation]) => translation)
      .map(([locale, translation]) => ({
        content_type: 'job',
        content_id: job.$id,
        locale,
        title: translation!.title,
        description: translation!.description,
        job_ref: job.$id
      }))
    
    // Create all translations
    if (translationsArray.length > 0) {
      const translationPromises = translationsArray.map(translationData =>
        db.createRow('app', 'content_translations', 'unique()', translationData)
      )
      await Promise.all(translationPromises)
    }
    
    if (!skipRevalidation) {
      revalidatePath('/jobs')
      revalidatePath('/admin/jobs')
    }
    
    return job
  } catch (error) {
    console.error('Error creating job:', error)
    return null
  }
}

export async function updateJob(id: string, data: Partial<CreateJobData>): Promise<Job | null> {
  try {
    const { db } = await createAdminClient()
    
    // Prepare update data
    const jobData: any = {}
    if (data.slug) jobData.slug = data.slug
    if (data.status) jobData.status = data.status
    if (data.campus_id) jobData.campus_id = data.campus_id
    if (data.department_id !== undefined) jobData.department_id = data.department_id
    if (data.metadata) jobData.metadata = JSON.stringify(data.metadata)
    
    // If translations are provided, prepare them for nested update
    if (data.translations) {
      const translationsArray = Object.entries(data.translations)
        .filter(([locale, translation]) => translation) // Only include non-empty translations
        .map(([locale, translation]) => ({
          content_type: 'job',
          locale,
          title: translation!.title,
          description: translation!.description
        }))
      
      if (translationsArray.length > 0) {
        jobData.translation_refs = translationsArray
      }
    }
    
    const job = await db.updateRow('app', 'jobs', id, jobData) as Job
    
    revalidatePath('/jobs')
    revalidatePath('/admin/jobs')
    
    return job
  } catch (error) {
    console.error('Error updating job:', error)
    return null
  }
}

export async function deleteJob(id: string): Promise<boolean> {
  try {
    const { db } = await createAdminClient()
    
    // Delete translations first
    const translationsResponse = await db.listRows('app', 'content_translations', [
      Query.equal('content_type', 'job'),
      Query.equal('content_id', id)
    ])
    
    const deleteTranslationPromises = translationsResponse.rows.map(translation =>
      db.deleteRow('app', 'content_translations', translation.$id)
    )
    
    await Promise.all(deleteTranslationPromises)
    
    // Delete main job record
    await db.deleteRow('app', 'jobs', id)
    
    revalidatePath('/jobs')
    revalidatePath('/admin/jobs')
    
    return true
  } catch (error) {
    console.error('Error deleting job:', error)
    return false
  }
}

// AI Translation function using your existing AI setup
export async function translateJobContent(
  jobId: string, 
  fromLocale: 'en' | 'no', 
  toLocale: 'en' | 'no'
): Promise<ContentTranslation | null> {
  try {
    const { db } = await createAdminClient()
    
    // Get existing translation
    const existingResponse = await db.listRows('app', 'content_translations', [
      Query.equal('content_type', 'job'),
      Query.equal('content_id', jobId),
      Query.equal('locale', fromLocale)
    ])
    
    if (existingResponse.rows.length === 0) {
      throw new Error('Source translation not found')
    }
    
    const sourceTranslation = existingResponse.rows[0] as unknown as ContentTranslation
    
    // Use your existing AI implementation to translate
    const { generateText } = await import('ai')
    const { openai } = await import('@ai-sdk/openai')
    
    const prompt = `Translate the following content from ${fromLocale === 'en' ? 'English' : 'Norwegian'} to ${toLocale === 'en' ? 'English' : 'Norwegian'}. Maintain the HTML formatting and professional tone suitable for a student organization job posting.

Title: ${sourceTranslation.title}

Description: ${sourceTranslation.description}

Please respond with a JSON object containing the translated title and description:
{
  "title": "translated title",
  "description": "translated description"
}`

    const result = await generateText({
      model: openai('gpt-4o'),
      prompt
    })
    
    const translated = JSON.parse(result.text)
    
    // Check if translation already exists
    const existingTranslationResponse = await db.listRows('app', 'content_translations', [
      Query.equal('content_type', 'job'),
      Query.equal('content_id', jobId),
      Query.equal('locale', toLocale)
    ])
    
    let translationRecord: ContentTranslation
    
    if (existingTranslationResponse.rows.length > 0) {
      // Update existing translation
      translationRecord = await db.updateRow('app', 'content_translations', existingTranslationResponse.rows[0]!.$id, {
        title: translated.title,
        description: translated.description
      }) as ContentTranslation
    } else {
      // Create new translation
      translationRecord = await db.createRow('app', 'content_translations', 'unique()', {
        content_type: 'job',
        content_id: jobId,
        locale: toLocale,
        title: translated.title,
        description: translated.description
      }) as ContentTranslation
    }
    
    revalidatePath('/admin/jobs')
    return translationRecord
  } catch (error) {
    console.error('Error translating job content:', error)
    return null
  }
}

// Helper functions remain the same
export async function listDepartments(campusId?: string) {
  const queries = [Query.equal('active', true)]
  
  if (campusId) {
    queries.push(Query.equal('campus_id', campusId))
  }

  try {
    const { db } = await createAdminClient()
    const response = await db.listRows('app', 'departments', queries)
    return response.rows
  } catch (error) {
    console.error('Error fetching departments:', error)
    return []
  }
}

export async function listCampuses() {
  try {
    const { db } = await createAdminClient()
    const response = await db.listRows('app', 'campus')
    return response.rows
  } catch (error) {
    console.error('Error fetching campuses:', error)
    return []
  }
}

// Job application functions remain the same but reference the new job structure
export async function createJobApplication(data: JobApplicationFormData & { job_id: string }): Promise<JobApplication | null> {
  try {
    const { db, storage } = await createSessionClient()
    
    const retentionDate = new Date()
    retentionDate.setFullYear(retentionDate.getFullYear() + 2)
    
    let resumeFileId: string | undefined
    
    if (data.resume) {
      try {
        const uploadedFile = await storage.createFile('resumes', 'unique()', data.resume)
        resumeFileId = uploadedFile.$id
      } catch (uploadError) {
        console.error('Error uploading resume:', uploadError)
      }
    }
    
    const applicationData = {
      job_id: data.job_id,
      applicant_name: data.applicant_name,
      applicant_email: data.applicant_email,
      applicant_phone: data.applicant_phone || '',
      cover_letter: data.cover_letter || '',
      status: 'submitted' as const,
      gdpr_consent: data.gdpr_consent,
      consent_date: new Date().toISOString(),
      data_processing_purpose: 'Job application processing and recruitment evaluation',
      data_retention_until: retentionDate.toISOString(),
      resume_file_id: resumeFileId
    }
    
    const application = await db.createRow('app', 'job_applications', 'unique()', applicationData) as unknown as JobApplication
    revalidatePath('/admin/jobs')
    
    return application
  } catch (error) {
    console.error('Error creating job application:', error)
    return null
  }
}

export async function listJobApplications(jobId?: string): Promise<JobApplication[]> {
  try {
    const { db } = await createAdminClient()
    const queries = [Query.orderDesc('$createdAt')]
    
    if (jobId) {
      queries.push(Query.equal('job_id', jobId))
    }
    
    const response = await db.listRows('app', 'job_applications', queries)
    return response.rows as unknown as JobApplication[]
  } catch (error) {
    console.error('Error fetching job applications:', error)
    return []
  }
}

export async function updateJobApplicationStatus(applicationId: string, status: JobApplication['status']): Promise<JobApplication | null> {
  try {
    const { db } = await createAdminClient()
    const application = await db.updateRow('app', 'job_applications', applicationId, { status }) as unknown as JobApplication
    revalidatePath('/admin/jobs')
    return application
  } catch (error) {
    console.error('Error updating application status:', error)
    return null
  }
}

export async function exportJobApplicationData(applicationId: string): Promise<JobApplication | null> {
  try {
    const { db } = await createAdminClient()
    const application = await db.getRow('app', 'job_applications', applicationId) as unknown as JobApplication
    return application as JobApplication
  } catch (error) {
    console.error('Error exporting application data:', error)
    return null
  }
}

export async function deleteJobApplicationData(applicationId: string): Promise<boolean> {
  try {
    const { db, storage } = await createAdminClient()
    
    const application = await db.getRow('app', 'job_applications', applicationId) as unknown as JobApplication
    
    if (application.resume_file_id) {
      try {
        await storage.deleteFile('resumes', application.resume_file_id)
      } catch (fileError) {
        console.error('Error deleting resume file:', fileError)
      }
    }
    
    await db.deleteRow('app', 'job_applications', applicationId)
    revalidatePath('/admin/jobs')
    
    return true
  } catch (error) {
    console.error('Error deleting application data:', error)
    return false
  }
}