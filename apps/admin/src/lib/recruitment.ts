import { Permission, Query, Role } from "@repo/api";
import type {
  Campus,
  ContentTranslations,
  Departments,
  JobApplications,
  Jobs,
} from "@repo/api/types/appwrite";
import {
  canManageRecruitmentVacancy,
  canReviewRecruitmentVacancy,
  getManagedCampusIds,
  type RecruitmentLookups,
} from "@repo/shared/recruitment";
import {
  parseRecruitmentApplicationReviewMetadata,
  type RecruitmentApplicationJobSummary,
  type RecruitmentApplicationRecord,
} from "@repo/shared/types/recruitment";
import type { AdminScope } from "@repo/shared/types/user-management";
import type { UserAuthContext } from "@/lib/authorization";

export type { RecruitmentLookups } from "@repo/shared/recruitment";
export {
  canManageRecruitmentVacancy,
  canReviewRecruitmentVacancy,
} from "@repo/shared/recruitment";

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

const ADMIN_TEAM = "admin";
const HR_TEAM = "sg-app-dept-hr";
const MEMBERS_TEAM = "biso-members";

/**
 * Build Appwrite $permissions for a job row.
 *
 * Public vacancies: readable by anyone.
 * Member-only vacancies: readable only by biso-members + review teams.
 * Write (update/delete): granted to team:admin, team:sg-app-dept-hr, and the
 * owning campus + department teams (team ID = sanitized display name).
 */
export function buildJobRowPermissions(
  lookups: RecruitmentLookups,
  job: { campus_id: string; department_id: string | null },
  audience: "public" | "members"
): string[] {
  const campusName = lookups.campusNamesById.get(job.campus_id);
  const campusTeam = campusName
    ? `sg-app-campus-${campusName.toLowerCase().replace(/\s+/g, "")}`
    : null;

  const deptName = job.department_id
    ? lookups.departmentNamesById.get(job.department_id)
    : null;
  const deptTeam = deptName
    ? `sg-app-dept-${deptName.toLowerCase().replace(/\s+/g, "")}`
    : null;

  // Campus teams must never receive write access — only department + admin + hr.
  const writeTeams = [...new Set([ADMIN_TEAM, HR_TEAM, ...(deptTeam ? [deptTeam] : [])])];

  const readPerms =
    audience === "public"
      ? [Permission.read(Role.any())]
      : [
          Permission.read(Role.team(MEMBERS_TEAM)),
          Permission.read(Role.team(ADMIN_TEAM)),
          Permission.read(Role.team(HR_TEAM)),
          ...(campusTeam ? [Permission.read(Role.team(campusTeam))] : []),
          ...(deptTeam ? [Permission.read(Role.team(deptTeam))] : []),
        ];

  return [
    ...new Set([
      ...readPerms,
      ...writeTeams.flatMap((t) => [
        Permission.update(Role.team(t)),
        Permission.delete(Role.team(t)),
      ]),
    ]),
  ];
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
    ai_screening: application.ai_screening ?? null,
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
    screening_score: application.screening_score ?? null,
    status: application.status,
  };
}
