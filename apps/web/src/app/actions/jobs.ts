"use server";

import {
  normalizeScreeningScore,
  screenApplication,
} from "@repo/ai/server/recruitment-screener";
import { ID, Query } from "@repo/api";
import { InputFile } from "@repo/api/file";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type {
  CandidateProfiles,
  JobApplicationAnswers,
  JobApplications,
  JobInterviews,
  Jobs,
} from "@repo/api/types/appwrite";
import {
  CandidateProfilesEmbeddingStatus,
  JobApplicationsEmbeddingStatus,
  JobApplicationsStatus,
  JobsStatus,
} from "@repo/api/types/appwrite";
import type { CandidateProfileWriteInput } from "@repo/api/types/inputs";
import { createTypedRow, updateTypedRow } from "@repo/api/write";
import {
  buildRecruitmentStaffRowPermissions,
  fetchRecruitmentListPage,
  getRecruitmentJobById,
  getRecruitmentJobBySlug,
  isAuthenticatedAppwriteUser,
  localizeVacancy,
} from "@repo/shared/recruitment";
import {
  buildRecruitmentApplicationReviewMetadata,
  computeRecruitmentRetentionUntil,
  isRecruitmentVacancyOpen,
  parseRecruitmentApplicationReviewMetadata,
  parseRecruitmentScreeningRubric,
  RECRUITMENT_RESUME_BUCKET_ID,
  type RecruitmentApplicationAnswerInput,
  type RecruitmentCustomQuestion,
  type RecruitmentVacancy,
  recruitmentApplicationSubmitSchema,
  serializeRecruitmentAiScreening,
  serializeRecruitmentApplicationReviewMetadata,
  validateRecruitmentResumeFile,
} from "@repo/shared/types/recruitment";
import {
  parseUnitCategory,
  UNIT_CATEGORIES,
  type UnitCategory,
} from "@repo/shared/utils/unit-categories";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { cache } from "react";
import { campusScopeIds } from "@/lib/campus-scope";
import { findContentIdsBySearch } from "@/lib/data/search-content";
import {
  emptyWebResult,
  WEB_PAGE_SIZE,
  type WebPaginatedResult,
  webOffset,
} from "@/lib/list-params";

// ---------- public reads (session/guest client — enforces row permissions) ----------

export type JobSort = "deadline" | "newest";

/**
 * Open vacancies, as an Appwrite query rather than a post-fetch filter.
 *
 * `isRecruitmentVacancyOpen` used to run over an already-fetched window, which
 * meant any open vacancy outside the newest 100 rows never reached the page —
 * only 28 of 253 published jobs are open. It also made `total` overcount, which
 * pagination cannot tolerate. The helper's "unparseable date -> keep" branch is
 * unreachable for a datetime column, so this is equivalent.
 */
function openVacancyQueries(): string[] {
  return [
    Query.equal("status", JobsStatus.PUBLISHED),
    Query.or([
      Query.isNull("application_deadline"),
      Query.greaterThanEqual("application_deadline", new Date().toISOString()),
    ]),
  ];
}

// Primitive arguments only: React cache() keys on argument identity
// (Object.is), so an options object allocated fresh at each call site would
// never hit the memo. See WEB_APP_APPWRITE_INCIDENT_AUDIT.md (F-6b).
const _listJobs = cache(
  async (
    campus: string | null,
    department: string | null,
    category: string | null,
    locale: string,
    page: number,
    search: string,
    sort: JobSort
  ): Promise<WebPaginatedResult<RecruitmentVacancy>> => {
    try {
      const { db } = await createSessionClient();

      let capped = false;
      const idQueries: string[] = [];
      if (search.trim()) {
        const found = await findContentIdsBySearch(db, "job", search, locale);
        if (found.ids.length === 0) {
          return emptyWebResult<RecruitmentVacancy>(page);
        }
        capped = found.capped;
        idQueries.push(Query.equal("$id", found.ids));
      }

      const queries: string[] = [
        ...openVacancyQueries(),
        ...idQueries,
        sort === "deadline"
          ? Query.orderAsc("application_deadline")
          : Query.orderDesc("$createdAt"),
        Query.limit(WEB_PAGE_SIZE),
        Query.offset(webOffset(page)),
      ];

      const campusScope = campusScopeIds(campus);
      if (campusScope) {
        queries.push(Query.equal("campus_id", campusScope));
      }
      if (department) {
        queries.push(Query.equal("department_id", department));
      }
      if (category) {
        // Filter operators traverse relationships (verified); ordering does
        // not, which is why there is no A-Z sort.
        queries.push(Query.equal("department.type", category));
      }

      const { rows, total } = await fetchRecruitmentListPage(db, queries);

      return {
        rows: rows.map((v) => localizeVacancy(v, locale)),
        total,
        page,
        size: WEB_PAGE_SIZE,
        capped,
      };
    } catch (error) {
      console.error("listJobs failed:", error);
      return emptyWebResult<RecruitmentVacancy>(page);
    }
  }
);

// biome-ignore lint/suspicious/useAwait: async required by "use server" — returns cached promise
export async function listJobs(params: {
  campus?: string | null;
  category?: string | null;
  department?: string | null;
  locale?: string;
  page?: number;
  search?: string;
  sort?: JobSort;
}): Promise<WebPaginatedResult<RecruitmentVacancy>> {
  return _listJobs(
    params.campus ?? null,
    params.department ?? null,
    params.category ?? null,
    params.locale ?? "en",
    params.page ?? 1,
    params.search ?? "",
    params.sort ?? "newest"
  );
}

/**
 * Filter options drawn from the whole filtered set, not the current page.
 *
 * Building the dropdowns from page 1 would offer twelve rows' worth of
 * options. Two cheap projections over the open set (28 rows today) give the
 * true lists, and the department count doubles as the hero's stat.
 */
export async function listJobFacets(params: {
  campus?: string | null;
}): Promise<{ categories: UnitCategory[]; departments: [string, string][] }> {
  try {
    const { db } = await createSessionClient();
    const queries = [
      ...openVacancyQueries(),
      Query.select([
        "$id",
        "department_id",
        "department.$id",
        "department.Name",
        "department.type",
      ]),
      Query.limit(300),
    ];
    const campusScope = campusScopeIds(params.campus ?? null);
    if (campusScope) {
      queries.push(Query.equal("campus_id", campusScope));
    }

    const response = await db.listRows<Jobs>("app", "jobs", queries);

    const departments = new Map<string, string>();
    const categories = new Set<UnitCategory>();
    for (const job of response.rows) {
      const dept = job.department as
        | { $id?: string; Name?: string; type?: string | null }
        | null
        | undefined;
      if (job.department_id && dept?.Name) {
        departments.set(job.department_id, dept.Name);
      }
      const parsed = parseUnitCategory(dept?.type);
      if (parsed) {
        categories.add(parsed);
      }
    }

    return {
      // Ordered by the canonical list so the chips never reshuffle between
      // renders; only categories actually present are offered.
      categories: UNIT_CATEGORIES.filter((c) => categories.has(c)),
      // Appwrite's row order is not stable across renders; sort in JS so the
      // department dropdown doesn't reshuffle for no visible reason. (The
      // "cannot order by nested attribute" restriction is on Appwrite's
      // orderAsc, not on sorting already-fetched values.)
      departments: [...departments.entries()].sort(([, a], [, b]) =>
        a.localeCompare(b)
      ),
    };
  } catch (error) {
    console.error("listJobFacets failed:", error);
    return { categories: [], departments: [] };
  }
}

const _getJobBySlug = cache(
  async (slug: string, locale: string): Promise<RecruitmentVacancy | null> => {
    try {
      const { db } = await createSessionClient();
      const vacancy = await getRecruitmentJobBySlug(db, slug);
      if (
        !(
          vacancy &&
          isRecruitmentVacancyOpen(vacancy.status, vacancy.application_deadline)
        )
      ) {
        return null;
      }
      return localizeVacancy(vacancy, locale);
    } catch (error) {
      console.error("getJobBySlug failed:", error);
      return null;
    }
  }
);

// biome-ignore lint/suspicious/useAwait: async required by "use server" — returns cached promise
export async function getJobBySlug(
  slug: string,
  locale: "en" | "no"
): Promise<RecruitmentVacancy | null> {
  return _getJobBySlug(slug, locale);
}

// ---------- application submission (session auth + admin writes) ----------

const AVAILABILITY_SPLIT_PATTERN = /\r?\n|,/;

function readCustomAnswers(
  formData: FormData
): RecruitmentApplicationAnswerInput[] {
  const answers: RecruitmentApplicationAnswerInput[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("answer.")) {
      continue;
    }
    const questionId = key.slice("answer.".length);
    const rawType = formData.get(`answer_type.${questionId}`);
    const rawLabel = formData.get(`answer_label.${questionId}`);
    const stringValue = typeof value === "string" ? value : "";
    answers.push({
      answer: stringValue.length > 0 ? stringValue : null,
      answer_type: (typeof rawType === "string"
        ? rawType
        : "text") as RecruitmentApplicationAnswerInput["answer_type"],
      question_id: questionId,
      question_label:
        typeof rawLabel === "string" && rawLabel.trim().length > 0
          ? rawLabel
          : questionId,
    });
  }
  return answers;
}

function assertRequiredAnswersPresent(
  vacancyQuestions: RecruitmentCustomQuestion[],
  answers: RecruitmentApplicationAnswerInput[]
): string | null {
  const answersById = new Map(answers.map((a) => [a.question_id, a.answer]));
  for (const q of vacancyQuestions) {
    if (!q.required) {
      continue;
    }
    const val = answersById.get(q.id);
    if (!val || val.trim().length === 0) {
      return `Answer required for "${q.label}"`;
    }
  }
  return null;
}

function readAvailabilitySlots(formData: FormData): string[] {
  const repeated = formData
    .getAll("candidate_availability")
    .filter((v): v is string => typeof v === "string");
  const textarea =
    typeof formData.get("availability") === "string"
      ? String(formData.get("availability"))
          .split(AVAILABILITY_SPLIT_PATTERN)
          .map((s) => s.trim())
      : [];
  return [...repeated, ...textarea]
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: coordinating multiple sequential DB writes in a server action
export async function submitJobApplication(
  jobId: string,
  formData: FormData
): Promise<
  { success: true; applicationId: string } | { success: false; error: string }
> {
  try {
    const { account } = await createSessionClient();
    const user = await account.get().catch(() => null);
    if (!(user && isAuthenticatedAppwriteUser(user) && user.email)) {
      return {
        success: false,
        error: "You must sign in with a verified account before applying.",
      };
    }

    const answers = readCustomAnswers(formData);
    const parsed = recruitmentApplicationSubmitSchema.safeParse({
      applicant_name: formData.get("applicant_name"),
      applicant_email: user.email,
      applicant_phone: formData.get("applicant_phone"),
      answers,
      candidate_availability: readAvailabilitySlots(formData),
      cover_letter: formData.get("cover_letter"),
      current_employer: formData.get("current_employer"),
      current_role: formData.get("current_role"),
      gdpr_consent:
        formData.get("gdpr_consent") === "true" ||
        formData.get("gdpr_consent") === "on",
      linkedin_url: formData.get("linkedin_url"),
    });

    if (!parsed.success) {
      return { success: false, error: "Invalid application data." };
    }

    const { db, storage } = await createAdminClient();
    const vacancy = await getRecruitmentJobById(db, jobId);
    if (
      !(
        vacancy &&
        isRecruitmentVacancyOpen(vacancy.status, vacancy.application_deadline)
      )
    ) {
      return {
        success: false,
        error: "This vacancy is not accepting applications.",
      };
    }

    const missingAnswerError = assertRequiredAnswersPresent(
      vacancy.custom_questions,
      parsed.data.answers ?? []
    );
    if (missingAnswerError) {
      return { success: false, error: missingAnswerError };
    }

    const existing = await db.listRows("app", "job_applications", [
      Query.equal("job_id", jobId),
      Query.equal("applicant_email", user.email),
      Query.limit(1),
    ]);
    if (existing.total > 0) {
      return {
        success: false,
        error: "You have already applied for this vacancy.",
      };
    }

    const resume = formData.get("resume");
    let resumeFileId: string | null = null;
    if (resume instanceof File && resume.size > 0) {
      validateRecruitmentResumeFile(resume);
      const buffer = Buffer.from(await resume.arrayBuffer());
      const uploaded = await storage.createFile(
        RECRUITMENT_RESUME_BUCKET_ID,
        ID.unique(),
        InputFile.fromBuffer(buffer, resume.name)
      );
      resumeFileId = uploaded.$id;
    } else if (vacancy.metadata.cv_required) {
      return { success: false, error: "A CV is required for this vacancy." };
    }

    const consentDate = new Date();
    const retentionUntil = computeRecruitmentRetentionUntil(
      vacancy.application_deadline
    );

    let candidateProfileId: string | null = null;
    try {
      const existing = await db.listRows<CandidateProfiles>(
        "app",
        "candidate_profiles",
        [Query.equal("email", user.email), Query.limit(1)]
      );
      if (existing.rows[0]) {
        const cur = existing.rows[0];
        const updated = await updateTypedRow<
          CandidateProfiles,
          Partial<CandidateProfileWriteInput>
        >(
          db,
          "app",
          "candidate_profiles",
          cur.$id,
          {
            applications_count: (cur.applications_count ?? 0) + 1,
            campus_id: vacancy.campus_id ?? cur.campus_id,
            current_employer:
              parsed.data.current_employer ?? cur.current_employer,
            current_role: parsed.data.current_role ?? cur.current_role,
            data_retention_until: retentionUntil,
            full_name:
              parsed.data.applicant_name.length > 0
                ? parsed.data.applicant_name
                : cur.full_name,
            last_application_at: consentDate.toISOString(),
            linkedin_url: parsed.data.linkedin_url ?? cur.linkedin_url ?? null,
            phone: parsed.data.applicant_phone ?? cur.phone ?? null,
          },
          buildRecruitmentStaffRowPermissions()
        );
        candidateProfileId = updated.$id;
      } else {
        const created = await createTypedRow<
          CandidateProfiles,
          CandidateProfileWriteInput
        >(
          db,
          "app",
          "candidate_profiles",
          ID.unique(),
          {
            applications_count: 1,
            campus_id: vacancy.campus_id,
            consent_date: consentDate.toISOString(),
            current_employer: parsed.data.current_employer ?? null,
            current_role: parsed.data.current_role ?? null,
            data_retention_until: retentionUntil,
            email: user.email,
            embedding_id: null,
            embedding_status: CandidateProfilesEmbeddingStatus.PENDING,
            full_name: parsed.data.applicant_name,
            gdpr_consent: true,
            last_application_at: consentDate.toISOString(),
            linkedin_url: parsed.data.linkedin_url ?? null,
            notes: null,
            phone: parsed.data.applicant_phone ?? null,
            source: "public_apply",
            tags: null,
          },
          buildRecruitmentStaffRowPermissions()
        );
        candidateProfileId = created.$id;
      }
    } catch (err) {
      console.warn("Candidate profile upsert failed:", err);
    }
    const perms = buildRecruitmentStaffRowPermissions();
    const application = await db.createRow(
      "app",
      "job_applications",
      ID.unique(),
      {
        applicant_email: user.email,
        applicant_name: parsed.data.applicant_name,
        applicant_phone: parsed.data.applicant_phone ?? null,
        candidate_profile: candidateProfileId,
        candidate_profile_id: candidateProfileId,
        consent_date: consentDate.toISOString(),
        cover_letter: parsed.data.cover_letter ?? null,
        data_processing_purpose: "BISO recruitment process",
        data_retention_until: retentionUntil,
        embedding_status: JobApplicationsEmbeddingStatus.PENDING,
        gdpr_consent: true,
        job: jobId,
        job_id: jobId,
        resume_file_id: resumeFileId,
        review_metadata: serializeRecruitmentApplicationReviewMetadata(
          buildRecruitmentApplicationReviewMetadata({
            candidate_availability: parsed.data.candidate_availability,
          })
        ),
        source: "public_apply",
        status: JobApplicationsStatus.SUBMITTED,
      },
      perms
    );

    for (const answer of parsed.data.answers ?? []) {
      try {
        await db.createRow<JobApplicationAnswers>(
          "app",
          "job_application_answers",
          ID.unique(),
          {
            answer: answer.answer ?? null,
            answer_type:
              answer.answer_type as JobApplicationAnswers["answer_type"],

            // @ts-expect-error
            application: application.$id,
            application_id: application.$id,
            job_id: jobId,
            question_id: answer.question_id,
            question_label: answer.question_label,
          },
          buildRecruitmentStaffRowPermissions()
        );
      } catch (err) {
        console.warn(
          `Failed to persist answer for ${answer.question_id}:`,
          err
        );
      }
    }

    const autoScreen =
      vacancy.auto_screen !== false &&
      vacancy.metadata.auto_screen !== false &&
      Boolean(process.env.OPENAI_API_KEY);
    if (autoScreen) {
      after(async () => {
        try {
          // Re-instantiate admin client inside after() to ensure no context loss
          const { db: afterDb } = await createAdminClient();
          const screening = await screenApplication({
            answers: (parsed.data.answers ?? []).map((a) => ({
              answer: a.answer ?? null,
              question_label: a.question_label,
            })),
            application: {
              $id: application.$id,
              applicant_email: user.email,
              applicant_name: parsed.data.applicant_name,
              cover_letter: parsed.data.cover_letter ?? null,
              current_employer: parsed.data.current_employer ?? null,
              current_role: parsed.data.current_role ?? null,
              linkedin_url: parsed.data.linkedin_url ?? null,
            },
            rubric:
              vacancy.screening_rubric ?? parseRecruitmentScreeningRubric(null),
            vacancy: {
              $id: vacancy.$id,
              metadata: vacancy.metadata,
              translations: vacancy.translations,
            },
          });
          await afterDb.updateRow("app", "job_applications", application.$id, {
            ai_screening: serializeRecruitmentAiScreening(screening),
            screening_score: normalizeScreeningScore(screening),
          });
        } catch (err) {
          console.warn(
            `AI screening failed for application ${application.$id}:`,
            err
          );
        }
      });
    }

    revalidatePath("/applications");
    revalidatePath("/jobs");
    return { success: true, applicationId: application.$id };
  } catch (error) {
    console.error("submitJobApplication failed:", error);
    return { success: false, error: "Failed to submit application." };
  }
}

// ---------- candidate "my applications" ----------

export interface MyApplicationView {
  $createdAt: string;
  $id: string;
  answers: Array<{ question_label: string; answer: string | null }>;
  cover_letter: string | null;
  data_retention_until: string;
  hr_assigned_name: string | null;
  job: {
    $id: string;
    slug: string;
    title: string;
    campus_name: string | null;
  } | null;
  next_interview: {
    $id: string;
    starts_at: string | null;
    ends_at: string | null;
    title: string;
    location: string | null;
    meeting_url: string | null;
    status: "proposed" | "scheduled" | "completed" | "cancelled" | "no_show";
  } | null;
  resume_file_id: string | null;
  status: "submitted" | "reviewed" | "interview" | "accepted" | "rejected";
}

export async function listMyApplications(): Promise<MyApplicationView[]> {
  try {
    const { account } = await createSessionClient();
    const user = await account.get().catch(() => null);
    if (!(user && isAuthenticatedAppwriteUser(user) && user.email)) {
      return [];
    }

    const { db } = await createAdminClient();
    const apps = await db.listRows<JobApplications>("app", "job_applications", [
      Query.equal("applicant_email", user.email),
      Query.orderDesc("$createdAt"),
      Query.limit(50),
    ]);
    if (apps.rows.length === 0) {
      return [];
    }

    const jobIds = Array.from(
      new Set(apps.rows.map((a: JobApplications) => a.job_id))
    );
    const appIds = apps.rows.map((a: JobApplications) => a.$id);

    interface JobRow {
      $id: string;
      campus?: { name: string };
      slug: string;
      translations?: Array<{ locale?: string; title?: string }>;
    }
    const jobsResult = await db.listRows<Jobs>("app", "jobs", [
      Query.equal("$id", jobIds),
      Query.select([
        "$id",
        "slug",
        "campus.name",
        "translations.locale",
        "translations.title",
      ]),
      Query.limit(jobIds.length),
    ]);
    const jobById = new Map(jobsResult.rows.map((j: JobRow) => [j.$id, j]));

    const interviews = await db.listRows<JobInterviews>(
      "app",
      "job_interviews",
      [
        Query.equal("application_id", appIds),
        Query.orderAsc("starts_at"),
        Query.limit(appIds.length * 3),
      ]
    );
    const nextByApp = new Map<string, JobInterviews>();
    const now = Date.now();
    for (const iv of interviews.rows) {
      if (iv.status === "cancelled") {
        continue;
      }
      const startsAt = iv.starts_at ? new Date(iv.starts_at).getTime() : 0;
      if (startsAt && startsAt < now) {
        continue;
      }
      const existing = nextByApp.get(iv.application_id);
      if (
        !existing ||
        (startsAt &&
          (!existing.starts_at ||
            startsAt < new Date(existing.starts_at).getTime()))
      ) {
        nextByApp.set(iv.application_id, iv);
      }
    }

    const answersResult = await db.listRows<JobApplicationAnswers>(
      "app",
      "job_application_answers",
      [Query.equal("application_id", appIds), Query.limit(200)]
    );
    const answersByApp = new Map<
      string,
      Array<{ question_label: string; answer: string | null }>
    >();
    for (const answerRow of answersResult.rows) {
      const list = answersByApp.get(answerRow.application_id) ?? [];
      list.push({
        answer: answerRow.answer ?? null,
        question_label: answerRow.question_label,
      });
      answersByApp.set(answerRow.application_id, list);
    }

    return apps.rows.map((app) => {
      const job = jobById.get(app.job_id);
      const translations = job?.translations ?? [];
      const title =
        translations.find((tr) => tr.locale === "no")?.title ??
        translations[0]?.title ??
        job?.slug ??
        "Vacancy";
      const next = nextByApp.get(app.$id) ?? null;
      const review = parseRecruitmentApplicationReviewMetadata(
        app.review_metadata
      );

      return {
        $createdAt: app.$createdAt,
        $id: app.$id,
        answers: answersByApp.get(app.$id) ?? [],
        cover_letter: app.cover_letter ?? null,
        data_retention_until: app.data_retention_until,
        hr_assigned_name: review.assigned_hr_user_name ?? null,
        job: job
          ? {
              $id: job.$id,
              campus_name: job.campus?.name ?? null,
              slug: job.slug,
              title,
            }
          : null,
        next_interview: next
          ? {
              $id: next.$id,
              ends_at: next.ends_at,
              location: next.location,
              meeting_url: next.meeting_url,
              starts_at: next.starts_at,
              status: next.status,
              title: next.title,
            }
          : null,
        resume_file_id: app.resume_file_id ?? null,
        status: app.status,
      };
    });
  } catch (error) {
    console.error("listMyApplications failed:", error);
    return [];
  }
}
