"use server";

import { openai } from "@ai-sdk/openai";
import { ID, Query } from "@repo/api";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type {
  Campus,
  ContentTranslations,
  Departments,
  JobApplications,
  Jobs,
  Users,
} from "@repo/api/types/appwrite";
import {
  fetchRecruitmentListRows,
  getRecruitmentJobById,
} from "@repo/shared/recruitment";
import {
  assertRecruitmentApplicationTransition,
  buildRecruitmentApplicationReviewMetadata,
  buildRecruitmentVacancyMetadata,
  parseRecruitmentVacancyMetadata,
  type RecruitmentApplicationRecord,
  type RecruitmentApplicationReviewUpdateInput,
  type RecruitmentApplicationStatusUpdateInput,
  type RecruitmentVacancy,
  type RecruitmentVacancyMetadata,
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
  buildJobRowPermissions,
  buildRecruitmentApplicationRecord,
  canReviewRecruitmentVacancy,
  loadRecruitmentLookups,
  toRecruitmentAdminScope,
} from "@/lib/recruitment";
import { buildContentTranslationPermissions } from "@/lib/utils";
import { logAuditEvent } from "./audit-log";

// Shorthand type for the db accessor — both admin and session clients return the same shape.
type Db = Awaited<ReturnType<typeof createSessionClient>>["db"];

const JOBS_PAGE_SIZE = 20;
const APPLICATIONS_PAGE_SIZE = 20;

// Fields to select when fetching job_applications with nested job data.
const APPLICATION_SELECT = [
  "*",
  "job.$id",
  "job.slug",
  "job.status",
  "job.campus_id",
  "job.department_id",
  "job.translations.$id",
  "job.translations.locale",
  "job.translations.title",
] as const;

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

async function requireAuth(): Promise<UserAuthContext> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    redirect("/auth/login");
  }
  return ctx;
}

/**
 * Build the inline `translations` payload that `db.upsertRow("jobs", ...)`
 * accepts. When a translation row already exists for a given locale we pass
 * its `$id` so Appwrite updates it in place; otherwise the row is created
 * and linked via the `jobs.translations` oneToMany relationship.
 */
async function buildJobTranslationsPayload(
  db: Db,
  jobId: string,
  input: {
    title_no: string;
    title_en: string;
    description_no: string;
    description_en: string;
    short_description?: string | null;
  },
  translationPerms: string[]
): Promise<
  Array<{
    $id?: string;
    $permissions?: string[];
    content_id: string;
    content_type: "job";
    locale: "no" | "en";
    title: string;
    description: string;
    short_description: string | null;
    additional_fields: null;
  }>
> {
  const existing = await db.listRows<ContentTranslations>(
    "app",
    "content_translations",
    [
      Query.equal("content_type", "job"),
      Query.equal("content_id", jobId),
      Query.equal("locale", ["no", "en"]),
      Query.limit(10),
    ]
  );

  const byLocale = new Map<string, ContentTranslations>();
  for (const row of existing.rows) {
    byLocale.set(row.locale, row);
  }

  const buildEntry = (
    locale: "no" | "en",
    title: string,
    description: string
  ) => {
    const existingRow = byLocale.get(locale);
    return {
      ...(existingRow ? { $id: existingRow.$id } : {}),
      $permissions: translationPerms,
      additional_fields: null,
      content_id: jobId,
      content_type: "job" as const,
      description,
      locale,
      short_description: input.short_description ?? null,
      title,
    };
  };

  return [
    buildEntry("no", input.title_no, input.description_no),
    buildEntry("en", input.title_en, input.description_en),
  ];
}

export async function listJobs(opts?: {
  status?: string;
  search?: string;
  page?: number;
}) {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();
  const scope = toRecruitmentAdminScope(ctx);
  const lookups = await loadRecruitmentLookups(db);
  const page = Math.max(1, opts?.page ?? 1);
  const search = opts?.search?.trim().toLowerCase() ?? "";

  // Push the campus / department scope into the Appwrite query so we don't
  // fetch a global page of jobs only to throw most of them away in memory.
  // Global admins skip the filter (canManageAnyCampus).
  const queries: string[] = [Query.orderDesc("$updatedAt"), Query.limit(200)];
  if (!scope.canManageAnyCampus) {
    const managedCampusIds = scope.managedCampusNames
      .map((name) => lookups.campusIdsByName.get(name))
      .filter((id): id is string => Boolean(id));
    const managedDeptIds = scope.managedDepartmentNames
      .map((name) => lookups.departmentIdsByName.get(name))
      .filter((id): id is string => Boolean(id));

    if (scope.isCampusAdmin && managedCampusIds.length > 0) {
      // Relationship-aware filter — new in Appwrite Relationships GA.
      queries.push(Query.equal("campus.$id", managedCampusIds));
    } else if (managedDeptIds.length > 0) {
      queries.push(Query.equal("department.$id", managedDeptIds));
    } else {
      // No scope at all — short-circuit empty list.
      return {
        page,
        pageSize: JOBS_PAGE_SIZE,
        rows: [] as RecruitmentVacancy[],
        total: 0,
      };
    }
  }
  if (opts?.status && opts.status !== "all") {
    queries.push(Query.equal("status", opts.status));
  }

  const vacancies = await fetchRecruitmentListRows(db, queries);

  const filtered = vacancies.filter((vacancy) => {
    if (!search) {
      return true;
    }
    const title =
      vacancy.translations
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
  const { db } = await createSessionClient();
  const scope = toRecruitmentAdminScope(ctx);
  const lookups = await loadRecruitmentLookups(db);
  const vacancy = await getRecruitmentJobById(db, id);

  if (!vacancy) {
    return null;
  }

  assertRecruitmentVacancyWriteAccess(scope, lookups, vacancy);
  return vacancy;
}

/**
 * Build the persisted job payload — including the related `campus` and
 * `department` references and the inline `translations` array — so we can
 * issue one `db.upsertRow("app", "jobs", id, payload)` call that creates or
 * updates the parent row AND links/creates its children in a single hop.
 *
 * Following the Appwrite relationship docs (https://appwrite.io/docs/products/databases/relationships):
 *   - For an existing related row, pass its `$id` (string).
 *   - For a oneToMany child, pass an object literal (with `$id` if updating).
 */
async function buildJobUpsertPayload(
  db: Db,
  jobId: string,
  data: RecruitmentVacancyUpsertInput,
  translationPerms: string[],
  existingMetadata?: RecruitmentVacancyMetadata
): Promise<Record<string, unknown>> {
  const metadata = serializeRecruitmentVacancyMetadata(
    buildRecruitmentVacancyMetadata(data, existingMetadata)
  );
  const translations = await buildJobTranslationsPayload(
    db,
    jobId,
    data,
    translationPerms
  );

  return {
    auto_screen: data.auto_screen,
    campus: data.campus_id,
    campus_id: data.campus_id,
    custom_questions: data.custom_questions
      ? JSON.stringify(data.custom_questions)
      : null,
    department: data.department_id ?? null,
    department_id: data.department_id ?? null,
    interview_template: data.interview_template
      ? JSON.stringify(data.interview_template)
      : null,
    metadata,
    screening_rubric: data.screening_rubric
      ? JSON.stringify(data.screening_rubric)
      : null,
    slug: data.slug,
    status: data.status,
    translations,
  };
}

export async function createJob(values: RecruitmentVacancyUpsertInput) {
  const ctx = await requireAuth();
  const validated = recruitmentVacancyUpsertSchema.safeParse(values);
  if (!validated.success) {
    return { error: "Invalid vacancy payload" };
  }

  try {
    const { db } = await createSessionClient();
    const scope = toRecruitmentAdminScope(ctx);
    const lookups = await loadRecruitmentLookups(db);

    assertRecruitmentVacancyWriteAccess(scope, lookups, {
      campus_id: validated.data.campus_id,
      department_id: validated.data.department_id ?? null,
    });

    const jobId = ID.unique();
    const audience = validated.data.audience ?? "public";
    const jobPerms = buildJobRowPermissions(
      lookups,
      {
        campus_id: validated.data.campus_id,
        department_id: validated.data.department_id ?? null,
      },
      audience
    );
    const translationPerms = buildContentTranslationPermissions({
      audience,
      writeTeams: jobPerms
        .filter((p) => p.startsWith('update("team:'))
        .map((p) => p.slice('update("team:'.length, -2)),
    });
    const payload = await buildJobUpsertPayload(
      db,
      jobId,
      validated.data,
      translationPerms
    );
    const job = await db.upsertRow("app", "jobs", jobId, payload, jobPerms);

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
    const { db } = await createSessionClient();
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

    const audience = validated.data.audience ?? "public";
    const jobPerms = buildJobRowPermissions(
      lookups,
      {
        campus_id: validated.data.campus_id,
        department_id: validated.data.department_id ?? null,
      },
      audience
    );
    const translationPerms = buildContentTranslationPermissions({
      audience,
      writeTeams: jobPerms
        .filter((p) => p.startsWith('update("team:'))
        .map((p) => p.slice('update("team:'.length, -2)),
    });
    const payload = await buildJobUpsertPayload(
      db,
      id,
      validated.data,
      translationPerms,
      vacancy.metadata
    );
    await db.upsertRow("app", "jobs", id, payload, jobPerms);

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
    const { db } = await createSessionClient();
    const scope = toRecruitmentAdminScope(ctx);
    const lookups = await loadRecruitmentLookups(db);
    const vacancy = await getRecruitmentJobById(db, id);

    if (!vacancy) {
      return { error: "Vacancy not found" };
    }

    assertRecruitmentVacancyWriteAccess(scope, lookups, vacancy);

    const applications = await db.listRows("app", "job_applications", [
      Query.equal("job.$id", id),
      Query.limit(1),
    ]);

    if (applications.total > 0) {
      return { error: "Vacancies with applications cannot be deleted" };
    }

    // Translations cascade via the jobs.translations oneToMany relationship.
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

  const { db } = await createSessionClient();
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

  const applicationQueries = [
    Query.select([...APPLICATION_SELECT]),
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
    (application) => buildRecruitmentApplicationRecord(application)
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

  const { db } = await createSessionClient();
  const lookups = await loadRecruitmentLookups(db);
  const application = await db.getRow<JobApplications>(
    "app",
    "job_applications",
    id,
    [Query.select([...APPLICATION_SELECT])]
  );
  const job = application.job as Jobs | null;
  if (!job) {
    throw new Error("Vacancy not found");
  }

  assertRecruitmentApplicationReviewAccess(scope, lookups, job);
  return buildRecruitmentApplicationRecord(application);
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
    const { db } = await createSessionClient();
    const scope = toRecruitmentAdminScope(ctx);
    const lookups = await loadRecruitmentLookups(db);
    const application = await db.getRow<JobApplications>(
      "app",
      "job_applications",
      id,
      [Query.select([...APPLICATION_SELECT])]
    );
    const job = application.job as Jobs | null;
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
    const { db } = await createSessionClient();
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
      id,
      [Query.select([...APPLICATION_SELECT])]
    );
    const job = application.job as Jobs | null;
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

export async function draftRecruitmentEmail(
  applicationId: string,
  options: {
    stage:
      | "interview_invite"
      | "rejection"
      | "request_more_info"
      | "offer"
      | "thank_you";
    locale?: "no" | "en";
    tone?: "warm" | "neutral" | "concise";
    context?: string | null;
  }
): Promise<{
  data?: { subject: string; body: string };
  error?: string;
}> {
  const ctx = await requireAuth();
  try {
    const { db } = await createSessionClient();
    const scope = toRecruitmentAdminScope(ctx);
    const lookups = await loadRecruitmentLookups(db);
    const application = await db.getRow<JobApplications>(
      "app",
      "job_applications",
      applicationId,
      [
        Query.select([
          "*",
          "job.$id",
          "job.campus_id",
          "job.department_id",
          "job.metadata",
          "job.translations.*",
        ]),
      ]
    );
    const job = application.job as Jobs | null;
    if (!job) {
      return { error: "Vacancy not found" };
    }

    assertRecruitmentApplicationReviewAccess(scope, lookups, job);

    const { draftCandidateEmail } = await import(
      "@repo/ai/server/recruitment-emails"
    );
    const draft = await draftCandidateEmail({
      application: {
        applicant_email: application.applicant_email,
        applicant_name: application.applicant_name,
      },
      context: options.context ?? null,
      locale: options.locale ?? "no",
      stage: options.stage,
      tone: options.tone ?? "warm",
      vacancy: {
        metadata: parseRecruitmentVacancyMetadata(job.metadata),
        translations: (job.translations ?? []) as ContentTranslations[],
      },
    });

    await logAuditEvent(ctx, "recruitment.email.draft", {
      payload: { stage: options.stage, subject: draft.subject },
      resourceId: applicationId,
      resourceType: "job_application",
    });

    return { data: { body: draft.body, subject: draft.subject } };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to draft email",
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
