/**
 * Recruitment.
 *
 * Reads only, and gated on the recruitment policy rather than on general
 * content access. This is the discrepancy the audit turned up: the admin
 * assistant's `buildAssistantCapabilities` hands any department member
 * `jobs: "write"`, while `NAV_ACCESS["portal.jobs"]` is `[globaladmin, HR]`
 * and `toRecruitmentAdminScope` returns an empty scope for everyone else, so
 * `listJobs` short-circuits to an empty list. Nothing leaks, but the assistant
 * advertises vacancy tools that always come back empty for most staff.
 *
 * `toRecruitmentScope` below is the port of `toRecruitmentAdminScope`, and it
 * is what decides registration, so a department member simply does not see
 * these tools.
 *
 * Applicant data is the most sensitive material this package touches. The
 * projections here return screening outcomes and review state, never a cover
 * letter body, and never a resume file. `job_applications` carries
 * `applicant_phone`, `gdpr_consent` and `data_retention_until`; the phone
 * number is not returned by the listing.
 */

import { Query } from "@repo/api";
import type { JobApplications, Jobs } from "@repo/api/types/appwrite";
import {
  canManageRecruitmentVacancy,
  canReviewRecruitmentVacancy,
  getRecruitmentJobById,
  type RecruitmentLookups,
} from "@repo/shared/recruitment";
import type { AdminScope } from "@repo/shared/types/user-management";
import type { BackendClients } from "../appwrite/clients";
import { campusLabel } from "../identity/campus";
import type { Principal } from "../identity/principal";
import { isGlobalAdmin, isHr } from "../identity/principal";
import { forbidden, fromAppwriteError, notFound } from "../runtime/errors";
import type { LookupService } from "./lookups";

/**
 * Port of `toRecruitmentAdminScope`.
 *
 * Recruitment is HR-exclusive: real global admins and HR+National manage every
 * campus, HR on a specific campus manages that campus, everyone else gets
 * nothing. Campus is pure scoping and never enters row permissions.
 */
export function toRecruitmentScope(principal: Principal): AdminScope {
  const globalAdmin = isGlobalAdmin(principal);
  const hr = isHr(principal);
  const national = principal.campusNames.includes("National");

  if (globalAdmin || (hr && national)) {
    return {
      canManageAnyCampus: true,
      isCampusAdmin: false,
      isGlobalAdmin: true,
      managedCampusNames: [],
      managedDepartmentNames: [],
      userId: principal.userId,
    };
  }

  if (hr) {
    const campuses =
      principal.managedCampuses.length > 0
        ? principal.managedCampuses
        : principal.campusNames;
    return {
      canManageAnyCampus: false,
      isCampusAdmin: true,
      isGlobalAdmin: false,
      managedCampusNames: campuses,
      managedDepartmentNames: [],
      userId: principal.userId,
    };
  }

  return {
    canManageAnyCampus: false,
    isCampusAdmin: false,
    isGlobalAdmin: false,
    managedCampusNames: [],
    managedDepartmentNames: [],
    userId: principal.userId,
  };
}

/** Whether a principal has any recruitment access at all. */
export function hasRecruitmentAccess(principal: Principal): boolean {
  const scope = toRecruitmentScope(principal);
  return scope.canManageAnyCampus || scope.managedCampusNames.length > 0;
}

export interface VacancySummary {
  applicationDeadline: string | null;
  autoScreen: boolean;
  campusId: string;
  campusLabel: string;
  departmentId: string | null;
  hasRubric: boolean;
  id: string;
  scheduledPublishAt: string | null;
  slug: string;
  status: string;
  title: string | null;
  updatedAt: string;
}

export interface ApplicationSummary {
  applicantEmail: string;
  applicantName: string;
  createdAt: string;
  dataRetentionUntil: string | null;
  gdprConsent: boolean;
  hasResume: boolean;
  /** Whether a screening result exists at all. */
  hasScreening: boolean;
  id: string;
  jobId: string;
  /** The stored AI screening score, when a screening ran. */
  screeningScore: number | null;
  status: string;
}

export interface RecruitmentService {
  getVacancy(principal: Principal, jobId: string): Promise<VacancySummary>;
  listApplications(
    principal: Principal,
    input: { jobId: string; status?: string; limit: number; offset: number }
  ): Promise<{ rows: ApplicationSummary[]; total: number }>;
  listVacancies(
    principal: Principal,
    input: { status?: string; campusId?: string; limit: number; offset: number }
  ): Promise<{ rows: VacancySummary[]; total: number; scopeNote: string }>;
}

async function buildLookups(
  lookups: LookupService
): Promise<RecruitmentLookups> {
  const [campuses, departments] = await Promise.all([
    lookups.campuses(),
    lookups.departments(),
  ]);
  return {
    campusIdsByName: new Map(campuses.map((c) => [c.name, c.id])),
    campusNamesById: new Map(campuses.map((c) => [c.id, c.name])),
    departmentIdsByName: new Map(departments.map((d) => [d.name, d.id])),
    departmentNamesById: new Map(departments.map((d) => [d.id, d.name])),
  };
}

function titleOf(job: Jobs): string | null {
  const translations = job.translations as
    | Array<{ locale: string; title: string }>
    | undefined;
  if (!Array.isArray(translations)) {
    return null;
  }
  return (
    translations.find((t) => t.locale === "no")?.title ??
    translations[0]?.title ??
    null
  );
}

function toVacancy(job: Jobs): VacancySummary {
  return {
    id: job.$id,
    slug: job.slug,
    status: job.status,
    title: titleOf(job),
    campusId: job.campus_id,
    campusLabel: campusLabel(job.campus_id),
    departmentId: job.department_id ?? null,
    applicationDeadline: job.application_deadline ?? null,
    scheduledPublishAt: job.scheduled_publish_at ?? null,
    autoScreen: job.auto_screen !== false,
    hasRubric: Boolean(job.screening_rubric),
    updatedAt: job.$updatedAt,
  };
}

const VACANCY_SELECT = [
  "$id",
  "$updatedAt",
  "slug",
  "status",
  "campus_id",
  "department_id",
  "application_deadline",
  "scheduled_publish_at",
  "auto_screen",
  "screening_rubric",
  "translations.locale",
  "translations.title",
];

export function createRecruitmentService(
  clients: BackendClients,
  lookupService: LookupService
): RecruitmentService {
  function assertAccess(principal: Principal): AdminScope {
    const scope = toRecruitmentScope(principal);
    if (!(scope.canManageAnyCampus || scope.managedCampusNames.length > 0)) {
      throw forbidden(
        "Recruitment is restricted to HR and global admins.",
        { yourDepartments: principal.departmentNames },
        "Ask HR, or a global admin, for vacancy or applicant information."
      );
    }
    return scope;
  }

  return {
    async listVacancies(principal, input) {
      const scope = assertAccess(principal);
      const lookups = await buildLookups(lookupService);

      const queries: string[] = [
        Query.select(VACANCY_SELECT),
        Query.orderDesc("$updatedAt"),
        Query.limit(input.limit),
        Query.offset(input.offset),
      ];

      let scopeNote: string;
      if (scope.canManageAnyCampus) {
        scopeNote = "All campuses (HR national / global admin).";
        if (input.campusId) {
          queries.push(Query.equal("campus.$id", [input.campusId]));
          scopeNote = `Filtered to ${campusLabel(input.campusId)}.`;
        }
      } else {
        const managedIds = scope.managedCampusNames
          .map((name) => lookups.campusIdsByName.get(name))
          .filter((id): id is string => Boolean(id));
        if (managedIds.length === 0) {
          return {
            rows: [],
            total: 0,
            scopeNote:
              "Your HR membership did not resolve to any campus, so no vacancies are visible.",
          };
        }
        queries.push(Query.equal("campus.$id", managedIds));
        scopeNote = `HR for ${scope.managedCampusNames.join(", ")}.`;
      }

      if (input.status) {
        queries.push(Query.equal("status", input.status));
      }

      try {
        const result = await clients.user.db.listRows<Jobs>(
          "app",
          "jobs",
          queries
        );
        return {
          rows: result.rows.map(toVacancy),
          total: result.total,
          scopeNote,
        };
      } catch (error) {
        throw fromAppwriteError(error, { operation: "list vacancies" });
      }
    },

    async getVacancy(principal, jobId) {
      const scope = assertAccess(principal);
      const lookups = await buildLookups(lookupService);

      const vacancy = await getRecruitmentJobById(clients.user.db, jobId);
      if (!vacancy) {
        throw notFound(`No vacancy ${jobId}.`, { jobId });
      }
      // The same check the admin app makes, against the same shared policy.
      if (!canManageRecruitmentVacancy(scope, lookups, vacancy)) {
        throw notFound(`No vacancy ${jobId} is visible to you.`, { jobId });
      }

      return {
        id: vacancy.$id,
        slug: vacancy.slug,
        status: vacancy.status,
        title:
          vacancy.translations.find((t) => t.locale === "no")?.title ??
          vacancy.translations[0]?.title ??
          null,
        campusId: vacancy.campus_id,
        campusLabel: campusLabel(vacancy.campus_id),
        departmentId: vacancy.department_id ?? null,
        applicationDeadline: vacancy.application_deadline,
        scheduledPublishAt: vacancy.scheduled_publish_at,
        autoScreen: vacancy.auto_screen,
        hasRubric: vacancy.screening_rubric !== null,
        updatedAt: vacancy.$updatedAt,
      };
    },

    async listApplications(principal, input) {
      const scope = assertAccess(principal);
      const lookups = await buildLookups(lookupService);

      const vacancy = await getRecruitmentJobById(clients.user.db, input.jobId);
      if (!vacancy) {
        throw notFound(`No vacancy ${input.jobId}.`, { jobId: input.jobId });
      }
      // Reviewing is a distinct permission from managing; use the review check.
      if (!canReviewRecruitmentVacancy(scope, lookups, vacancy)) {
        throw notFound(`No vacancy ${input.jobId} is visible to you.`, {
          jobId: input.jobId,
        });
      }

      const queries: string[] = [
        Query.equal("job_id", input.jobId),
        Query.select([
          "$id",
          "$createdAt",
          "job_id",
          "applicant_name",
          "applicant_email",
          "status",
          "screening_score",
          "ai_screening",
          "resume_file_id",
          "gdpr_consent",
          "data_retention_until",
        ]),
        Query.orderDesc("screening_score"),
        Query.limit(input.limit),
        Query.offset(input.offset),
      ];
      if (input.status) {
        queries.push(Query.equal("status", input.status));
      }

      try {
        const result = await clients.user.db.listRows<JobApplications>(
          "app",
          "job_applications",
          queries
        );
        return {
          rows: result.rows.map((row) => ({
            id: row.$id,
            jobId: row.job_id,
            applicantName: row.applicant_name,
            applicantEmail: row.applicant_email,
            status: row.status,
            screeningScore: row.screening_score ?? null,
            hasScreening: Boolean(row.ai_screening),
            hasResume: Boolean(row.resume_file_id),
            createdAt: row.$createdAt,
            gdprConsent: row.gdpr_consent,
            dataRetentionUntil: row.data_retention_until,
          })),
          total: result.total,
        };
      } catch (error) {
        throw fromAppwriteError(error, { operation: "list applications" });
      }
    },
  };
}
