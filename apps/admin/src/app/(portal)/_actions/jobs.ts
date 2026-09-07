"use server";

import { fastModel } from "@repo/ai/models";
import { ID, Query } from "@repo/api";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type {
  ContentTranslations,
  JobApplications,
  Jobs,
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
import { z } from "zod";
import { requireAuth } from "@/lib/authorization";
import { CAMPUS_ID_TO_NAME } from "@/lib/campus-constants";
import {
  type AutoTranslationOptions,
  type ContentLocale,
  getTargetLocale,
  isCurrentTranslationSource,
  type TranslationField,
} from "@/lib/content-translation";
import {
  parseAutoTranslationOptions,
  scheduleContentTranslation,
  translateContentFields,
} from "@/lib/content-translation.server";
import {
  applyDescriptionMerge,
  computeJobTranslationMemory,
  type JobTranslationMemory,
  parseJobTranslationMemory,
  planDescriptionMerge,
  serializeJobTranslationMemory,
} from "@/lib/job-translation-memory";
import {
  assertRecruitmentApplicationReviewAccess,
  assertRecruitmentVacancyWriteAccess,
  buildJobRowPermissions,
  buildJobTranslationPermissions,
  buildRecruitmentApplicationRecord,
  canReviewRecruitmentVacancy,
  loadRecruitmentLookups,
  toRecruitmentAdminScope,
} from "@/lib/recruitment";

import { logAuditEvent } from "./audit-log";
import { APPLICATIONS_PAGE_SIZE, JOBS_PAGE_SIZE } from "./schemas";

// Shorthand type for the db accessor — both admin and session clients return the same shape.
type Db = Awaited<ReturnType<typeof createSessionClient>>["db"];

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

const jobTranslationDraftSchema = z
  .object({
    campusId: z.string().trim().min(1),
    description: z.string().trim(),
    departmentId: z.string().trim().nullable().optional(),
    shortDescription: z.string().trim().nullable().optional(),
    sourceLocale: z.enum(["no", "en"]),
    title: z.string().trim(),
  })
  .refine(
    (value) =>
      Boolean(
        value.title || value.description || value.shortDescription?.trim()
      ),
    "Add source content first."
  );

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

interface JobTranslationSnapshot {
  description: string;
  short_description: string;
  title: string;
}

export interface RecruitmentReviewerOption {
  email: string | null;
  id: string;
  name: string;
  /**
   * "primary" = in scope for the vacancy by default (vacancy campus HR +
   * national HR). "other" = HR from another campus, only surfaced for National
   * vacancies when the recruiter opts to include other campuses.
   */
  scope: "primary" | "other";
}

/** HR department team — the source of recruitment-staff eligibility. */
const HR_TEAM_ID = "sg-app-dept-hr";
/** National campus team — its HR members are always in scope for any vacancy. */
const NATIONAL_CAMPUS_TEAM_ID = "sg-app-campus-national";

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
    short_description_no?: string | null;
    short_description_en?: string | null;
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
    additional_fields: string | null;
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
    description: string,
    shortDescription: string | null
  ) => {
    const existingRow = byLocale.get(locale);
    return {
      ...(existingRow ? { $id: existingRow.$id } : {}),
      $permissions: translationPerms,
      // Preserve the translation-memory cache — this write only persists the
      // authored title/description/short description; wiping the cache here
      // would force the next auto-translation pass back to a full rewrite.
      additional_fields: existingRow?.additional_fields ?? null,
      content_id: jobId,
      content_type: "job" as const,
      description,
      locale,
      short_description: shortDescription,
      title,
    };
  };

  return [
    buildEntry(
      "no",
      input.title_no,
      input.description_no,
      input.short_description_no ?? null
    ),
    buildEntry(
      "en",
      input.title_en,
      input.description_en,
      input.short_description_en ?? null
    ),
  ];
}

function getJobTranslationSnapshot(
  values: RecruitmentVacancyUpsertInput,
  locale: ContentLocale
): JobTranslationSnapshot {
  if (locale === "no") {
    return {
      description: values.description_no,
      short_description: values.short_description_no ?? "",
      title: values.title_no,
    };
  }
  return {
    description: values.description_en,
    short_description: values.short_description_en ?? "",
    title: values.title_en,
  };
}

async function translateJobSnapshot(
  source: JobTranslationSnapshot,
  sourceLocale: ContentLocale
): Promise<JobTranslationSnapshot> {
  const translated = await translateContentFields({
    contentType: "job vacancy",
    fields: [
      { format: "plain", key: "title", value: source.title },
      {
        format: "plain",
        key: "short_description",
        value: source.short_description,
      },
      { format: "html", key: "description", value: source.description },
    ],
    sourceLocale,
    targetLocale: getTargetLocale(sourceLocale),
  });
  return {
    description: translated.description ?? "",
    short_description: translated.short_description ?? "",
    title: translated.title ?? "",
  };
}

/**
 * Same translation as `translateJobSnapshot`, but reuses whatever's already
 * in the target locale for any title/short description/description
 * paragraph whose source text hasn't changed since the cached translation
 * memory was recorded. Only the changed/new pieces are sent to the model —
 * this is what keeps an unrelated edit from rewriting an already-reviewed
 * translation end to end.
 */
async function translateJobSnapshotIncremental(
  source: JobTranslationSnapshot,
  sourceLocale: ContentLocale,
  currentTarget: JobTranslationSnapshot,
  cache: JobTranslationMemory | null
): Promise<{
  memory: JobTranslationMemory;
  translation: JobTranslationSnapshot;
}> {
  const memory = computeJobTranslationMemory(source);
  const titleReusable = cache !== null && cache.titleHash === memory.titleHash;
  const shortDescriptionReusable =
    cache !== null &&
    cache.shortDescriptionHash === memory.shortDescriptionHash;
  const plan = planDescriptionMerge(
    source.description,
    currentTarget.description,
    cache?.descriptionBlockHashes ?? null
  );

  const fields: TranslationField[] = [];
  if (!titleReusable) {
    fields.push({ format: "plain", key: "title", value: source.title });
  }
  if (!shortDescriptionReusable) {
    fields.push({
      format: "plain",
      key: "short_description",
      value: source.short_description,
    });
  }
  for (const segment of plan.segments) {
    if (segment.needsTranslation) {
      fields.push({
        format: "plain",
        key: segment.fieldKey,
        value: segment.sourceText,
      });
    }
  }

  const translatedFields =
    fields.length > 0
      ? await translateContentFields({
          contentType: "job vacancy",
          fields,
          sourceLocale,
          targetLocale: getTargetLocale(sourceLocale),
        })
      : {};

  const translation: JobTranslationSnapshot = {
    description: applyDescriptionMerge(plan, translatedFields),
    short_description: shortDescriptionReusable
      ? currentTarget.short_description
      : (translatedFields.short_description ?? ""),
    title: titleReusable ? currentTarget.title : (translatedFields.title ?? ""),
  };

  return { memory, translation };
}

/**
 * Persist a deferred destination locale through the parent `jobs.translations`
 * relation. The relation is one-way (no child back-reference), so a standalone
 * child row would be an orphan; instead the complete relation is replaced with
 * every existing translation ID plus the destination entry — an object with
 * `$id` to update in place, or without one so Appwrite creates and links it.
 * The parent's own permissions are left untouched by omitting the permissions
 * argument.
 *
 * Uses `updateRow`, not `upsertRow`: this only ever targets an existing job
 * row with a partial payload (just `translations`). `upsertRow` validates as
 * a full-document replace and rejects a partial payload for missing required
 * columns like `slug` even when the row already has one — `updateRow` is the
 * partial-patch operation.
 */
async function persistDeferredJobTranslation(
  db: Db,
  jobId: string,
  locale: ContentLocale,
  translation: JobTranslationSnapshot,
  permissions: string[],
  currentRows: ContentTranslations[],
  translationMemory: JobTranslationMemory
): Promise<void> {
  const target = currentRows.find((row) => row.locale === locale);
  const others = currentRows
    .filter((row) => row.locale !== locale)
    .map((row) => row.$id);
  await db.updateRow("app", "jobs", jobId, {
    translations: [
      ...others,
      {
        ...(target ? { $id: target.$id } : {}),
        $permissions: permissions,
        additional_fields: serializeJobTranslationMemory(translationMemory),
        content_id: jobId,
        content_type: "job" as const,
        description: translation.description,
        locale,
        short_description: translation.short_description || null,
        title: translation.title,
      },
    ],
  });
}

function scheduleJobTranslation(input: {
  audience: "members" | "public";
  campusId: string;
  departmentId: string | null;
  /** The target locale as this save left it — see the stale check below. */
  destination: JobTranslationSnapshot;
  enabled: boolean;
  jobId: string;
  source: JobTranslationSnapshot;
  sourceLocale: ContentLocale;
  status: RecruitmentVacancyUpsertInput["status"];
}): boolean {
  const hasSource = Boolean(
    input.source.title.trim() && input.source.description.trim()
  );
  if (!(input.enabled && hasSource)) {
    return false;
  }
  return scheduleContentTranslation({
    enabled: true,
    task: async () => {
      const { db } = await createAdminClient();
      const currentJob = await db.getRow<Jobs>("app", "jobs", input.jobId);
      const currentMetadata = parseRecruitmentVacancyMetadata(
        currentJob.metadata
      );
      if (
        !isCurrentTranslationSource(
          {
            audience: input.audience,
            campusId: input.campusId,
            departmentId: input.departmentId,
            status: input.status,
          },
          {
            audience: currentMetadata.audience ?? "public",
            campusId: currentJob.campus_id,
            departmentId: currentJob.department_id ?? null,
            status: currentJob.status,
          }
        )
      ) {
        return;
      }
      // One reload of every locale row for this vacancy, immediately before
      // persistence: the source for the stale check, and the complete set so
      // the one-way parent relation can be replaced without dropping locales.
      const currentRows = await db.listRows<ContentTranslations>(
        "app",
        "content_translations",
        [
          Query.equal("content_type", "job"),
          Query.equal("content_id", input.jobId),
          Query.limit(10),
        ]
      );
      const currentSource = currentRows.rows.find(
        (row) => row.locale === input.sourceLocale
      );
      if (!currentSource) {
        return;
      }
      const currentSnapshot: JobTranslationSnapshot = {
        description: currentSource.description ?? "",
        short_description: currentSource.short_description ?? "",
        title: currentSource.title ?? "",
      };
      if (!isCurrentTranslationSource(input.source, currentSnapshot)) {
        return;
      }
      // The destination is only ours to overwrite while it still holds exactly
      // what this save wrote. An editor who translated the other locale by hand
      // while the model request was in flight owns the newer text.
      const currentTarget = currentRows.rows.find(
        (row) => row.locale === getTargetLocale(input.sourceLocale)
      );
      const currentTargetSnapshot: JobTranslationSnapshot = {
        description: currentTarget?.description ?? "",
        short_description: currentTarget?.short_description ?? "",
        title: currentTarget?.title ?? "",
      };
      if (
        !isCurrentTranslationSource(input.destination, currentTargetSnapshot)
      ) {
        return;
      }
      const cache = parseJobTranslationMemory(
        currentTarget?.additional_fields ?? null
      );
      const { memory, translation } = await translateJobSnapshotIncremental(
        input.source,
        input.sourceLocale,
        currentTargetSnapshot,
        cache
      );
      const permissions = buildJobTranslationPermissions(
        input.audience,
        input.status
      );
      await persistDeferredJobTranslation(
        db,
        input.jobId,
        getTargetLocale(input.sourceLocale),
        translation,
        permissions,
        currentRows.rows,
        memory
      );
    },
  });
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
  const queries: string[] = [Query.orderDesc("$updatedAt"), Query.limit(200)];
  if (scope.canManageAnyCampus) {
    // Global / HR-national admins see every campus unless the campus switcher
    // narrows them to one. campus.$id mirrors the numeric campus_id values.
    if (ctx.activeCampusId) {
      queries.push(Query.equal("campus.$id", [ctx.activeCampusId]));
    }
  } else {
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
    buildRecruitmentVacancyMetadata(
      {
        ...data,
        // Keep a locale-agnostic teaser fallback on metadata for any consumer
        // that reads metadata directly; the per-locale teaser is authoritative
        // and lives on each content_translations row.
        short_description:
          data.short_description_no ?? data.short_description_en ?? null,
      },
      existingMetadata
    )
  );
  const translations = await buildJobTranslationsPayload(
    db,
    jobId,
    data,
    translationPerms
  );

  return {
    application_deadline: data.application_deadline
      ? new Date(data.application_deadline).toISOString()
      : null,
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

export async function createJob(
  values: RecruitmentVacancyUpsertInput,
  autoTranslation?: AutoTranslationOptions
) {
  const ctx = await requireAuth();
  const validated = recruitmentVacancyUpsertSchema.safeParse(values);
  if (!validated.success) {
    return { error: "Invalid vacancy payload" };
  }

  try {
    const translationOptions = parseAutoTranslationOptions(autoTranslation);
    const { db: sessionDb } = await createSessionClient();
    const { db: adminDb } = await createAdminClient();
    const scope = toRecruitmentAdminScope(ctx);
    const lookups = await loadRecruitmentLookups(sessionDb);

    assertRecruitmentVacancyWriteAccess(scope, lookups, {
      campus_id: validated.data.campus_id,
      department_id: validated.data.department_id ?? null,
    });
    const jobId = ID.unique();
    const audience = validated.data.audience ?? "public";
    const jobPerms = buildJobRowPermissions(audience, validated.data.status);
    const translationPerms = buildJobTranslationPermissions(
      audience,
      validated.data.status
    );
    const payload = await buildJobUpsertPayload(
      sessionDb,
      jobId,
      validated.data,
      translationPerms
    );
    const job = await adminDb.upsertRow(
      "app",
      "jobs",
      jobId,
      payload,
      jobPerms
    );

    const translationQueued = scheduleJobTranslation({
      audience,
      campusId: validated.data.campus_id,
      departmentId: validated.data.department_id ?? null,
      destination: getJobTranslationSnapshot(
        validated.data,
        getTargetLocale(translationOptions?.sourceLocale ?? "en")
      ),
      enabled: translationOptions?.enabled ?? false,
      jobId: job.$id,
      source: getJobTranslationSnapshot(
        validated.data,
        translationOptions?.sourceLocale ?? "en"
      ),
      sourceLocale: translationOptions?.sourceLocale ?? "en",
      status: validated.data.status,
    });

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
    return {
      data: job.$id,
      ...(translationQueued ? { translationQueued: true as const } : {}),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to create job",
    };
  }
}

export async function updateJob(
  id: string,
  values: RecruitmentVacancyUpsertInput,
  autoTranslation?: AutoTranslationOptions
) {
  const ctx = await requireAuth();
  const validated = recruitmentVacancyUpsertSchema.safeParse(values);
  if (!validated.success) {
    return { error: "Invalid vacancy payload" };
  }

  try {
    const translationOptions = parseAutoTranslationOptions(autoTranslation);
    const { db: sessionDb } = await createSessionClient();
    const { db: adminDb } = await createAdminClient();
    const scope = toRecruitmentAdminScope(ctx);
    const lookups = await loadRecruitmentLookups(sessionDb);
    const vacancy = await getRecruitmentJobById(sessionDb, id);

    if (!vacancy) {
      return { error: "Vacancy not found" };
    }

    assertRecruitmentVacancyWriteAccess(scope, lookups, vacancy);
    assertRecruitmentVacancyWriteAccess(scope, lookups, {
      campus_id: validated.data.campus_id,
      department_id: validated.data.department_id ?? null,
    });
    const audience =
      validated.data.audience ?? vacancy.metadata.audience ?? "public";
    const jobPerms = buildJobRowPermissions(audience, validated.data.status);
    const translationPerms = buildJobTranslationPermissions(
      audience,
      validated.data.status
    );
    const payload = await buildJobUpsertPayload(
      sessionDb,
      id,
      validated.data,
      translationPerms,
      vacancy.metadata
    );
    await adminDb.upsertRow("app", "jobs", id, payload, jobPerms);

    const translationQueued = scheduleJobTranslation({
      audience,
      campusId: validated.data.campus_id,
      departmentId: validated.data.department_id ?? null,
      destination: getJobTranslationSnapshot(
        validated.data,
        getTargetLocale(translationOptions?.sourceLocale ?? "en")
      ),
      enabled: translationOptions?.enabled ?? false,
      jobId: id,
      source: getJobTranslationSnapshot(
        validated.data,
        translationOptions?.sourceLocale ?? "en"
      ),
      sourceLocale: translationOptions?.sourceLocale ?? "en",
      status: validated.data.status,
    });

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
    return {
      data: id,
      ...(translationQueued ? { translationQueued: true as const } : {}),
    };
  } catch (error) {
    console.error("[updateJob] error", error);
    return {
      error: error instanceof Error ? error.message : "Failed to update job",
    };
  }
}

export async function generateJobTranslationDraft(values: {
  campusId: string;
  description: string;
  departmentId?: string | null;
  shortDescription?: string | null;
  sourceLocale: ContentLocale;
  title: string;
}) {
  const ctx = await requireAuth();
  const validated = jobTranslationDraftSchema.safeParse(values);
  if (!validated.success) {
    return { error: "Add source content first." };
  }

  try {
    const { db } = await createSessionClient();
    const lookups = await loadRecruitmentLookups(db);
    assertRecruitmentVacancyWriteAccess(toRecruitmentAdminScope(ctx), lookups, {
      campus_id: validated.data.campusId,
      department_id: validated.data.departmentId ?? null,
    });
    const translated = await translateJobSnapshot(
      {
        description: validated.data.description,
        short_description: validated.data.shortDescription ?? "",
        title: validated.data.title,
      },
      validated.data.sourceLocale
    );
    if (getTargetLocale(validated.data.sourceLocale) === "en") {
      return {
        data: {
          description_en: translated.description,
          short_description_en: translated.short_description,
          title_en: translated.title,
        },
      };
    }
    return {
      data: {
        description_no: translated.description,
        short_description_no: translated.short_description,
        title_no: translated.title,
      },
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to generate translation draft",
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
      model: fastModel,
      reasoning: "low",
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

/** An HR team member, taken straight from the Appwrite team membership. */
interface RecruitmentTeamMember {
  email: string | null;
  name: string;
  userId: string;
}

/**
 * List the members of an Appwrite team straight from its memberships (404 →
 * empty). `userName` / `userEmail` are populated from the member's account, so
 * no separate user-table lookup is needed.
 */
async function listTeamMembers(
  teams: Awaited<ReturnType<typeof createAdminClient>>["teams"],
  teamId: string
): Promise<RecruitmentTeamMember[]> {
  try {
    const result = await teams.listMemberships(teamId, [Query.limit(200)]);
    return result.memberships.map((membership) => ({
      email: membership.userEmail || null,
      name: membership.userName || membership.userEmail || "Unnamed HR member",
      userId: membership.userId,
    }));
  } catch {
    return [];
  }
}

async function listTeamMemberUserIds(
  teams: Awaited<ReturnType<typeof createAdminClient>>["teams"],
  teamId: string
): Promise<Set<string>> {
  const members = await listTeamMembers(teams, teamId);
  return new Set(members.map((member) => member.userId));
}

/**
 * Turn HR team members into reviewer options, tagging `scope` from `primaryIds`
 * and dropping any member who isn't in `eligibleIds`. Primary members sort first.
 */
function toReviewerOptions(
  hrMembers: RecruitmentTeamMember[],
  eligibleIds: Set<string>,
  primaryIds: Set<string>
): RecruitmentReviewerOption[] {
  const options: RecruitmentReviewerOption[] = hrMembers
    .filter((member) => eligibleIds.has(member.userId))
    .map((member) => ({
      email: member.email,
      id: member.userId,
      name: member.name,
      scope: primaryIds.has(member.userId) ? "primary" : "other",
    }));
  options.sort((a, b) => {
    if (a.scope === b.scope) {
      return a.name.localeCompare(b.name);
    }
    return a.scope === "primary" ? -1 : 1;
  });
  return options;
}

/**
 * Eligible interview-panel reviewers for a vacancy. Eligibility is defined by
 * Appwrite Teams membership — HR-department team members (`sg-app-dept-hr`)
 * scoped by campus team:
 * - Campus vacancy: HR in `sg-app-campus-{campus}` + HR in national. No opt-in.
 * - National vacancy: HR in national by default; the remaining HR members are
 *   returned tagged `scope: "other"` and surfaced when `allowOtherCampuses` is
 *   honoured by the UI checkbox.
 */
export async function listRecruitmentReviewers(jobId?: string): Promise<
  | {
      allowOtherCampuses: boolean;
      data: RecruitmentReviewerOption[];
      error?: never;
    }
  | {
      allowOtherCampuses?: never;
      data?: never;
      error: string;
    }
> {
  const ctx = await requireAuth();
  const { db, teams } = await createAdminClient();
  const scope = toRecruitmentAdminScope(ctx);
  const lookups = await loadRecruitmentLookups(db);

  try {
    const hrMembers = await listTeamMembers(teams, HR_TEAM_ID);
    const hrIds = new Set(hrMembers.map((member) => member.userId));

    // Global fallback (no specific vacancy): every HR-team member.
    if (!jobId) {
      return {
        allowOtherCampuses: false,
        data: toReviewerOptions(hrMembers, hrIds, hrIds),
      };
    }

    const vacancy = await getRecruitmentJobById(db, jobId);
    if (!vacancy) {
      return { error: "Vacancy not found" };
    }
    assertRecruitmentApplicationReviewAccess(scope, lookups, vacancy);

    const nationalIds = await listTeamMemberUserIds(
      teams,
      NATIONAL_CAMPUS_TEAM_ID
    );
    const campusName = CAMPUS_ID_TO_NAME[vacancy.campus_id] ?? null;

    // National vacancy: national HR is the default panel; the rest of HR is
    // opt-in via the "include other campuses" checkbox.
    if (campusName === "National") {
      const primaryIds = intersectIds(hrIds, nationalIds);
      return {
        allowOtherCampuses: true,
        data: toReviewerOptions(hrMembers, hrIds, primaryIds),
      };
    }

    // Campus vacancy: HR in this campus + national HR. No opt-in.
    const campusTeamId = campusName
      ? `sg-app-campus-${campusName.toLowerCase().replace(/\s+/g, "")}`
      : null;
    const campusIds = campusTeamId
      ? await listTeamMemberUserIds(teams, campusTeamId)
      : new Set<string>();
    const eligibleCampusIds = new Set<string>([...campusIds, ...nationalIds]);
    const primaryIds = intersectIds(hrIds, eligibleCampusIds);
    return {
      allowOtherCampuses: false,
      data: toReviewerOptions(hrMembers, primaryIds, primaryIds),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to load HR members",
    };
  }
}

function intersectIds(a: Set<string>, b: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const id of a) {
    if (b.has(id)) {
      out.add(id);
    }
  }
  return out;
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
