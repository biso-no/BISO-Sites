"use server";

import { openai } from "@ai-sdk/openai";
import { ID, Query } from "@repo/api";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type {
  Campus,
  ContentTranslations,
  Departments,
  JobApplications,
  Users,
} from "@repo/api/types/appwrite";
import {
  assertRecruitmentApplicationTransition,
  buildRecruitmentApplicationReviewMetadata,
  buildRecruitmentVacancyMetadata,
  type RecruitmentApplicationRecord,
  type RecruitmentApplicationReviewUpdateInput,
  type RecruitmentApplicationStatusUpdateInput,
  type RecruitmentVacancyUpsertInput,
  recruitmentApplicationReviewUpdateSchema,
  recruitmentApplicationStatusUpdateSchema,
  recruitmentVacancyUpsertSchema,
  serializeRecruitmentApplicationReviewMetadata,
  serializeRecruitmentVacancyMetadata,
} from "@repo/shared/types/recruitment";
import { generateObject } from "ai";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getUserAuthContext, type UserAuthContext } from "@/lib/authorization";
import {
  assertRecruitmentApplicationReviewAccess,
  assertRecruitmentVacancyWriteAccess,
  buildRecruitmentApplicationRecord,
  canManageRecruitmentVacancy,
  canReviewRecruitmentVacancy,
  fetchRecruitmentJobsByIds,
  fetchRecruitmentListRows,
  getRecruitmentJobById,
  loadRecruitmentLookups,
  toRecruitmentAdminScope,
} from "@/lib/recruitment";
import { logAuditEvent } from "./audit-log";

const JOBS_PAGE_SIZE = 20;
const APPLICATIONS_PAGE_SIZE = 20;

const jobTranslationDraftSchema = z.object({
  description_en: z.string().trim().min(1),
  short_description: z.string().trim().nullable().optional(),
  title_en: z.string().trim().min(1),
});

const jobTranslationResultSchema = z.object({
  description_no: z
    .string()
    .describe("Natural Norwegian Bokmål HTML preserving p, h3, ul and li tags"),
  short_description: z
    .string()
    .describe("Norwegian one-line teaser, maximum 280 characters"),
  title_no: z.string().describe("Norwegian Bokmål job title"),
});

const jobSuggestionDraftSchema = z.object({
  campus: z.string().trim().optional(),
  commitment: z.string().trim().nullable().optional(),
  department: z.string().trim().optional(),
  description: z.string().trim().optional(),
  locale: z.enum(["en", "no"]),
  tags: z.array(z.string()).max(4).optional(),
  title: z.string().trim().min(1),
});

const jobSuggestionResultSchema = z.object({
  bullets: z.array(z.string()).min(2).max(4),
  heading: z.string(),
});

export interface RecruitmentReviewerOption {
  email: string | null;
  id: string;
  name: string;
}

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

async function requireAuth(): Promise<UserAuthContext> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    redirect("/auth/login");
  }
  return ctx;
}

async function upsertTranslation(
  db: AdminDb,
  jobId: string,
  locale: "no" | "en",
  payload: {
    description: string;
    shortDescription: string | null;
    title: string;
  }
): Promise<void> {
  const existing = await db.listRows<ContentTranslations>(
    "app",
    "content_translations",
    [
      Query.equal("content_type", "job"),
      Query.equal("content_id", jobId),
      Query.equal("locale", locale),
      Query.limit(1),
    ]
  );

  const data = {
    additional_fields: null,
    content_id: jobId,
    content_type: "job",
    description: payload.description,
    locale,
    short_description: payload.shortDescription,
    title: payload.title,
  };

  if (existing.rows[0]) {
    await db.updateRow(
      "app",
      "content_translations",
      existing.rows[0].$id,
      data
    );
    return;
  }

  await db.createRow("app", "content_translations", ID.unique(), data);
}

export async function listJobs(opts?: {
  status?: string;
  search?: string;
  page?: number;
}) {
  const ctx = await requireAuth();
  const { db } = await createAdminClient();
  const scope = toRecruitmentAdminScope(ctx);
  const lookups = await loadRecruitmentLookups(db);
  const page = Math.max(1, opts?.page ?? 1);
  const search = opts?.search?.trim().toLowerCase() ?? "";

  const vacancies = await fetchRecruitmentListRows(db, [
    Query.orderDesc("$updatedAt"),
    Query.limit(200),
  ]);

  const filtered = vacancies
    .filter((vacancy) => canManageRecruitmentVacancy(scope, lookups, vacancy))
    .filter((vacancy) =>
      opts?.status && opts.status !== "all"
        ? vacancy.status === opts.status
        : true
    )
    .filter((vacancy) => {
      if (!search) {
        return true;
      }

      const title =
        vacancy.translation_refs
          .find((translation) => translation.locale === "no")
          ?.title.toLowerCase() ?? "";
      const company = vacancy.metadata.company?.toLowerCase() ?? "";

      return title.includes(search) || company.includes(search);
    });

  const start = (page - 1) * JOBS_PAGE_SIZE;

  return {
    page,
    pageSize: JOBS_PAGE_SIZE,
    rows: filtered.slice(start, start + JOBS_PAGE_SIZE),
    total: filtered.length,
  };
}

export async function getJob(id: string) {
  const ctx = await requireAuth();
  const { db } = await createAdminClient();
  const scope = toRecruitmentAdminScope(ctx);
  const lookups = await loadRecruitmentLookups(db);
  const vacancy = await getRecruitmentJobById(db, id);

  if (!vacancy) {
    return null;
  }

  assertRecruitmentVacancyWriteAccess(scope, lookups, vacancy);
  return vacancy;
}

export async function createJob(values: RecruitmentVacancyUpsertInput) {
  const ctx = await requireAuth();
  const validated = recruitmentVacancyUpsertSchema.safeParse(values);
  if (!validated.success) {
    return { error: "Invalid vacancy payload" };
  }

  try {
    const { db } = await createAdminClient();
    const scope = toRecruitmentAdminScope(ctx);
    const lookups = await loadRecruitmentLookups(db);

    assertRecruitmentVacancyWriteAccess(scope, lookups, {
      campus_id: validated.data.campus_id,
      department_id: validated.data.department_id ?? null,
    });

    const metadata = serializeRecruitmentVacancyMetadata(
      buildRecruitmentVacancyMetadata(validated.data)
    );

    const job = await db.createRow("app", "jobs", ID.unique(), {
      campus_id: validated.data.campus_id,
      department_id: validated.data.department_id ?? null,
      metadata,
      slug: validated.data.slug,
      status: validated.data.status,
    });

    await Promise.all([
      upsertTranslation(db, job.$id, "no", {
        description: validated.data.description_no,
        shortDescription: validated.data.short_description ?? null,
        title: validated.data.title_no,
      }),
      upsertTranslation(db, job.$id, "en", {
        description: validated.data.description_en,
        shortDescription: validated.data.short_description ?? null,
        title: validated.data.title_en,
      }),
    ]);

    await logAuditEvent(ctx, "recruitment.vacancy.create", {
      payload: {
        campus_id: validated.data.campus_id,
        department_id: validated.data.department_id ?? null,
        status: validated.data.status,
      },
      resourceId: job.$id,
      resourceType: "job",
    });

    revalidatePath("/jobs");
    revalidatePath("/");
    return { data: job.$id };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to create job",
    };
  }
}

export async function updateJob(
  id: string,
  values: RecruitmentVacancyUpsertInput
) {
  const ctx = await requireAuth();
  const validated = recruitmentVacancyUpsertSchema.safeParse(values);
  if (!validated.success) {
    return { error: "Invalid vacancy payload" };
  }

  try {
    const { db } = await createAdminClient();
    const scope = toRecruitmentAdminScope(ctx);
    const lookups = await loadRecruitmentLookups(db);
    const vacancy = await getRecruitmentJobById(db, id);

    if (!vacancy) {
      return { error: "Vacancy not found" };
    }

    assertRecruitmentVacancyWriteAccess(scope, lookups, vacancy);
    assertRecruitmentVacancyWriteAccess(scope, lookups, {
      campus_id: validated.data.campus_id,
      department_id: validated.data.department_id ?? null,
    });

    const metadata = serializeRecruitmentVacancyMetadata(
      buildRecruitmentVacancyMetadata(validated.data, vacancy.metadata)
    );

    await db.updateRow("app", "jobs", id, {
      campus_id: validated.data.campus_id,
      department_id: validated.data.department_id ?? null,
      metadata,
      slug: validated.data.slug,
      status: validated.data.status,
    });

    await Promise.all([
      upsertTranslation(db, id, "no", {
        description: validated.data.description_no,
        shortDescription: validated.data.short_description ?? null,
        title: validated.data.title_no,
      }),
      upsertTranslation(db, id, "en", {
        description: validated.data.description_en,
        shortDescription: validated.data.short_description ?? null,
        title: validated.data.title_en,
      }),
    ]);

    await logAuditEvent(ctx, "recruitment.vacancy.update", {
      payload: {
        campus_id: validated.data.campus_id,
        department_id: validated.data.department_id ?? null,
        status: validated.data.status,
      },
      resourceId: id,
      resourceType: "job",
    });

    revalidatePath("/jobs");
    revalidatePath(`/jobs/${id}`);
    return { data: id };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to update job",
    };
  }
}

export async function generateJobNorwegianDraft(values: {
  description_en: string;
  short_description?: string | null;
  title_en: string;
}) {
  await requireAuth();
  const validated = jobTranslationDraftSchema.safeParse(values);
  if (!validated.success) {
    return { error: "Add an English title and description first." };
  }

  try {
    const { object } = await generateObject({
      model: openai("gpt-5-nano"),
      schema: jobTranslationResultSchema,
      prompt: `Translate this BISO recruitment vacancy from English to Norwegian Bokmål.
Keep the tone warm, direct, and student-facing.
Preserve the simple HTML structure in the description. Only use p, h3, ul and li tags.
Do not add information that is not present in the source.

Title:
${validated.data.title_en}

Teaser:
${validated.data.short_description ?? ""}

Description HTML:
${validated.data.description_en}`,
    });

    return { data: object };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to generate Norwegian draft",
    };
  }
}

export async function suggestJobDescriptionSection(values: {
  campus?: string;
  commitment?: string | null;
  department?: string;
  description?: string;
  locale: "en" | "no";
  tags?: string[];
  title: string;
}) {
  await requireAuth();
  const validated = jobSuggestionDraftSchema.safeParse(values);
  if (!validated.success) {
    return { error: "Add a title before asking for suggestions." };
  }

  const language =
    validated.data.locale === "no" ? "Norwegian Bokmål" : "English";

  try {
    const { object } = await generateObject({
      model: openai("gpt-5-nano"),
      schema: jobSuggestionResultSchema,
      prompt: `Suggest one useful description section for a student organization vacancy.
Write in ${language}.
Return one short heading and 2-4 concise bullets.
Do not repeat information already present in the current description.

Title: ${validated.data.title}
Department: ${validated.data.department ?? "Any department"}
Campus: ${validated.data.campus ?? "Any campus"}
Commitment: ${validated.data.commitment ?? "Not specified"}
Tags: ${(validated.data.tags ?? []).join(", ") || "None"}
Current description:
${validated.data.description ?? ""}`,
    });

    return { data: object };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to suggest a description section",
    };
  }
}

export async function deleteJob(id: string) {
  const ctx = await requireAuth();

  try {
    const { db } = await createAdminClient();
    const scope = toRecruitmentAdminScope(ctx);
    const lookups = await loadRecruitmentLookups(db);
    const vacancy = await getRecruitmentJobById(db, id);

    if (!vacancy) {
      return { error: "Vacancy not found" };
    }

    assertRecruitmentVacancyWriteAccess(scope, lookups, vacancy);

    const applications = await db.listRows("app", "job_applications", [
      Query.equal("job_id", id),
      Query.limit(1),
    ]);

    if (applications.total > 0) {
      return { error: "Vacancies with applications cannot be deleted" };
    }

    const translations = await db.listRows<ContentTranslations>(
      "app",
      "content_translations",
      [
        Query.equal("content_type", "job"),
        Query.equal("content_id", id),
        Query.limit(10),
      ]
    );

    await Promise.all(
      translations.rows.map((translation) =>
        db.deleteRow("app", "content_translations", translation.$id)
      )
    );
    await db.deleteRow("app", "jobs", id);

    await logAuditEvent(ctx, "recruitment.vacancy.delete", {
      resourceId: id,
      resourceType: "job",
    });

    revalidatePath("/jobs");
    return { data: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to delete job",
    };
  }
}

export async function listJobApplications(opts?: {
  jobId?: string;
  page?: number;
  search?: string;
  status?: string;
}) {
  const ctx = await requireAuth();
  const scope = toRecruitmentAdminScope(ctx);
  if (
    !(
      scope.isGlobalAdmin ||
      scope.isCampusAdmin ||
      scope.managedDepartmentNames.length > 0
    )
  ) {
    throw new Error("Forbidden");
  }

  const { db } = await createAdminClient();
  const lookups = await loadRecruitmentLookups(db);
  const page = Math.max(1, opts?.page ?? 1);
  const search = opts?.search?.trim().toLowerCase() ?? "";

  const accessibleVacancies = (
    await fetchRecruitmentListRows(db, [
      Query.orderDesc("$updatedAt"),
      Query.limit(300),
    ])
  ).filter((vacancy) => canReviewRecruitmentVacancy(scope, lookups, vacancy));

  const accessibleJobIds = accessibleVacancies.map((vacancy) => vacancy.$id);
  if (accessibleJobIds.length === 0) {
    return { page, pageSize: APPLICATIONS_PAGE_SIZE, rows: [], total: 0 };
  }

  if (opts?.jobId && !accessibleJobIds.includes(opts.jobId)) {
    throw new Error("Forbidden");
  }

  const jobsById = new Map(
    accessibleVacancies.map((vacancy) => [vacancy.$id, vacancy])
  );
  const applicationQueries = [
    Query.orderDesc("$createdAt"),
    Query.equal("job_id", opts?.jobId ? [opts.jobId] : accessibleJobIds),
    ...(opts?.status && opts.status !== "all"
      ? [Query.equal("status", opts.status)]
      : []),
    ...(search
      ? [Query.limit(300)]
      : [
          Query.limit(APPLICATIONS_PAGE_SIZE),
          Query.offset((page - 1) * APPLICATIONS_PAGE_SIZE),
        ]),
  ];

  const applicationsResponse = await db.listRows<JobApplications>(
    "app",
    "job_applications",
    applicationQueries
  );

  let rows: RecruitmentApplicationRecord[] = applicationsResponse.rows.map(
    (application) => buildRecruitmentApplicationRecord(application, jobsById)
  );

  if (search) {
    rows = rows.filter((application) => {
      const title = application.job?.title.toLowerCase() ?? "";
      return (
        application.applicant_name.toLowerCase().includes(search) ||
        application.applicant_email.toLowerCase().includes(search) ||
        title.includes(search)
      );
    });
  }

  return {
    page,
    pageSize: APPLICATIONS_PAGE_SIZE,
    rows: search
      ? rows.slice(
          (page - 1) * APPLICATIONS_PAGE_SIZE,
          page * APPLICATIONS_PAGE_SIZE
        )
      : rows,
    total: search ? rows.length : applicationsResponse.total,
  };
}

export async function getJobApplication(id: string) {
  const ctx = await requireAuth();
  const scope = toRecruitmentAdminScope(ctx);
  if (
    !(
      scope.isGlobalAdmin ||
      scope.isCampusAdmin ||
      scope.managedDepartmentNames.length > 0
    )
  ) {
    throw new Error("Forbidden");
  }

  const { db } = await createAdminClient();
  const lookups = await loadRecruitmentLookups(db);
  const application = await db.getRow<JobApplications>(
    "app",
    "job_applications",
    id
  );
  const jobsById = await fetchRecruitmentJobsByIds(db, [application.job_id]);
  const job = jobsById.get(application.job_id);

  if (!job) {
    throw new Error("Vacancy not found");
  }

  assertRecruitmentApplicationReviewAccess(scope, lookups, job);
  return buildRecruitmentApplicationRecord(application, jobsById);
}

export async function listRecruitmentReviewers(jobId?: string): Promise<
  | {
      data: RecruitmentReviewerOption[];
      error?: never;
    }
  | {
      data?: never;
      error: string;
    }
> {
  const ctx = await requireAuth();
  const { db } = await createAdminClient();
  const scope = toRecruitmentAdminScope(ctx);
  const lookups = await loadRecruitmentLookups(db);

  try {
    const queries = [Query.equal("isActive", true), Query.limit(100)];

    if (jobId) {
      const vacancy = await getRecruitmentJobById(db, jobId);
      if (!vacancy) {
        return { error: "Vacancy not found" };
      }
      assertRecruitmentApplicationReviewAccess(scope, lookups, vacancy);

      if (vacancy.department_id) {
        queries.unshift(Query.equal("department_ids", vacancy.department_id));
      } else {
        queries.unshift(Query.equal("campus_id", vacancy.campus_id));
      }
    } else if (!scope.isGlobalAdmin) {
      const managedCampusIds = scope.managedCampusNames
        .map((name) => lookups.campusIdsByName.get(name))
        .filter((value): value is string => Boolean(value));
      const managedDepartmentIds = scope.managedDepartmentNames
        .map((name) => lookups.departmentIdsByName.get(name))
        .filter((value): value is string => Boolean(value));

      if (managedDepartmentIds.length > 0) {
        queries.unshift(Query.equal("department_ids", managedDepartmentIds));
      } else if (managedCampusIds.length > 0) {
        queries.unshift(Query.equal("campus_id", managedCampusIds));
      }
    }

    const response = await db.listRows<Users>("app", "users", queries);
    return {
      data: response.rows.map((user) => ({
        email: user.email ?? null,
        id: user.$id,
        name: user.name ?? user.email ?? "Unnamed HR member",
      })),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to load HR members",
    };
  }
}

export async function updateJobApplicationReview(
  id: string,
  values: RecruitmentApplicationReviewUpdateInput
) {
  const ctx = await requireAuth();
  const validated = recruitmentApplicationReviewUpdateSchema.safeParse(values);
  if (!validated.success) {
    return { error: "Invalid review payload" };
  }

  try {
    const { db } = await createAdminClient();
    const scope = toRecruitmentAdminScope(ctx);
    const lookups = await loadRecruitmentLookups(db);
    const application = await db.getRow<JobApplications>(
      "app",
      "job_applications",
      id
    );
    const jobsById = await fetchRecruitmentJobsByIds(db, [application.job_id]);
    const job = jobsById.get(application.job_id);

    if (!job) {
      throw new Error("Vacancy not found");
    }

    assertRecruitmentApplicationReviewAccess(scope, lookups, job);

    const metadata = buildRecruitmentApplicationReviewMetadata(
      {
        ...validated.data,
        last_reviewed_at: new Date().toISOString(),
        last_reviewed_by: ctx.email ?? ctx.userId,
      },
      application.review_metadata
    );

    await db.updateRow("app", "job_applications", id, {
      review_metadata: serializeRecruitmentApplicationReviewMetadata(metadata),
    });

    await logAuditEvent(ctx, "recruitment.application.review_update", {
      payload: {
        assigned_hr_user_id: metadata.assigned_hr_user_id,
        interview_status: metadata.interview_status,
      },
      resourceId: id,
      resourceType: "job_application",
    });

    revalidatePath("/jobs/applications");
    revalidatePath(`/jobs/${application.job_id}/applications`);
    return { data: metadata };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to update review plan",
    };
  }
}

export async function updateJobApplicationStatus(
  id: string,
  values: RecruitmentApplicationStatusUpdateInput
) {
  const ctx = await requireAuth();
  const validated = recruitmentApplicationStatusUpdateSchema.safeParse(values);
  if (!validated.success) {
    return { error: "Invalid application status payload" };
  }

  try {
    const { db } = await createAdminClient();
    const scope = toRecruitmentAdminScope(ctx);
    if (
      !(
        scope.isGlobalAdmin ||
        scope.isCampusAdmin ||
        scope.managedDepartmentNames.length > 0
      )
    ) {
      throw new Error("Forbidden");
    }

    const lookups = await loadRecruitmentLookups(db);
    const application = await db.getRow<JobApplications>(
      "app",
      "job_applications",
      id
    );
    const jobsById = await fetchRecruitmentJobsByIds(db, [application.job_id]);
    const job = jobsById.get(application.job_id);

    if (!job) {
      throw new Error("Vacancy not found");
    }

    assertRecruitmentApplicationReviewAccess(scope, lookups, job);
    assertRecruitmentApplicationTransition(
      application.status,
      validated.data.status
    );

    await db.updateRow("app", "job_applications", id, {
      status: validated.data.status,
    });

    await logAuditEvent(ctx, "recruitment.application.status_update", {
      payload: {
        from: application.status,
        to: validated.data.status,
      },
      resourceId: id,
      resourceType: "job_application",
    });

    revalidatePath("/jobs/applications");
    revalidatePath(`/jobs/${application.job_id}/applications`);
    return { data: { $id: id, status: validated.data.status } };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to update application",
    };
  }
}

export async function listCampuses() {
  const { db } = await createSessionClient();
  const response = await db.listRows<Campus>("app", "campus", [
    Query.orderAsc("name"),
    Query.limit(50),
  ]);
  return response.rows;
}

export async function listDepartmentsForCampus(campusId: string) {
  const { db } = await createSessionClient();
  const response = await db.listRows<Departments>("app", "departments", [
    Query.equal("campus_id", campusId),
    Query.orderAsc("Name"),
    Query.limit(100),
  ]);
  return response.rows;
}
