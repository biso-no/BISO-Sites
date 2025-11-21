"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import {
  Campus,
  type ContentTranslations,
  ContentType,
  Departments,
  type Jobs,
  Locale,
  Status,
} from "@repo/api/types/appwrite";
import { revalidatePath } from "next/cache";
import type { ContentTranslation } from "@/lib/types/content-translation";
import type {
  JobApplication,
  JobApplicationFormData,
} from "@/lib/types/job-application";

export interface ListJobsParams {
  limit?: number;
  status?: string;
  campus?: string;
  search?: string;
  locale?: "en" | "no";
}

export interface CreateJobData {
  slug: string;
  status: "draft" | "published" | "closed";
  campus_id: string;
  department_id?: string;
  metadata?: {
    type?: string;
    application_deadline?: string;
    start_date?: string;
    contact_name?: string;
    contact_email?: string;
    apply_url?: string;
    image?: string;
  };
  translations: {
    en?: {
      title: string;
      description: string;
      short_description?: string;
    };
    no?: {
      title: string;
      description: string;
      short_description?: string;
    };
  };
}

export async function listJobs(
  params: ListJobsParams = {}
): Promise<ContentTranslations[]> {
  const { limit = 25, status = "published", campus, locale } = params;

  try {
    const { db } = await createSessionClient();

    const queries = [
      Query.equal("content_type", ContentType.JOB),
      Query.select([
        "content_id",
        "$id",
        "locale",
        "title",
        "description",
        "short_description",
        "job_ref.*",
        "job_ref.department.*",
      ]),
      Query.limit(limit),
      Query.orderDesc("$createdAt"),
    ];

    // Only add locale filter if provided
    if (locale) {
      queries.push(Query.equal("locale", locale as Locale));
    }

    if (status !== "all") {
      queries.push(Query.equal("job_ref.status", status));
    }

    if (campus && campus !== "all") {
      queries.push(Query.equal("job_ref.campus_id", campus));
    }

    // Get jobs with their translations using Appwrite's nested relationships
    const jobsResponse = await db.listRows<ContentTranslations>(
      "app",
      "content_translations",
      queries
    );
    const jobs = jobsResponse.rows;

    return jobs;
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return [];
  }
}

async function getJob(
  id: string,
  locale: "en" | "no"
): Promise<ContentTranslations | null> {
  try {
    const { db } = await createSessionClient();

    // Query content_translations by content_id and locale
    const translationsResponse = await db.listRows<ContentTranslations>(
      "app",
      "content_translations",
      [
        Query.equal("content_type", ContentType.JOB),
        Query.equal("content_id", id),
        Query.equal("locale", locale),
        Query.select([
          "content_id",
          "$id",
          "locale",
          "title",
          "description",
          "short_description",
          "job_ref.*",
          "job_ref.department.*",
        ]),
        Query.limit(1),
      ]
    );

    if (translationsResponse.rows.length === 0) {
      return null;
    }

    return translationsResponse.rows[0] ?? null;
  } catch (error) {
    console.error("Error fetching job:", error);
    return null;
  }
}

export async function getJobBySlug(
  slug: string,
  locale: "en" | "no"
): Promise<ContentTranslations | null> {
  try {
    const { db } = await createSessionClient();

    // Get job by slug
    const jobsResponse = await db.listRows<Jobs>("app", "jobs", [
      Query.equal("slug", slug),
      Query.limit(1),
    ]);

    if (jobsResponse.rows.length === 0) return null;

    const job = jobsResponse.rows[0] ?? null;

    // Get translation for the requested locale
    const translationsResponse = await db.listRows<ContentTranslations>(
      "app",
      "content_translations",
      [
        Query.equal("content_type", ContentType.JOB),
        Query.equal("content_id", job?.$id ?? ""),
        Query.equal("locale", locale),
        Query.select([
          "content_id",
          "$id",
          "locale",
          "title",
          "description",
          "short_description",
          "job_ref.*",
          "job_ref.department.*",
        ]),
        Query.limit(1),
      ]
    );

    if (translationsResponse.rows.length === 0) return null;

    return translationsResponse.rows[0] ?? null;
  } catch (error) {
    console.error("Error fetching job by slug:", error);
    return null;
  }
}

async function createJob(
  data: CreateJobData,
  skipRevalidation = false
): Promise<Jobs | null> {
  try {
    const { db } = await createSessionClient();

    // Build translation_refs array from provided translations only
    const translationRefs: ContentTranslations[] = [];

    if (data.translations.en) {
      translationRefs.push({
        content_type: ContentType.JOB,
        content_id: "unique()",
        locale: Locale.EN,
        title: data.translations.en.title,
        description: data.translations.en.description,
        short_description: data.translations.en.short_description || null,
      } as ContentTranslations);
    }

    if (data.translations.no) {
      translationRefs.push({
        content_type: ContentType.JOB,
        content_id: "unique()",
        locale: Locale.NO,
        title: data.translations.no.title,
        description: data.translations.no.description,
        short_description: data.translations.no.short_description || null,
      } as ContentTranslations);
    }

    const job = (await db.createRow("app", "jobs", "unique()", {
      slug: data.slug,
      status:
        data.status === "draft"
          ? Status.DRAFT
          : data.status === "published"
            ? Status.PUBLISHED
            : Status.CLOSED,
      campus_id: data.campus_id,
      campus: data.campus_id,
      department_id: data.department_id ?? null,
      department: data.department_id ? data.department_id : null,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      translations: [] as ContentTranslations[],
      translation_refs: translationRefs,
    })) as Jobs;

    if (!skipRevalidation) {
      revalidatePath("/jobs");
      revalidatePath("/admin/jobs");
    }

    return job;
  } catch (error) {
    console.error("Error creating job:", error);
    return null;
  }
}

async function updateJob(
  id: string,
  data: Partial<CreateJobData>
): Promise<Jobs | null> {
  try {
    const { db } = await createSessionClient();

    // Build update object
    const updateData: Record<string, unknown> = {};

    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.status !== undefined) {
      updateData.status =
        data.status === "draft"
          ? Status.DRAFT
          : data.status === "published"
            ? Status.PUBLISHED
            : Status.CLOSED;
    }
    if (data.campus_id !== undefined) updateData.campus_id = data.campus_id;
    if (data.department_id !== undefined)
      updateData.department_id = data.department_id;
    if (data.metadata !== undefined)
      updateData.metadata = data.metadata
        ? JSON.stringify(data.metadata)
        : null;

    // Build translation_refs array from provided translations only
    if (data.translations) {
      const translationRefs: ContentTranslations[] = [];

      if (data.translations.en) {
        translationRefs.push({
          content_type: ContentType.JOB,
          content_id: id,
          locale: Locale.EN,
          title: data.translations.en.title,
          description: data.translations.en.description,
          short_description: data.translations.en.short_description || null,
        } as ContentTranslations);
      }

      if (data.translations.no) {
        translationRefs.push({
          content_type: ContentType.JOB,
          content_id: id,
          locale: Locale.NO,
          title: data.translations.no.title,
          description: data.translations.no.description,
          short_description: data.translations.no.short_description || null,
        } as ContentTranslations);
      }

      if (translationRefs.length > 0) {
        updateData.translation_refs = translationRefs;
      }
    }

    const job = (await db.updateRow("app", "jobs", id, updateData)) as Jobs;

    revalidatePath("/jobs");
    revalidatePath("/admin/jobs");

    return job;
  } catch (error) {
    console.error("Error updating job:", error);
    return null;
  }
}

async function deleteJob(id: string): Promise<boolean> {
  try {
    const { db } = await createSessionClient();

    // Delete translations first
    const translationsResponse = await db.listRows(
      "app",
      "content_translations",
      [Query.equal("content_type", "job"), Query.equal("content_id", id)]
    );

    const deleteTranslationPromises = translationsResponse.rows.map(
      (translation) =>
        db.deleteRow("app", "content_translations", translation.$id)
    );

    await Promise.all(deleteTranslationPromises);

    // Delete main job record
    await db.deleteRow("app", "jobs", id);

    revalidatePath("/jobs");
    revalidatePath("/admin/jobs");

    return true;
  } catch (error) {
    console.error("Error deleting job:", error);
    return false;
  }
}

// AI Translation function using your existing AI setup
async function translateJobContent(
  jobId: string,
  fromLocale: "en" | "no",
  toLocale: "en" | "no"
): Promise<ContentTranslation | null> {
  try {
    const { db } = await createSessionClient();

    // Get existing translation
    const existingResponse = await db.listRows<ContentTranslations>(
      "app",
      "content_translations",
      [
        Query.equal("content_type", "job"),
        Query.equal("content_id", jobId),
        Query.equal("locale", fromLocale),
      ]
    );

    if (existingResponse.rows.length === 0) {
      throw new Error("Source translation not found");
    }

    const sourceTranslation = existingResponse.rows[0] ?? null;

    // Use your existing AI implementation to translate
    const { generateText } = await import("ai");
    const { openai } = await import("@ai-sdk/openai");

    const prompt = `Translate the following content from ${fromLocale === "en" ? "English" : "Norwegian"} to ${toLocale === "en" ? "English" : "Norwegian"}. Maintain the HTML formatting and professional tone suitable for a student organization job posting.

Title: ${sourceTranslation.title}

Description: ${sourceTranslation.description}

Please respond with a JSON object containing the translated title and description:
{
  "title": "translated title",
  "description": "translated description"
}`;

    const result = await generateText({
      model: openai("gpt-4o"),
      prompt,
    });

    const translated = JSON.parse(result.text);

    // Check if translation already exists
    const existingTranslationResponse = await db.listRows(
      "app",
      "content_translations",
      [
        Query.equal("content_type", "job"),
        Query.equal("content_id", jobId),
        Query.equal("locale", toLocale),
      ]
    );

    let translationRecord: ContentTranslation;

    if (existingTranslationResponse.rows.length > 0) {
      // Update existing translation
      translationRecord = (await db.updateRow(
        "app",
        "content_translations",
        existingTranslationResponse.rows[0]!.$id,
        {
          title: translated.title,
          description: translated.description,
        }
      )) as ContentTranslation;
    } else {
      // Create new translation
      translationRecord = (await db.createRow(
        "app",
        "content_translations",
        "unique()",
        {
          content_type: "job",
          content_id: jobId,
          locale: toLocale,
          title: translated.title,
          description: translated.description,
        }
      )) as ContentTranslation;
    }

    revalidatePath("/admin/jobs");
    return translationRecord;
  } catch (error) {
    console.error("Error translating job content:", error);
    return null;
  }
}

// Helper functions remain the same
async function listDepartments(campusId?: string) {
  const queries = [Query.equal("active", true)];

  if (campusId) {
    queries.push(Query.equal("campus_id", campusId));
  }

  try {
    const { db } = await createSessionClient();
    const response = await db.listRows("app", "departments", queries);
    return response.rows;
  } catch (error) {
    console.error("Error fetching departments:", error);
    return [];
  }
}

async function listCampuses() {
  try {
    const { db } = await createSessionClient();
    const response = await db.listRows("app", "campus");
    return response.rows;
  } catch (error) {
    console.error("Error fetching campuses:", error);
    return [];
  }
}

// Job application functions remain the same but reference the new job structure
async function createJobApplication(
  data: JobApplicationFormData & { job_id: string }
): Promise<JobApplication | null> {
  try {
    const { db, storage } = await createSessionClient();

    const retentionDate = new Date();
    retentionDate.setFullYear(retentionDate.getFullYear() + 2);

    let resumeFileId: string | undefined;

    if (data.resume) {
      try {
        const uploadedFile = await storage.createFile(
          "resumes",
          "unique()",
          data.resume
        );
        resumeFileId = uploadedFile.$id;
      } catch (uploadError) {
        console.error("Error uploading resume:", uploadError);
      }
    }

    const applicationData = {
      job_id: data.job_id,
      applicant_name: data.applicant_name,
      applicant_email: data.applicant_email,
      applicant_phone: data.applicant_phone || "",
      cover_letter: data.cover_letter || "",
      status: "submitted" as const,
      gdpr_consent: data.gdpr_consent,
      consent_date: new Date().toISOString(),
      data_processing_purpose:
        "Job application processing and recruitment evaluation",
      data_retention_until: retentionDate.toISOString(),
      resume_file_id: resumeFileId,
    };

    const application = await db.createRow<JobApplication>(
      "app",
      "job_applications",
      "unique()",
      applicationData
    );
    revalidatePath("/admin/jobs");

    return application;
  } catch (error) {
    console.error("Error creating job application:", error);
    return null;
  }
}

async function listJobApplications(jobId?: string): Promise<JobApplication[]> {
  try {
    const { db } = await createSessionClient();
    const queries = [Query.orderDesc("$createdAt")];

    if (jobId) {
      queries.push(Query.equal("job_id", jobId));
    }

    const response = await db.listRows<JobApplication>(
      "app",
      "job_applications",
      queries
    );
    return response.rows;
  } catch (error) {
    console.error("Error fetching job applications:", error);
    return [];
  }
}

async function updateJobApplicationStatus(
  applicationId: string,
  status: JobApplication["status"]
): Promise<JobApplication | null> {
  try {
    const { db } = await createSessionClient();
    const application = await db.updateRow<JobApplication>(
      "app",
      "job_applications",
      applicationId,
      { status }
    );
    revalidatePath("/admin/jobs");
    return application;
  } catch (error) {
    console.error("Error updating application status:", error);
    return null;
  }
}

async function exportJobApplicationData(
  applicationId: string
): Promise<JobApplication | null> {
  try {
    const { db } = await createSessionClient();
    const application = await db.getRow<JobApplication>(
      "app",
      "job_applications",
      applicationId
    );
    return application;
  } catch (error) {
    console.error("Error exporting application data:", error);
    return null;
  }
}

async function deleteJobApplicationData(
  applicationId: string
): Promise<boolean> {
  try {
    const { db, storage } = await createSessionClient();

    const application = await db.getRow<JobApplication>(
      "app",
      "job_applications",
      applicationId
    );

    if (application.resume_file_id) {
      try {
        await storage.deleteFile("resumes", application.resume_file_id);
      } catch (fileError) {
        console.error("Error deleting resume file:", fileError);
      }
    }

    await db.deleteRow("app", "job_applications", applicationId);
    revalidatePath("/admin/jobs");

    return true;
  } catch (error) {
    console.error("Error deleting application data:", error);
    return false;
  }
}
