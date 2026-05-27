import type { Models } from "@repo/api";
import { Query } from "@repo/api";
import type { ContentTranslations, Jobs } from "@repo/api/types/appwrite";
import {
  buildRecruitmentVacancyMetadata,
  parseRecruitmentCustomQuestions,
  parseRecruitmentInterviewTemplate,
  parseRecruitmentScreeningRubric,
  parseRecruitmentVacancyMetadata,
  type RecruitmentTranslation,
  type RecruitmentVacancy,
} from "./types/recruitment";
import type { AdminScope } from "./types/user-management";

export interface RecruitmentLookups {
  campusIdsByName: Map<string, string>;
  campusNamesById: Map<string, string>;
  departmentIdsByName: Map<string, string>;
  departmentNamesById: Map<string, string>;
}

export function getManagedCampusIds(
  scope: AdminScope,
  lookups: RecruitmentLookups
): string[] {
  if (scope.canManageAnyCampus) {
    return [];
  }

  return scope.managedCampusNames
    .map((name) => lookups.campusIdsByName.get(name))
    .filter((value): value is string => Boolean(value));
}

export function getManagedDepartmentIds(
  scope: AdminScope,
  lookups: RecruitmentLookups
): string[] {
  return scope.managedDepartmentNames
    .map((name) => lookups.departmentIdsByName.get(name))
    .filter((value): value is string => Boolean(value));
}

export function canManageRecruitmentVacancy(
  scope: AdminScope,
  lookups: RecruitmentLookups,
  job: Pick<Jobs, "campus_id" | "department_id">
): boolean {
  if (scope.canManageAnyCampus) {
    return true;
  }

  const managedCampusIds = getManagedCampusIds(scope, lookups);
  if (!managedCampusIds.includes(job.campus_id)) {
    return false;
  }

  if (scope.isCampusAdmin) {
    return true;
  }

  return Boolean(
    job.department_id &&
      getManagedDepartmentIds(scope, lookups).includes(job.department_id)
  );
}

export function canReviewRecruitmentVacancy(
  scope: AdminScope,
  lookups: RecruitmentLookups,
  job: Pick<Jobs, "campus_id" | "department_id">
): boolean {
  if (scope.canManageAnyCampus) {
    return true;
  }

  const managedCampusIds = getManagedCampusIds(scope, lookups);
  if (scope.isCampusAdmin && managedCampusIds.includes(job.campus_id)) {
    return true;
  }

  return Boolean(
    job.department_id &&
      getManagedDepartmentIds(scope, lookups).includes(job.department_id)
  );
}

export interface DbClient {
  getRow: <T>(
    databaseId: string,
    tableId: string,
    rowId: string,
    queries?: string[]
  ) => Promise<T>;
  listRows: <T>(
    databaseId: string,
    tableId: string,
    queries?: string[]
  ) => Promise<{ rows: T[]; total: number }>;
}

export const JOB_SELECT = [
  "$id",
  "$createdAt",
  "$updatedAt",
  "slug",
  "status",
  "campus_id",
  "department_id",
  "metadata",
  "custom_questions",
  "interview_template",
  "screening_rubric",
  "auto_screen",
  "campus.$id",
  "campus.name",
  "department.$id",
  "department.Name",
  "department.campus_id",
  "translations.*",
] as const;

export function isAuthenticatedAppwriteUser(
  user: Models.User<Models.Preferences>
): boolean {
  const hasEmail = Boolean(user.email && user.email.length > 0);
  const hasRealName =
    Boolean(user.name && user.name.length > 0) &&
    !user.name.startsWith("guest_");
  return hasEmail || (hasRealName && user.emailVerification);
}

function toRecruitmentTranslation(
  translation: ContentTranslations
): RecruitmentTranslation {
  return {
    $id: translation.$id,
    additional_fields: translation.additional_fields ?? null,
    description: translation.description ?? "",
    locale: translation.locale,
    short_description: translation.short_description ?? null,
    title: translation.title ?? "",
  };
}

export function buildRecruitmentVacancy(
  job: Jobs,
  translations?: RecruitmentTranslation[]
): RecruitmentVacancy {
  const resolvedTranslations: RecruitmentTranslation[] =
    translations ??
    ((job.translations as ContentTranslations[] | undefined) ?? []).map(
      toRecruitmentTranslation
    );
  const parsedMetadata = parseRecruitmentVacancyMetadata(job.metadata);
  const translationFallback = resolvedTranslations.find(
    (tr) => tr.locale === "no"
  );

  let legacyMetadata: Record<string, unknown> = {};
  if (
    translationFallback?.additional_fields &&
    typeof translationFallback.additional_fields === "string"
  ) {
    try {
      legacyMetadata = JSON.parse(
        translationFallback.additional_fields
      ) as Record<string, unknown>;
    } catch {
      legacyMetadata = {};
    }
  }

  return {
    $createdAt: job.$createdAt,
    $id: job.$id,
    $updatedAt: job.$updatedAt,
    campus: job.campus ? { $id: job.campus.$id, name: job.campus.name } : null,
    campus_id: job.campus_id,
    department: job.department
      ? {
          $id: job.department.$id,
          Name: job.department.Name,
          campus_id: job.department.campus_id,
        }
      : null,
    department_id: job.department_id,
    metadata: buildRecruitmentVacancyMetadata(
      {
        company:
          parsedMetadata.company ??
          (typeof legacyMetadata.company === "string"
            ? legacyMetadata.company
            : null),
        employment_type:
          parsedMetadata.employment_type ??
          (typeof legacyMetadata.employment_type === "string"
            ? legacyMetadata.employment_type
            : null),
        short_description:
          parsedMetadata.short_description ??
          translationFallback?.short_description,
      },
      parsedMetadata
    ),
    slug: job.slug,
    status: job.status,
    translations: resolvedTranslations,
    custom_questions: parseRecruitmentCustomQuestions(job.custom_questions),
    screening_rubric: job.screening_rubric
      ? parseRecruitmentScreeningRubric(job.screening_rubric)
      : null,
    interview_template: job.interview_template
      ? parseRecruitmentInterviewTemplate(job.interview_template)
      : null,
    auto_screen: job.auto_screen ?? true,
  };
}

export async function fetchRecruitmentListRows(
  db: DbClient,
  queries: string[]
): Promise<RecruitmentVacancy[]> {
  const response = await db.listRows<Jobs>("app", "jobs", [
    Query.select([...JOB_SELECT]),
    ...queries,
  ]);
  return response.rows.map((job) => buildRecruitmentVacancy(job));
}

export async function fetchRecruitmentJobsByIds(
  db: DbClient,
  ids: string[]
): Promise<Map<string, RecruitmentVacancy>> {
  const jobsById = new Map<string, RecruitmentVacancy>();
  for (let i = 0; i < ids.length; i += 25) {
    const chunk = ids.slice(i, i + 25);
    const response = await db.listRows<Jobs>("app", "jobs", [
      Query.select([...JOB_SELECT]),
      Query.equal("$id", chunk),
      Query.limit(chunk.length),
    ]);
    for (const job of response.rows) {
      jobsById.set(job.$id, buildRecruitmentVacancy(job));
    }
  }
  return jobsById;
}

export async function getRecruitmentJobBySlug(
  db: DbClient,
  slug: string
): Promise<RecruitmentVacancy | null> {
  const response = await db.listRows<Jobs>("app", "jobs", [
    Query.select([...JOB_SELECT]),
    Query.equal("slug", slug),
    Query.limit(1),
  ]);
  const job = response.rows[0];
  return job ? buildRecruitmentVacancy(job) : null;
}

export async function getRecruitmentJobById(
  db: DbClient,
  jobId: string
): Promise<RecruitmentVacancy | null> {
  try {
    const job = await db.getRow<Jobs>("app", "jobs", jobId, [
      Query.select([...JOB_SELECT]),
    ]);
    return buildRecruitmentVacancy(job);
  } catch {
    return null;
  }
}

export function getRecruitmentVacancyTitle(
  vacancy: RecruitmentVacancy,
  locale: "en" | "no" = "no"
): string {
  return (
    vacancy.translations.find((t) => t.locale === locale)?.title ??
    vacancy.translations[0]?.title ??
    "Untitled"
  );
}

export function localizeVacancy<
  T extends { translations: Array<{ locale: string }> },
>(vacancy: T, locale: string): T {
  const localized = vacancy.translations.filter(
    (t: { locale: string }) => t.locale === locale
  );
  return {
    ...vacancy,
    translations: localized.length > 0 ? localized : vacancy.translations,
  };
}
