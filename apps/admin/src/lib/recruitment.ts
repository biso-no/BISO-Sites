import { Query } from "@repo/api";
import type {
  Campus,
  ContentTranslations,
  Departments,
  JobApplications,
  Jobs,
  Locale as LocaleType,
} from "@repo/api/types/appwrite";
import { Locale } from "@repo/api/types/appwrite";
import {
  buildRecruitmentVacancyMetadata,
  parseRecruitmentApplicationReviewMetadata,
  parseRecruitmentCustomQuestions,
  parseRecruitmentInterviewTemplate,
  parseRecruitmentScreeningRubric,
  parseRecruitmentVacancyMetadata,
  type RecruitmentApplicationJobSummary,
  type RecruitmentApplicationRecord,
  type RecruitmentTranslation,
  type RecruitmentVacancy,
} from "@repo/shared/types/recruitment";
import type { AdminScope } from "@repo/shared/types/user-management";
import type { UserAuthContext } from "@/lib/authorization";

interface DbClient {
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

export interface RecruitmentLookups {
  campusIdsByName: Map<string, string>;
  campusNamesById: Map<string, string>;
  departmentIdsByName: Map<string, string>;
  departmentNamesById: Map<string, string>;
}

const JOB_SELECT = [
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
] as const;

const TRANSLATION_SELECT = [
  "$id",
  "content_id",
  "locale",
  "title",
  "description",
  "short_description",
  "additional_fields",
] as const;

export function toRecruitmentAdminScope(ctx: UserAuthContext): AdminScope {
  const isGlobalAdmin = ctx.roles.includes("globaladmin");
  const isCampusAdmin = ctx.managedCampuses.length > 0;
  const managedCampusNames =
    ctx.managedCampuses.length > 0 ? ctx.managedCampuses : ctx.campusNames;

  return {
    canManageAnyCampus: isGlobalAdmin,
    isCampusAdmin,
    isGlobalAdmin,
    managedCampusNames: isGlobalAdmin ? [] : managedCampusNames,
    managedDepartmentNames:
      isGlobalAdmin || isCampusAdmin ? [] : ctx.departmentNames,
    userId: ctx.userId,
  };
}

export async function loadRecruitmentLookups(
  db: DbClient
): Promise<RecruitmentLookups> {
  const [campuses, departments] = await Promise.all([
    db.listRows<Campus>("app", "campus", [Query.limit(100)]),
    db.listRows<Departments>("app", "departments", [Query.limit(500)]),
  ]);

  return {
    campusIdsByName: new Map(
      campuses.rows.map((campus) => [campus.name, campus.$id])
    ),
    campusNamesById: new Map(
      campuses.rows.map((campus) => [campus.$id, campus.name])
    ),
    departmentIdsByName: new Map(
      departments.rows.map((department) => [department.Name, department.$id])
    ),
    departmentNamesById: new Map(
      departments.rows.map((department) => [department.$id, department.Name])
    ),
  };
}

function getManagedCampusIds(
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

function getManagedDepartmentIds(
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

export function assertRecruitmentVacancyWriteAccess(
  scope: AdminScope,
  lookups: RecruitmentLookups,
  job: Pick<Jobs, "campus_id" | "department_id">
): void {
  if (!canManageRecruitmentVacancy(scope, lookups, job)) {
    throw new Error("Forbidden");
  }
}

export function assertRecruitmentApplicationReviewAccess(
  scope: AdminScope,
  lookups: RecruitmentLookups,
  job: Pick<Jobs, "campus_id" | "department_id">
): void {
  if (!canReviewRecruitmentVacancy(scope, lookups, job)) {
    throw new Error("Forbidden");
  }
}

// Interviews live in their own collection; they inherit the same
// campus/department gating as the parent vacancy.
export interface InterviewScopeTarget {
  campus_id: string;
  department_id: string | null;
}

export function canWriteInterview(
  scope: AdminScope,
  lookups: RecruitmentLookups,
  target: InterviewScopeTarget
): boolean {
  return canReviewRecruitmentVacancy(scope, lookups, target);
}

export function assertInterviewWriteAccess(
  scope: AdminScope,
  lookups: RecruitmentLookups,
  target: InterviewScopeTarget
): void {
  if (!canWriteInterview(scope, lookups, target)) {
    throw new Error("Forbidden");
  }
}

// Scorecards must be authored by an actual panel participant. Lead reviewers
// (campus + global admins) may also override in exceptional cases.
export function canSubmitScorecard(
  scope: AdminScope,
  currentUserId: string,
  participantUserIds: ReadonlySet<string>
): boolean {
  if (scope.isGlobalAdmin) {
    return true;
  }
  return participantUserIds.has(currentUserId);
}

export function assertScorecardWriteAccess(
  scope: AdminScope,
  currentUserId: string,
  participantUserIds: ReadonlySet<string>
): void {
  if (!canSubmitScorecard(scope, currentUserId, participantUserIds)) {
    throw new Error("Forbidden");
  }
}

// Candidate profile reads are campus-scoped: campus admins see candidates
// who last applied within their campus(es); department members see candidates
// linked to applications they can review. Global admins see everything.
export interface CandidateProfileScopeTarget {
  campus_id: string | null;
}

export function canReadCandidateProfile(
  scope: AdminScope,
  lookups: RecruitmentLookups,
  profile: CandidateProfileScopeTarget
): boolean {
  if (scope.canManageAnyCampus) {
    return true;
  }
  if (!profile.campus_id) {
    return false;
  }
  return getManagedCampusIds(scope, lookups).includes(profile.campus_id);
}

export function assertCandidateProfileReadAccess(
  scope: AdminScope,
  lookups: RecruitmentLookups,
  profile: CandidateProfileScopeTarget
): void {
  if (!canReadCandidateProfile(scope, lookups, profile)) {
    throw new Error("Forbidden");
  }
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

export async function fetchRecruitmentTranslations(
  db: DbClient,
  contentIds: string[]
): Promise<Map<string, RecruitmentTranslation[]>> {
  const translationsByContentId = new Map<string, RecruitmentTranslation[]>();

  for (let index = 0; index < contentIds.length; index += 25) {
    const chunk = contentIds.slice(index, index + 25);
    const response = await db.listRows<ContentTranslations>(
      "app",
      "content_translations",
      [
        Query.equal("content_type", "job"),
        Query.equal("content_id", chunk),
        Query.select([...TRANSLATION_SELECT]),
        Query.limit(chunk.length * 4),
      ]
    );

    for (const translation of response.rows) {
      const current = translationsByContentId.get(translation.content_id) ?? [];
      current.push(toRecruitmentTranslation(translation));
      translationsByContentId.set(translation.content_id, current);
    }
  }

  return translationsByContentId;
}

export function buildRecruitmentVacancy(
  job: Jobs,
  translations: RecruitmentTranslation[] = []
): RecruitmentVacancy {
  const parsedMetadata = parseRecruitmentVacancyMetadata(job.metadata);
  const translationFallback = translations.find(
    (translation) => translation.locale === Locale.NO
  );

  let legacyMetadata: Record<string, unknown> = {};
  if (translationFallback?.additional_fields) {
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
    campus: job.campus
      ? {
          $id: job.campus.$id,
          name: job.campus.name,
        }
      : null,
    campus_id: job.campus_id,
    department: job.department
      ? {
          $id: job.department.$id,
          campus_id: job.department.campus_id,
          Name: job.department.Name,
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
    translation_refs: translations,
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

export async function fetchRecruitmentJobsByIds(
  db: DbClient,
  ids: string[]
): Promise<Map<string, RecruitmentVacancy>> {
  const jobsById = new Map<string, RecruitmentVacancy>();

  for (let index = 0; index < ids.length; index += 25) {
    const chunk = ids.slice(index, index + 25);
    const response = await db.listRows<Jobs>("app", "jobs", [
      Query.equal("$id", chunk),
      Query.select([...JOB_SELECT]),
      Query.limit(chunk.length),
    ]);
    const translationsById = await fetchRecruitmentTranslations(
      db,
      response.rows.map((job) => job.$id)
    );

    for (const job of response.rows) {
      jobsById.set(
        job.$id,
        buildRecruitmentVacancy(job, translationsById.get(job.$id) ?? [])
      );
    }
  }

  return jobsById;
}

export function getRecruitmentVacancyTitle(
  vacancy: RecruitmentVacancy,
  locale: LocaleType = Locale.NO
): string {
  return (
    vacancy.translation_refs.find(
      (translation) => translation.locale === locale
    )?.title ??
    vacancy.translation_refs[0]?.title ??
    "Untitled"
  );
}

export function buildRecruitmentApplicationRecord(
  application: JobApplications,
  jobsById: Map<string, RecruitmentVacancy>
): RecruitmentApplicationRecord {
  const vacancy = jobsById.get(application.job_id);
  const jobSummary: RecruitmentApplicationJobSummary | null = vacancy
    ? {
        $id: vacancy.$id,
        campus_id: vacancy.campus_id,
        department_id: vacancy.department_id,
        slug: vacancy.slug,
        status: vacancy.status,
        title: getRecruitmentVacancyTitle(vacancy),
      }
    : null;

  return {
    $createdAt: application.$createdAt,
    $id: application.$id,
    $updatedAt: application.$updatedAt,
    applicant_email: application.applicant_email,
    applicant_name: application.applicant_name,
    applicant_phone: application.applicant_phone ?? null,
    consent_date: application.consent_date,
    cover_letter: application.cover_letter ?? null,
    data_processing_purpose: application.data_processing_purpose,
    data_retention_until: application.data_retention_until,
    gdpr_consent: application.gdpr_consent,
    job: jobSummary,
    job_id: application.job_id,
    review_metadata: parseRecruitmentApplicationReviewMetadata(
      application.review_metadata
    ),
    resume_file_id: application.resume_file_id ?? null,
    status: application.status,
  };
}

export async function getRecruitmentJobById(
  db: DbClient,
  jobId: string
): Promise<RecruitmentVacancy | null> {
  const jobsById = await fetchRecruitmentJobsByIds(db, [jobId]);
  return jobsById.get(jobId) ?? null;
}

export async function fetchRecruitmentListRows(
  db: DbClient,
  queries: string[]
): Promise<RecruitmentVacancy[]> {
  const response = await db.listRows<Jobs>("app", "jobs", [
    Query.select([...JOB_SELECT]),
    ...queries,
  ]);

  const translationsById = await fetchRecruitmentTranslations(
    db,
    response.rows.map((job) => job.$id)
  );

  return response.rows.map((job) =>
    buildRecruitmentVacancy(job, translationsById.get(job.$id) ?? [])
  );
}
