import { Query } from "@repo/api";
import { createPublicClient } from "@repo/api/server";
import { JobsStatus } from "@repo/api/types/appwrite";
import {
  fetchRecruitmentListRows,
  localizeVacancy,
} from "@repo/shared/recruitment";
import {
  isRecruitmentVacancyOpen,
  type RecruitmentCustomQuestion,
  type RecruitmentVacancy,
} from "@repo/shared/types/recruitment";
import type { PublicLocale } from "@/lib/public-content";

const WEB_BASE_URL = "https://biso.no";
const LIST_FETCH_LIMIT = 200;

export interface PublicJobItem {
  application_deadline: string | null;
  campus_id: string;
  campus_name: string | null;
  commitment: string | null;
  company: string | null;
  contact_email: string | null;
  contact_name: string | null;
  contact_role: string | null;
  created_at: string;
  custom_questions: RecruitmentCustomQuestion[];
  cv_required: boolean;
  department_id: string | null;
  department_name: string | null;
  description: string;
  employment_type: string | null;
  id: string;
  is_open: boolean;
  locale: PublicLocale;
  location: string | null;
  paid: boolean;
  short_description: string | null;
  slug: string;
  start_date: string | null;
  status: string;
  tags: string[];
  term: string | null;
  title: string;
  updated_at: string;
  url: string;
}

export interface PublicJobsQuery {
  campusId?: string;
  departmentId?: string;
  includeExpired: boolean;
  locale: PublicLocale;
  page: number;
  perPage: number;
  search?: string;
}

export function toPublicJob(
  vacancy: RecruitmentVacancy,
  locale: PublicLocale
): PublicJobItem {
  const localized = localizeVacancy(vacancy, locale);
  const translation = localized.translations[0];
  return {
    id: vacancy.$id,
    slug: vacancy.slug,
    status: vacancy.status,
    campus_id: vacancy.campus_id,
    campus_name: vacancy.campus?.name ?? null,
    department_id: vacancy.department_id,
    department_name: vacancy.department?.Name ?? null,
    locale,
    title: translation?.title ?? "",
    description: translation?.description ?? "",
    short_description:
      translation?.short_description ??
      vacancy.metadata.short_description ??
      null,
    application_deadline: vacancy.application_deadline,
    company: vacancy.metadata.company ?? null,
    employment_type: vacancy.metadata.employment_type ?? null,
    paid: vacancy.metadata.paid ?? false,
    location: vacancy.metadata.location ?? null,
    commitment: vacancy.metadata.commitment ?? null,
    term: vacancy.metadata.term ?? null,
    start_date: vacancy.metadata.start_date ?? null,
    contact_name: vacancy.metadata.contact_name ?? null,
    contact_email: vacancy.metadata.contact_email ?? null,
    contact_role: vacancy.metadata.contact_role ?? null,
    cv_required: vacancy.metadata.cv_required ?? false,
    tags: vacancy.metadata.tags ?? [],
    custom_questions: vacancy.custom_questions,
    is_open: isRecruitmentVacancyOpen(
      vacancy.status,
      vacancy.application_deadline
    ),
    url: `${WEB_BASE_URL}/jobs/${vacancy.slug}`,
    created_at: vacancy.$createdAt,
    updated_at: vacancy.$updatedAt,
  };
}

function matchesSearch(job: PublicJobItem, search: string): boolean {
  const lower = search.toLowerCase();
  return (
    job.title.toLowerCase().includes(lower) ||
    job.description.toLowerCase().includes(lower) ||
    (job.department_name ?? "").toLowerCase().includes(lower) ||
    (job.company ?? "").toLowerCase().includes(lower)
  );
}

export async function listPublicJobs(
  params: PublicJobsQuery
): Promise<{ items: PublicJobItem[]; total: number }> {
  const { db } = await createPublicClient();

  const queries: string[] = [
    Query.equal("status", JobsStatus.PUBLISHED),
    Query.orderDesc("$createdAt"),
    Query.limit(LIST_FETCH_LIMIT),
  ];

  if (params.campusId && params.campusId !== "all") {
    queries.push(Query.equal("campus_id", params.campusId));
  }

  if (params.departmentId) {
    queries.push(Query.equal("department_id", params.departmentId));
  }

  const vacancies = await fetchRecruitmentListRows(db, queries);
  const search = params.search?.trim() ?? "";

  const jobs = vacancies
    .filter(
      (vacancy) =>
        params.includeExpired ||
        isRecruitmentVacancyOpen(vacancy.status, vacancy.application_deadline)
    )
    .map((vacancy) => toPublicJob(vacancy, params.locale))
    .filter((job) => (search ? matchesSearch(job, search) : true));

  const offset = (params.page - 1) * params.perPage;
  return {
    items: jobs.slice(offset, offset + params.perPage),
    total: jobs.length,
  };
}
