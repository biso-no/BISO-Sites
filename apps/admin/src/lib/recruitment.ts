import { Permission, Query, Role } from "@repo/api";
import type {
  Campus,
  ContentTranslations,
  Departments,
  JobApplications,
  Jobs,
} from "@repo/api/types/appwrite";
import {
  buildRecruitmentStaffRowPermissions,
  canManageRecruitmentVacancy,
  canReviewRecruitmentVacancy,
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

const HR_DEPARTMENT_KEY = "hr";

/**
 * HR is the recruitment-gatekeeper department. Detected by normalizing the
 * clean team name to "hr" (the suffix behind the `sg-app-dept-hr` team).
 */
export function isHrDepartment(departmentNames: string[]): boolean {
  return departmentNames.some(
    (name) => name.replace(/\s+/g, "").toLowerCase() === HR_DEPARTMENT_KEY
  );
}

/**
 * Recruitment access is HR-exclusive:
 *  - Real global admins (National + Operations Unit) and HR + National manage
 *    recruitment across ALL campuses.
 *  - HR + a specific campus manage ALL recruitment for that campus (every
 *    department in it).
 *  - Everyone else gets no recruitment access.
 * Campus is pure scoping and never enters row permissions.
 */
export function toRecruitmentAdminScope(ctx: UserAuthContext): AdminScope {
  const isActualGlobalAdmin = ctx.roles.includes("globaladmin");
  const isHr = isHrDepartment(ctx.departmentNames);
  const isNational = ctx.campusNames.includes("National");

  if (isActualGlobalAdmin || (isHr && isNational)) {
    return {
      canManageAnyCampus: true,
      isCampusAdmin: false,
      isGlobalAdmin: true,
      managedCampusNames: [],
      managedDepartmentNames: [],
      userId: ctx.userId,
    };
  }

  if (isHr) {
    const campuses =
      ctx.managedCampuses.length > 0 ? ctx.managedCampuses : ctx.campusNames;
    return {
      canManageAnyCampus: false,
      isCampusAdmin: true,
      isGlobalAdmin: false,
      managedCampusNames: campuses,
      managedDepartmentNames: [],
      userId: ctx.userId,
    };
  }

  return {
    canManageAnyCampus: false,
    isCampusAdmin: false,
    isGlobalAdmin: false,
    managedCampusNames: [],
    managedDepartmentNames: [],
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

const MEMBERS_TEAM = "biso-members";

/**
 * Row permissions for a job. Staff access (Operations Unit + HR) comes from
 * `buildRecruitmentStaffRowPermissions()`; the row additionally encodes public
 * visibility:
 *   - published + public  → read(any)
 *   - published + members → read(team:biso-members)
 *   - draft / closed      → no public read (staff only)
 * Campus and owning-department teams are intentionally never granted.
 */
export function buildJobRowPermissions(
  audience: "public" | "members",
  status?: string
): string[] {
  const published = status === undefined || status === "published";

  const visibility: string[] = [];
  if (published && audience === "public") {
    visibility.push(Permission.read(Role.any()));
  } else if (published && audience === "members") {
    visibility.push(Permission.read(Role.team(MEMBERS_TEAM)));
  }

  return [
    ...new Set([...visibility, ...buildRecruitmentStaffRowPermissions()]),
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
