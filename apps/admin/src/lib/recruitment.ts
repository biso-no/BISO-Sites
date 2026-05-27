import { Query } from "@repo/api";
import type {
  Campus,
  ContentTranslations,
  Departments,
  JobApplications,
  Jobs,
} from "@repo/api/types/appwrite";
import {
  parseRecruitmentApplicationReviewMetadata,
  type RecruitmentApplicationJobSummary,
  type RecruitmentApplicationRecord,
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

export function buildRecruitmentApplicationRecord(
  application: JobApplications
): RecruitmentApplicationRecord {
  const jobRow = application.job as Jobs | null | undefined;
  const jobSummary: RecruitmentApplicationJobSummary | null = jobRow
    ? {
        $id: jobRow.$id,
        campus_id: jobRow.campus_id,
        department_id: jobRow.department_id,
        slug: jobRow.slug,
        status: jobRow.status,
        title:
          (jobRow.translations as ContentTranslations[] | undefined)?.find(
            (t) => t.locale === "no"
          )?.title ??
          (jobRow.translations as ContentTranslations[] | undefined)?.[0]
            ?.title ??
          "Untitled",
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
